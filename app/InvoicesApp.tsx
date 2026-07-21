"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { todayKey } from "@/lib/dates";
import {
  createInvoice,
  voidInvoice,
} from "@/lib/work/model";
import type {
  InvoiceDoc,
  InvoicePaymentMethod,
  InvoiceStatus,
} from "@/lib/work/types";
import {
  buildInvoiceTotals,
  createLineItem,
  createPayment,
  deriveInvoiceStatus,
  formatInvoiceMoney,
  INVOICE_PAYMENT_METHODS,
  INVOICE_STATUS_LABELS,
  nextInvoiceNumber,
} from "@/lib/invoices/model";
import {
  hydrateStoreFromCloud,
  listClients,
  listInvoices,
  listJobs,
  listQuotes,
  removeInvoice,
  upsertInvoice,
} from "@/lib/storage";
import AppShell from "@/app/AppShell";
import InvoiceDocument, {
  type InvoiceDraftFields,
} from "@/app/invoices/InvoiceDocument";
import "@/app/quotes/quote-document.css";
import "@/app/invoices/invoices-os.css";

type StatusFilter =
  | "all"
  | "draft"
  | "unpaid"
  | "overdue"
  | "paid"
  | "month";

const STATUS_FILTERS: { id: StatusFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "draft", label: "Draft" },
  { id: "unpaid", label: "Unpaid" },
  { id: "overdue", label: "Overdue" },
  { id: "paid", label: "Paid" },
  { id: "month", label: "This month" },
];

function emptyDraft(prefill?: Partial<InvoiceDraftFields>): InvoiceDraftFields {
  const lines =
    prefill?.lineItems && prefill.lineItems.length > 0
      ? prefill.lineItems
      : [createLineItem({ description: "Completed work", quantity: 1, rate: 0 })];
  return {
    clientName: prefill?.clientName ?? "",
    companyName: prefill?.companyName ?? "",
    clientId: prefill?.clientId ?? "",
    billingAddress: prefill?.billingAddress ?? "",
    serviceAddress: prefill?.serviceAddress ?? "",
    jobLabel: prefill?.jobLabel ?? "",
    jobId: prefill?.jobId ?? "",
    quoteId: prefill?.quoteId ?? "",
    requestId: prefill?.requestId ?? "",
    lineItems: lines,
    discount: prefill?.discount ?? "0",
    taxRate: prefill?.taxRate ?? "0",
    issueDate: prefill?.issueDate ?? todayKey(),
    dueDate: prefill?.dueDate ?? todayKey(),
    paymentTerms: prefill?.paymentTerms ?? "",
    notes: prefill?.notes ?? "",
    number: prefill?.number ?? "",
  };
}

function draftFromInvoice(invoice: InvoiceDoc): InvoiceDraftFields {
  const lineItems =
    invoice.lineItems.length > 0
      ? invoice.lineItems
      : [
          createLineItem({
            description: invoice.jobLabel || "Completed work",
            quantity: 1,
            rate: invoice.amount ?? 0,
          }),
        ];
  return {
    clientName: invoice.clientName,
    companyName: invoice.companyName,
    clientId: invoice.clientId,
    billingAddress: invoice.billingAddress,
    serviceAddress: invoice.serviceAddress,
    jobLabel: invoice.jobLabel,
    jobId: invoice.jobId,
    quoteId: invoice.quoteId,
    requestId: invoice.requestId,
    lineItems,
    discount: String(invoice.discount || 0),
    taxRate: String(invoice.taxRate || 0),
    issueDate: invoice.issueDate || todayKey(),
    dueDate: invoice.dueDate || todayKey(),
    paymentTerms: invoice.paymentTerms,
    notes: invoice.notes,
    number: invoice.number,
  };
}

function draftInvoiceShell(draft: InvoiceDraftFields): InvoiceDoc {
  const now = new Date().toISOString();
  return {
    id: "draft-new",
    number: draft.number || "New invoice",
    clientName: draft.clientName || "Client",
    companyName: draft.companyName,
    clientId: draft.clientId,
    billingAddress: draft.billingAddress,
    serviceAddress: draft.serviceAddress,
    jobLabel: draft.jobLabel || "Completed work",
    jobId: draft.jobId,
    quoteId: draft.quoteId,
    requestId: draft.requestId,
    lineItems: draft.lineItems,
    amount: null,
    discount: Number(draft.discount) || 0,
    taxRate: Number(draft.taxRate) || 0,
    payments: [],
    status: "draft",
    issueDate: draft.issueDate || todayKey(),
    dueDate: draft.dueDate || todayKey(),
    paymentTerms: draft.paymentTerms,
    notes: draft.notes,
    createdAt: now,
    updatedAt: now,
  };
}

function totalsFromDraft(draft: InvoiceDraftFields) {
  return buildInvoiceTotals(draftInvoiceShell(draft));
}

export default function InvoicesApp() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [ready, setReady] = useState(false);
  const [tick, setTick] = useState(0);
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mode, setMode] = useState<"list" | "compose" | "view">("list");
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<InvoiceDraftFields>(() => emptyDraft());
  const [toast, setToast] = useState("");
  const [saving, setSaving] = useState(false);
  const [payDate, setPayDate] = useState(() => todayKey());
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState<InvoicePaymentMethod>("cash");
  const [payNote, setPayNote] = useState("");
  const today = todayKey();
  const monthPrefix = today.slice(0, 7);

  useEffect(() => {
    let cancelled = false;
    void hydrateStoreFromCloud().then(() => {
      if (cancelled) return;
      setTick((v) => v + 1);
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Create → Invoice lands here with ?new=1 (optional prefill).
  useEffect(() => {
    if (!ready) return;
    const isNew = searchParams.get("new") === "1";
    if (!isNew) return;

    const quoteId = searchParams.get("quoteId") || "";
    const jobId = searchParams.get("jobId") || "";
    const clientIdParam = searchParams.get("clientId") || "";
    const amountParam = searchParams.get("amount") || "";
    const scopeParam = searchParams.get("scope") || "";
    const amountNum =
      amountParam.trim() === "" ? 0 : Math.max(0, Number(amountParam) || 0);

    const fromRelated: Partial<InvoiceDraftFields> = {};

    if (quoteId) {
      const quote = listQuotes().find((q) => q.id === quoteId);
      if (quote) {
        fromRelated.quoteId = quote.id;
        fromRelated.clientName = quote.clientName;
        fromRelated.billingAddress = quote.address;
        fromRelated.serviceAddress = quote.address;
        fromRelated.jobLabel = quote.scope || fromRelated.jobLabel;
        fromRelated.lineItems = [
          createLineItem({
            description: quote.scope || "Completed work",
            quantity: 1,
            rate: quote.amount ?? 0,
          }),
        ];
        fromRelated.notes = quote.notes || fromRelated.notes;
      }
    }

    if (jobId) {
      const job = listJobs().find((j) => j.id === jobId);
      if (job) {
        fromRelated.jobId = job.id;
        fromRelated.clientName = job.customerName;
        fromRelated.companyName = job.companyName || fromRelated.companyName;
        fromRelated.clientId = job.customerId || fromRelated.clientId || "";
        fromRelated.serviceAddress = job.address || fromRelated.serviceAddress;
        fromRelated.billingAddress =
          fromRelated.billingAddress || job.address || "";
        fromRelated.jobLabel =
          job.service || job.title || fromRelated.jobLabel || "Completed work";
        fromRelated.requestId = job.requestId || fromRelated.requestId || "";
        fromRelated.lineItems = [
          createLineItem({
            description:
              job.service || job.title || scopeParam || "Completed work",
            quantity: 1,
            rate: job.amount ?? amountNum,
          }),
        ];
        if (job.notes) fromRelated.notes = job.notes;
      }
    }

    const resolvedClientId = clientIdParam || fromRelated.clientId || "";
    if (resolvedClientId) {
      const client = listClients().find((c) => c.id === resolvedClientId);
      if (client) {
        if (!fromRelated.clientName) fromRelated.clientName = client.name;
        if (!fromRelated.companyName) fromRelated.companyName = client.companyName;
        if (!fromRelated.billingAddress) {
          fromRelated.billingAddress =
            client.billingAddress || client.address || "";
        }
        if (!fromRelated.serviceAddress) {
          fromRelated.serviceAddress = client.address || "";
        }
        fromRelated.clientId = client.id;
      }
    }

    const lineFromParams =
      scopeParam || amountParam
        ? [
            createLineItem({
              description: scopeParam || "Completed work",
              quantity: 1,
              rate: amountNum,
            }),
          ]
        : undefined;

    setDraft(
      emptyDraft({
        ...fromRelated,
        clientName:
          searchParams.get("clientName") || fromRelated.clientName || "",
        companyName:
          searchParams.get("companyName") || fromRelated.companyName || "",
        clientId: resolvedClientId,
        billingAddress:
          searchParams.get("billingAddress") ||
          fromRelated.billingAddress ||
          "",
        serviceAddress:
          searchParams.get("serviceAddress") ||
          fromRelated.serviceAddress ||
          "",
        jobLabel: searchParams.get("jobLabel") || fromRelated.jobLabel || "",
        jobId: searchParams.get("jobId") || fromRelated.jobId || "",
        quoteId: searchParams.get("quoteId") || fromRelated.quoteId || "",
        requestId: searchParams.get("requestId") || fromRelated.requestId || "",
        dueDate: searchParams.get("dueDate") || todayKey(),
        notes: searchParams.get("notes") || fromRelated.notes || "",
        lineItems: lineFromParams || fromRelated.lineItems,
        number: nextInvoiceNumber(listInvoices()),
      }),
    );
    setSelectedId(null);
    setEditing(true);
    setMode("compose");
    router.replace("/work/invoices", { scroll: false });
  }, [ready, searchParams, router]);

  const refresh = useCallback(() => setTick((v) => v + 1), []);

  const invoices = useMemo(() => {
    void tick;
    return listInvoices();
  }, [tick]);

  const selected = useMemo(
    () => invoices.find((row) => row.id === selectedId) ?? null,
    [invoices, selectedId],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return invoices.filter((row) => {
      const status = deriveInvoiceStatus(row, today);
      if (filter === "draft") {
        if (status !== "draft") return false;
      } else if (filter === "unpaid") {
        if (status !== "sent" && status !== "partial" && status !== "overdue") {
          return false;
        }
      } else if (filter === "overdue") {
        if (status !== "overdue") return false;
      } else if (filter === "paid") {
        if (status !== "paid") return false;
      } else if (filter === "month") {
        if (!(row.issueDate || "").startsWith(monthPrefix)) return false;
      }
      if (!q) return true;
      return [
        row.clientName,
        row.companyName,
        row.number,
        row.jobLabel,
        row.billingAddress,
        row.serviceAddress,
      ]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [invoices, filter, query, today, monthPrefix]);

  function flash(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 1400);
    refresh();
  }

  function deleteInvoice(id: string, clientName?: string) {
    const label = clientName?.trim() || "this invoice";
    if (!window.confirm(`Delete invoice for ${label}? This cannot be undone.`)) {
      return;
    }
    removeInvoice(id);
    if (selectedId === id || mode !== "list") {
      backToList();
    }
    flash("Invoice deleted");
  }

  function startNewInvoice(prefill?: Partial<InvoiceDraftFields>) {
    setDraft(
      emptyDraft({
        ...prefill,
        number: prefill?.number || nextInvoiceNumber(listInvoices()),
      }),
    );
    setSelectedId(null);
    setEditing(true);
    setMode("compose");
  }

  function openInvoice(id: string, edit = false) {
    const row = listInvoices().find((inv) => inv.id === id);
    if (!row) return;
    setSelectedId(id);
    setDraft(draftFromInvoice(row));
    setEditing(edit);
    setMode("view");
    setPayDate(todayKey());
    setPayAmount("");
    setPayMethod("cash");
    setPayNote("");
  }

  function backToList() {
    setMode("list");
    setSelectedId(null);
    setEditing(false);
  }

  function saveDocument() {
    if (saving) return;
    const clientName = draft.clientName.trim();
    if (!clientName) {
      flash("Add a client name");
      return;
    }
    setSaving(true);
    try {
      const totals = totalsFromDraft(draft);
      const lineItems = draft.lineItems.map((line) =>
        createLineItem({
          id: line.id,
          description: line.description,
          quantity: line.quantity,
          rate: line.rate,
        }),
      );
      if (mode === "compose" || !selected) {
        const row = createInvoice({
          clientName,
          companyName: draft.companyName.trim(),
          clientId: draft.clientId.trim(),
          billingAddress: draft.billingAddress.trim(),
          serviceAddress: draft.serviceAddress.trim(),
          jobLabel: draft.jobLabel.trim() || "Completed work",
          jobId: draft.jobId.trim(),
          quoteId: draft.quoteId.trim(),
          requestId: draft.requestId.trim(),
          lineItems,
          amount: totals.total,
          discount: Number(draft.discount) || 0,
          taxRate: Number(draft.taxRate) || 0,
          issueDate: draft.issueDate || today,
          dueDate: draft.dueDate || today,
          paymentTerms: draft.paymentTerms.trim(),
          notes: draft.notes.trim(),
          number:
            draft.number.trim() || nextInvoiceNumber(listInvoices()),
        });
        upsertInvoice(row);
        setSelectedId(row.id);
        setDraft(draftFromInvoice(row));
        setMode("view");
        setEditing(false);
        flash("Invoice saved");
      } else {
        const next: InvoiceDoc = {
          ...selected,
          clientName,
          companyName: draft.companyName.trim(),
          clientId: draft.clientId.trim(),
          billingAddress: draft.billingAddress.trim(),
          serviceAddress: draft.serviceAddress.trim(),
          jobLabel: draft.jobLabel.trim() || "Completed work",
          jobId: draft.jobId.trim(),
          quoteId: draft.quoteId.trim(),
          requestId: draft.requestId.trim(),
          lineItems,
          amount: totals.total,
          discount: Number(draft.discount) || 0,
          taxRate: Number(draft.taxRate) || 0,
          issueDate: draft.issueDate || selected.issueDate,
          dueDate: draft.dueDate || selected.dueDate,
          paymentTerms: draft.paymentTerms.trim(),
          notes: draft.notes.trim(),
          number: draft.number.trim() || selected.number,
          updatedAt: new Date().toISOString(),
        };
        upsertInvoice(next);
        setDraft(draftFromInvoice(next));
        setEditing(false);
        flash("Invoice updated");
      }
      refresh();
    } finally {
      setSaving(false);
    }
  }

  function printInvoice() {
    const root = document.querySelector(".quote-print-root");
    if (!root) {
      flash("Open an invoice first, then print");
      return;
    }
    window.print();
  }

  function markSent() {
    if (!selected || selected.status !== "draft") return;
    upsertInvoice({
      ...selected,
      status: "sent",
      updatedAt: new Date().toISOString(),
    });
    flash("Marked sent");
  }

  function markVoid() {
    if (!selected || selected.status === "draft" || selected.status === "void") {
      return;
    }
    upsertInvoice(voidInvoice(selected));
    flash("Invoice voided");
  }

  function addPayment() {
    if (!selected || selected.status === "void" || selected.status === "draft") {
      return;
    }
    const amount = Number(payAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      flash("Enter a payment amount");
      return;
    }
    const payment = createPayment({
      date: payDate || today,
      amount,
      method: payMethod,
      note: payNote,
    });
    const payments = [...selected.payments, payment];
    const withPayments: InvoiceDoc = { ...selected, payments };
    const totals = buildInvoiceTotals(withPayments);
    let status: InvoiceStatus = selected.status;
    if (totals.total > 0 && totals.amountPaid >= totals.total - 0.009) {
      status = "paid";
    } else if (totals.amountPaid > 0) {
      status = "partial";
    }
    const next: InvoiceDoc = {
      ...withPayments,
      status,
      updatedAt: new Date().toISOString(),
    };
    upsertInvoice(next);
    setDraft(draftFromInvoice(next));
    setPayAmount("");
    setPayNote("");
    flash("Payment recorded");
  }

  function patchLine(
    index: number,
    patch: Partial<InvoiceDraftFields["lineItems"][number]>,
  ) {
    setDraft((prev) => {
      const lineItems = prev.lineItems.map((line, i) =>
        i === index ? { ...line, ...patch } : line,
      );
      return { ...prev, lineItems };
    });
  }

  if (!ready) {
    return (
      <AppShell>
        <p className="hq-lede">Loading invoices…</p>
      </AppShell>
    );
  }

  const documentInvoice =
    mode === "compose"
      ? draftInvoiceShell(draft)
      : selected
        ? {
            ...selected,
            number: editing ? draft.number : selected.number,
            clientName: editing ? draft.clientName : selected.clientName,
            companyName: editing ? draft.companyName : selected.companyName,
            clientId: editing ? draft.clientId : selected.clientId,
            billingAddress: editing
              ? draft.billingAddress
              : selected.billingAddress,
            serviceAddress: editing
              ? draft.serviceAddress
              : selected.serviceAddress,
            jobLabel: editing ? draft.jobLabel : selected.jobLabel,
            jobId: editing ? draft.jobId : selected.jobId,
            quoteId: editing ? draft.quoteId : selected.quoteId,
            requestId: editing ? draft.requestId : selected.requestId,
            lineItems: editing ? draft.lineItems : selected.lineItems,
            discount: editing
              ? Number(draft.discount) || 0
              : selected.discount,
            taxRate: editing ? Number(draft.taxRate) || 0 : selected.taxRate,
            issueDate: editing ? draft.issueDate : selected.issueDate,
            dueDate: editing ? draft.dueDate : selected.dueDate,
            paymentTerms: editing ? draft.paymentTerms : selected.paymentTerms,
            notes: editing ? draft.notes : selected.notes,
          }
        : null;

  const showDocument =
    mode === "compose" || (mode === "view" && documentInvoice);

  return (
    <AppShell>
      {showDocument && documentInvoice ? (
        <div className="invoice-composer">
          <header className="invoice-composer-bar no-print">
            <div>
              <p className="hq-eyebrow">Work · Invoices</p>
              <h2>
                {mode === "compose"
                  ? "New invoice"
                  : editing
                    ? "Edit invoice"
                    : "Invoice document"}
              </h2>
              <p>
                Edit the official HES invoice, then print or save as PDF for
                your client.
              </p>
            </div>
            <div className="invoice-composer-actions">
              <button
                type="button"
                className="btn secondary"
                onClick={backToList}
              >
                All invoices
              </button>
              {!editing ? (
                <button
                  type="button"
                  className="btn secondary"
                  onClick={() => {
                    if (selected) setDraft(draftFromInvoice(selected));
                    setEditing(true);
                  }}
                >
                  Edit
                </button>
              ) : (
                <button
                  type="button"
                  className="btn secondary"
                  onClick={() => {
                    if (mode === "compose") {
                      backToList();
                      return;
                    }
                    if (selected) setDraft(draftFromInvoice(selected));
                    setEditing(false);
                  }}
                >
                  Cancel
                </button>
              )}
              {editing ? (
                <button
                  type="button"
                  className="btn primary"
                  disabled={saving}
                  onClick={saveDocument}
                >
                  {saving ? "Saving…" : "Save invoice"}
                </button>
              ) : null}
              <button
                type="button"
                className="btn primary"
                onClick={printInvoice}
              >
                Print / PDF
              </button>
              {selected && selected.status !== "draft" ? (
                <button
                  type="button"
                  className="btn secondary"
                  onClick={markVoid}
                  disabled={selected.status === "void"}
                >
                  Void
                </button>
              ) : null}
              {selected ? (
                <button
                  type="button"
                  className="btn danger"
                  onClick={() =>
                    deleteInvoice(selected.id, selected.clientName)
                  }
                >
                  Delete
                </button>
              ) : null}
            </div>
          </header>

          {selected && !editing ? (
            <div className="hunt-actions no-print quote-status-actions">
              {selected.status === "draft" ? (
                <button
                  type="button"
                  className="btn secondary small"
                  onClick={markSent}
                >
                  Mark sent
                </button>
              ) : null}
            </div>
          ) : null}

          {selected && !editing && selected.status !== "draft" && selected.status !== "void" ? (
            <div className="invoice-payment-panel no-print">
              <h3>Add payment</h3>
              <div className="invoice-payment-form">
                <label>
                  Date
                  <input
                    className="field"
                    type="date"
                    value={payDate}
                    onChange={(e) => setPayDate(e.target.value)}
                  />
                </label>
                <label>
                  Amount
                  <input
                    className="field"
                    type="number"
                    min={0}
                    step="0.01"
                    value={payAmount}
                    onChange={(e) => setPayAmount(e.target.value)}
                    placeholder="0"
                  />
                </label>
                <label>
                  Method
                  <select
                    className="field"
                    value={payMethod}
                    onChange={(e) =>
                      setPayMethod(e.target.value as InvoicePaymentMethod)
                    }
                  >
                    {INVOICE_PAYMENT_METHODS.map((method) => (
                      <option key={method.id} value={method.id}>
                        {method.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Note
                  <input
                    className="field"
                    value={payNote}
                    onChange={(e) => setPayNote(e.target.value)}
                    placeholder="Optional"
                  />
                </label>
                <button
                  type="button"
                  className="btn primary small"
                  onClick={addPayment}
                >
                  Record payment
                </button>
              </div>
            </div>
          ) : null}

          <div className="quote-print-root quote-composer-stage">
            <InvoiceDocument
              invoice={documentInvoice}
              editable={editing || mode === "compose"}
              draft={draft}
              onDraftChange={(patch) =>
                setDraft((prev) => ({ ...prev, ...patch }))
              }
              onLineChange={patchLine}
              onAddLine={() =>
                setDraft((prev) => ({
                  ...prev,
                  lineItems: [
                    ...prev.lineItems,
                    createLineItem({ description: "Service", quantity: 1, rate: 0 }),
                  ],
                }))
              }
              onRemoveLine={(index) =>
                setDraft((prev) => ({
                  ...prev,
                  lineItems:
                    prev.lineItems.length <= 1
                      ? prev.lineItems
                      : prev.lineItems.filter((_, i) => i !== index),
                }))
              }
            />
          </div>
        </div>
      ) : (
        <div className="invoices-page">
          <div className="invoices-main no-print">
            <header className="page-intro">
              <div>
                <p className="hq-eyebrow">Work · Invoices</p>
                <h2>Invoices</h2>
                <p>
                  Open the official HES invoice — edit it, print it, or record
                  payments as they come in.
                </p>
              </div>
              <div className="jobs-intro-actions">
                <Link href="/work" className="btn secondary">
                  Work home
                </Link>
                <button
                  type="button"
                  className="btn primary"
                  onClick={() => startNewInvoice()}
                >
                  New invoice
                </button>
              </div>
            </header>

            <div className="invoices-toolbar">
              <input
                className="field"
                type="search"
                placeholder="Search client, company, number, job, address…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-label="Search invoices"
              />
              <div
                className="invoices-filters"
                role="tablist"
                aria-label="Invoice filters"
              >
                {STATUS_FILTERS.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    role="tab"
                    aria-selected={filter === item.id}
                    className={`btn secondary small${filter === item.id ? " is-active" : ""}`}
                    onClick={() => setFilter(item.id)}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            <section
              className="panel invoices-list-panel"
              aria-label="Invoice list"
            >
              {!filtered.length ? (
                <p className="empty-state">
                  No invoices here.{" "}
                  <button
                    type="button"
                    className="btn primary small"
                    onClick={() => startNewInvoice()}
                  >
                    Create first invoice
                  </button>
                </p>
              ) : (
                <ul className="invoices-list">
                  {filtered.map((row) => {
                    const status = deriveInvoiceStatus(row, today);
                    const totals = buildInvoiceTotals(row);
                    return (
                      <li key={row.id} className="invoices-list-item">
                        <button
                          type="button"
                          className="invoices-row"
                          onClick={() => openInvoice(row.id)}
                        >
                          <div className="invoices-row-main">
                            <strong>
                              {row.number || "Invoice"} · {row.clientName}
                            </strong>
                            <span className={`status-chip status-${status}`}>
                              {INVOICE_STATUS_LABELS[status]}
                            </span>
                          </div>
                          <p>{row.jobLabel || "Completed work"}</p>
                          <p className="invoices-row-meta">
                            {[
                              `Issued ${row.issueDate || "—"}`,
                              `Due ${row.dueDate || "—"}`,
                              `Total ${formatInvoiceMoney(totals.total)}`,
                              `Paid ${formatInvoiceMoney(totals.amountPaid)}`,
                              `Balance ${formatInvoiceMoney(totals.balanceDue)}`,
                            ].join(" · ")}
                          </p>
                        </button>
                        <button
                          type="button"
                          className="btn danger small invoices-row-delete"
                          aria-label={`Delete invoice for ${row.clientName}`}
                          onClick={(event) => {
                            event.stopPropagation();
                            deleteInvoice(row.id, row.clientName);
                          }}
                        >
                          Delete
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </div>
        </div>
      )}

      {toast ? (
        <p className="toast no-print" role="status">
          {toast}
        </p>
      ) : null}
    </AppShell>
  );
}
