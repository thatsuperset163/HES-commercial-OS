"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { todayKey } from "@/lib/dates";
import {
  buildRequestQuoteSync,
  formatQuoteStatus,
  nextQuoteNumber,
  quoteFollowUpDate,
  quoteKindLabel,
} from "@/lib/quotes/model";
import { formatQuoteMoney } from "@/lib/quotes/template";
import {
  advanceQuoteStatus,
  createQuote,
  markQuoteLost,
  workUid,
} from "@/lib/work/model";
import type { QuoteDoc, QuoteKind, QuoteStatus } from "@/lib/work/types";
import {
  hydrateStoreFromCloud,
  listClients,
  listQuotes,
  removeQuote,
  upsertQuote,
} from "@/lib/storage";
import AppShell from "@/app/AppShell";
import QuoteDocument, {
  type QuoteDraftFields,
} from "@/app/quotes/QuoteDocument";
import "@/app/quotes/quote-document.css";
import "@/app/quotes/quotes-os.css";

const STATUS_FILTERS: { id: "open" | "all" | QuoteStatus; label: string }[] = [
  { id: "open", label: "Open" },
  { id: "draft", label: "Draft" },
  { id: "sent", label: "Sent" },
  { id: "won", label: "Won" },
  { id: "lost", label: "Lost" },
  { id: "all", label: "All" },
];

type ComposeLinks = {
  requestId: string;
  clientId: string;
  companyName: string;
  phone: string;
  email: string;
  billingAddress: string;
  quoteKind: QuoteKind;
  /** Stable id reserved for this compose session — not persisted until Save. */
  reservedId: string;
};

function emptyDraft(prefill?: Partial<QuoteDraftFields>): QuoteDraftFields {
  return {
    clientName: prefill?.clientName ?? "",
    address: prefill?.address ?? "",
    scope: prefill?.scope ?? "Exterior cleaning",
    amount: prefill?.amount ?? "",
    notes: prefill?.notes ?? "",
    followUpDate: prefill?.followUpDate ?? todayKey(),
  };
}

function draftFromQuote(quote: QuoteDoc): QuoteDraftFields {
  return {
    clientName: quote.clientName,
    address: quote.address,
    scope: quote.scope,
    amount: quote.amount == null ? "" : String(quote.amount),
    notes: quote.notes,
    followUpDate: quote.followUpDate || todayKey(),
  };
}

function draftQuoteShell(
  draft: QuoteDraftFields,
  links: ComposeLinks | null,
): QuoteDoc {
  const now = new Date().toISOString();
  return {
    id: links?.reservedId || "draft-new",
    number: "",
    clientName: draft.clientName || "Client",
    companyName: links?.companyName || "",
    clientId: links?.clientId || "",
    requestId: links?.requestId || "",
    jobId: "",
    invoiceId: "",
    phone: links?.phone || "",
    email: links?.email || "",
    address: draft.address,
    billingAddress: links?.billingAddress || draft.address,
    scope: draft.scope,
    amount: draft.amount === "" ? null : Number(draft.amount),
    status: "draft",
    followUpDate: draft.followUpDate || todayKey(),
    sentAt: "",
    quoteKind: links?.quoteKind || "primary",
    notes: draft.notes,
    createdAt: now,
    updatedAt: now,
  };
}

function parseQuoteKind(raw: string | null): QuoteKind {
  if (raw === "revised" || raw === "alternate" || raw === "additional") {
    return raw;
  }
  return "primary";
}

async function patchIntakeRequest(
  requestId: string,
  body: Record<string, unknown>,
): Promise<void> {
  const res = await fetch(`/api/requests/${requestId}`, {
    method: "PATCH",
    credentials: "same-origin",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const json = (await res.json()) as {
    ok: boolean;
    error?: { message?: string };
  };
  if (!res.ok || !json.ok) {
    throw new Error(json.error?.message || `Request update failed (${res.status})`);
  }
}

export default function QuotesApp() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [ready, setReady] = useState(false);
  const [tick, setTick] = useState(0);
  const [filter, setFilter] = useState<(typeof STATUS_FILTERS)[number]["id"]>("open");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mode, setMode] = useState<"list" | "compose" | "view">("list");
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<QuoteDraftFields>(() => emptyDraft());
  const [composeLinks, setComposeLinks] = useState<ComposeLinks | null>(null);
  const [toast, setToast] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const today = todayKey();
  const bootstrapped = useRef(false);
  const lastSyncKey = useRef<string>("");

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

  // Create → Quote / Request → Quote lands here with ?new=1 (optional prefill).
  // Opening compose never persists a quote.
  useEffect(() => {
    if (!ready || bootstrapped.current) return;
    const openId = searchParams.get("id");
    const isNew = searchParams.get("new") === "1";

    if (openId) {
      bootstrapped.current = true;
      const row = listQuotes().find((q) => q.id === openId);
      if (row) {
        setSelectedId(openId);
        setDraft(draftFromQuote(row));
        setComposeLinks(null);
        setEditing(searchParams.get("edit") === "1");
        setMode("view");
      }
      router.replace("/work/quotes", { scroll: false });
      return;
    }

    if (!isNew) return;
    bootstrapped.current = true;

    const requestId = searchParams.get("requestId") || "";
    const clientId = searchParams.get("clientId") || "";
    const quoteKind = parseQuoteKind(searchParams.get("quoteKind"));

    // Existing-quote protection: if this request already has a primary quote
    // and this is not an intentional additional quote, open the existing one.
    if (requestId && quoteKind === "primary" && searchParams.get("forceNew") !== "1") {
      const existing = listQuotes().find(
        (q) => q.requestId === requestId && q.quoteKind === "primary",
      );
      if (existing) {
        setSelectedId(existing.id);
        setDraft(draftFromQuote(existing));
        setComposeLinks(null);
        setEditing(false);
        setMode("view");
        setToast("This request already has a quote — opened existing");
        window.setTimeout(() => setToast(""), 1800);
        router.replace("/work/quotes", { scroll: false });
        return;
      }
    }

    setComposeLinks({
      requestId,
      clientId,
      companyName: searchParams.get("companyName") || "",
      phone: searchParams.get("phone") || "",
      email: searchParams.get("email") || "",
      billingAddress:
        searchParams.get("billingAddress") ||
        searchParams.get("address") ||
        "",
      quoteKind,
      reservedId: workUid("quote"),
    });
    setDraft(
      emptyDraft({
        clientName: searchParams.get("clientName") || "",
        address: searchParams.get("address") || "",
        scope: searchParams.get("scope") || "Exterior cleaning",
        amount: searchParams.get("amount") || "",
        notes: searchParams.get("notes") || "",
        followUpDate: searchParams.get("followUpDate") || todayKey(),
      }),
    );
    setSelectedId(null);
    setEditing(true);
    setMode("compose");
    router.replace("/work/quotes", { scroll: false });
  }, [ready, searchParams, router]);

  const refresh = useCallback(() => setTick((v) => v + 1), []);

  const quotes = useMemo(() => {
    void tick;
    return listQuotes();
  }, [tick]);

  const selected = useMemo(
    () => quotes.find((q) => q.id === selectedId) ?? null,
    [quotes, selectedId],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return quotes.filter((row) => {
      if (filter === "open") {
        if (row.status !== "draft" && row.status !== "sent") return false;
      } else if (filter !== "all" && row.status !== filter) {
        return false;
      }
      if (!q) return true;
      return [
        row.clientName,
        row.companyName,
        row.address,
        row.scope,
        row.notes,
        row.number,
        row.id,
        row.requestId,
      ]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [quotes, filter, query]);

  function flash(message: string) {
    setToast(message);
    setError("");
    window.setTimeout(() => setToast(""), 1600);
    refresh();
  }

  async function syncRequestFromQuote(
    event: "created" | "saved" | "sent" | "won" | "lost" | "job_created",
    quote: QuoteDoc,
  ) {
    if (!quote.requestId.trim()) return;
    const syncKey = `${event}:${quote.id}:${quote.status}`;
    if (lastSyncKey.current === syncKey && event !== "created") return;

    const res = await fetch(`/api/requests/${quote.requestId}`, {
      credentials: "same-origin",
      headers: { Accept: "application/json" },
    });
    const json = (await res.json()) as {
      ok: boolean;
      data?: { request: {
        id: string;
        status: import("@/lib/requestsCenter/types").IntakeStatus;
        convertedQuoteId: string | null;
        linkedClientId: string | null;
        convertedJobId: string | null;
        waitingReason: string;
        followUpDate: string | null;
      } };
      error?: { message?: string };
    };
    if (!res.ok || !json.ok || !json.data?.request) {
      throw new Error(json.error?.message || "Could not load request for sync");
    }

    const patch = buildRequestQuoteSync({
      event,
      request: json.data.request,
      quote,
      today,
    });
    if (!patch) return;

    const { activityType, activityBody, activityMeta, ...fields } = patch;
    await patchIntakeRequest(quote.requestId, {
      ...fields,
      activityType,
      activityBody,
      ...(activityMeta ? { activityMeta } : {}),
    });
    lastSyncKey.current = syncKey;
  }

  function deleteQuote(id: string, clientName?: string) {
    const label = clientName?.trim() || "this quote";
    if (!window.confirm(`Delete quote for ${label}? This cannot be undone.`)) {
      return;
    }
    removeQuote(id);
    if (selectedId === id || mode !== "list") {
      backToList();
    }
    flash("Quote deleted");
  }

  function startNewQuote(prefill?: Partial<QuoteDraftFields>) {
    setComposeLinks(null);
    setDraft(emptyDraft(prefill));
    setSelectedId(null);
    setEditing(true);
    setMode("compose");
  }

  function openQuote(id: string, edit = false) {
    const row = listQuotes().find((q) => q.id === id);
    if (!row) return;
    setSelectedId(id);
    setDraft(draftFromQuote(row));
    setComposeLinks(null);
    setEditing(edit);
    setMode("view");
  }

  function backToList() {
    setMode("list");
    setSelectedId(null);
    setEditing(false);
    setComposeLinks(null);
    setError("");
  }

  async function saveDocument() {
    if (saving) return;
    const clientName = draft.clientName.trim();
    if (!clientName) {
      flash("Add a client name");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const amount =
        draft.amount.trim() === "" ? null : Number(draft.amount);
      if (mode === "compose" || !selected) {
        const existingById = composeLinks?.reservedId
          ? listQuotes().find((q) => q.id === composeLinks.reservedId)
          : null;
        if (existingById) {
          // Idempotent retry — quote already stored for this compose session.
          setSelectedId(existingById.id);
          setDraft(draftFromQuote(existingById));
          setMode("view");
          setEditing(false);
          setComposeLinks(null);
          flash("Quote already saved");
          return;
        }

        const row = createQuote({
          id: composeLinks?.reservedId,
          number: nextQuoteNumber(listQuotes()),
          clientName,
          companyName: composeLinks?.companyName,
          clientId: composeLinks?.clientId,
          requestId: composeLinks?.requestId,
          phone: composeLinks?.phone,
          email: composeLinks?.email,
          address: draft.address.trim(),
          billingAddress:
            composeLinks?.billingAddress || draft.address.trim(),
          scope: draft.scope.trim() || "Exterior cleaning",
          amount,
          followUpDate: draft.followUpDate || today,
          notes: draft.notes.trim(),
          quoteKind: composeLinks?.quoteKind || "primary",
        });
        upsertQuote(row);
        try {
          await syncRequestFromQuote("created", row);
        } catch (err) {
          setError(
            err instanceof Error
              ? `Quote saved locally, but request link failed: ${err.message}`
              : "Quote saved locally, but request link failed",
          );
        }
        setSelectedId(row.id);
        setDraft(draftFromQuote(row));
        setMode("view");
        setEditing(false);
        setComposeLinks(null);
        flash("Quote saved");
      } else {
        const next: QuoteDoc = {
          ...selected,
          clientName,
          address: draft.address.trim(),
          scope: draft.scope.trim() || "Exterior cleaning",
          amount,
          followUpDate: draft.followUpDate || selected.followUpDate,
          notes: draft.notes.trim(),
          updatedAt: new Date().toISOString(),
        };
        upsertQuote(next);
        // Re-saves do not mint duplicate request activity (sync skips).
        try {
          await syncRequestFromQuote("saved", next);
        } catch {
          /* non-fatal on update */
        }
        setDraft(draftFromQuote(next));
        setEditing(false);
        flash("Quote updated");
      }
      refresh();
    } finally {
      setSaving(false);
    }
  }

  async function markStatus(
    nextStatus: "sent" | "won" | "lost",
  ) {
    if (!selected || saving) return;
    setSaving(true);
    setError("");
    try {
      let next = selected;
      if (nextStatus === "lost") {
        next = markQuoteLost(selected);
      } else if (nextStatus === "sent" && selected.status === "draft") {
        next = {
          ...advanceQuoteStatus(selected),
          followUpDate: selected.followUpDate || quoteFollowUpDate(today, 3),
        };
      } else if (nextStatus === "won" && selected.status === "sent") {
        next = advanceQuoteStatus(selected);
      } else {
        return;
      }
      upsertQuote(next);
      try {
        await syncRequestFromQuote(
          nextStatus === "sent" ? "sent" : nextStatus === "won" ? "won" : "lost",
          next,
        );
      } catch (err) {
        setError(
          err instanceof Error
            ? `Quote updated, request sync failed: ${err.message}`
            : "Quote updated, request sync failed",
        );
      }
      flash(
        nextStatus === "sent"
          ? "Marked sent"
          : nextStatus === "won"
            ? "Marked approved"
            : "Marked declined",
      );
    } finally {
      setSaving(false);
    }
  }

  function createJobFromQuote() {
    if (!selected) return;
    if (selected.status !== "won") {
      flash("Approve the quote before creating a job");
      return;
    }
    if (selected.jobId) {
      window.location.assign(`/work/jobs?id=${encodeURIComponent(selected.jobId)}`);
      return;
    }
    if (
      !window.confirm(
        "Create a job from this approved quote? You’ll confirm details on the job form before it is saved.",
      )
    ) {
      return;
    }
    const params = new URLSearchParams({ new: "1" });
    params.set("quoteId", selected.id);
    if (selected.clientId) params.set("clientId", selected.clientId);
    if (selected.requestId) params.set("requestId", selected.requestId);
    params.set("customerName", selected.clientName);
    if (selected.companyName) params.set("companyName", selected.companyName);
    if (selected.phone) params.set("phone", selected.phone);
    if (selected.email) params.set("email", selected.email);
    if (selected.address) params.set("address", selected.address);
    params.set("service", selected.scope || "Exterior cleaning");
    params.set("description", selected.scope || "");
    if (selected.amount != null) params.set("amount", String(selected.amount));
    if (selected.notes) params.set("notes", selected.notes);
    window.location.assign(`/work/jobs?${params.toString()}`);
  }

  function printQuote() {
    const root = document.querySelector(".quote-print-root");
    if (!root) {
      flash("Open a quote first, then print");
      return;
    }
    window.print();
  }

  if (!ready) {
    return (
      <AppShell>
        <p className="hq-lede">Loading quotes…</p>
      </AppShell>
    );
  }

  const documentQuote =
    mode === "compose"
      ? draftQuoteShell(draft, composeLinks)
      : selected
        ? {
            ...selected,
            clientName: editing ? draft.clientName : selected.clientName,
            address: editing ? draft.address : selected.address,
            scope: editing ? draft.scope : selected.scope,
            amount:
              editing
                ? draft.amount.trim() === ""
                  ? null
                  : Number(draft.amount)
                : selected.amount,
            notes: editing ? draft.notes : selected.notes,
          }
        : null;

  const showDocument = mode === "compose" || (mode === "view" && documentQuote);
  const linkedClient =
    (selected?.clientId || composeLinks?.clientId)
      ? listClients().find(
          (c) => c.id === (selected?.clientId || composeLinks?.clientId),
        )
      : null;
  const requestId = selected?.requestId || composeLinks?.requestId || "";

  return (
    <AppShell>
      {showDocument && documentQuote ? (
        <div className="quote-composer">
          <header className="quote-composer-bar no-print">
            <div>
              <p className="hq-eyebrow">Work · Quotes</p>
              <h2>
                {mode === "compose"
                  ? composeLinks?.quoteKind && composeLinks.quoteKind !== "primary"
                    ? `New ${quoteKindLabel(composeLinks.quoteKind).toLowerCase()}`
                    : "New quote"
                  : editing
                    ? "Edit quote"
                    : "Quote document"}
              </h2>
              <p>
                Edit the official HES template, then print or save as PDF for
                your client to sign.
              </p>
              {requestId || selected?.clientId || composeLinks?.clientId ? (
                <p className="quote-link-row">
                  {requestId ? (
                    <>
                      <span className="status-chip">Created from Request</span>{" "}
                      <Link href={`/work/requests?id=${encodeURIComponent(requestId)}`}>
                        Open request
                      </Link>
                    </>
                  ) : null}
                  {selected?.clientId || composeLinks?.clientId ? (
                    <>
                      {requestId ? " · " : null}
                      <Link
                        href={`/work/clients?id=${encodeURIComponent(selected?.clientId || composeLinks?.clientId || "")}`}
                      >
                        {linkedClient?.name || "Client"}
                      </Link>
                    </>
                  ) : null}
                  {selected ? (
                    <>
                      {" · "}
                      <span className={`status-chip status-${selected.status}`}>
                        {formatQuoteStatus(selected.status)}
                      </span>
                      {selected.number ? ` · ${selected.number}` : null}
                    </>
                  ) : null}
                </p>
              ) : selected && !selected.requestId ? (
                <p className="quote-link-row">
                  <span className="status-chip">Legacy quote</span>
                  {" · No request link — relationships use IDs when available"}
                </p>
              ) : null}
            </div>
            <div className="quote-composer-actions">
              <button
                type="button"
                className="btn secondary"
                onClick={backToList}
              >
                All quotes
              </button>
              {!editing ? (
                <button
                  type="button"
                  className="btn secondary"
                  onClick={() => {
                    if (selected) setDraft(draftFromQuote(selected));
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
                    if (selected) setDraft(draftFromQuote(selected));
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
                  onClick={() => void saveDocument()}
                >
                  {saving ? "Saving…" : "Save quote"}
                </button>
              ) : null}
              <button
                type="button"
                className="btn primary"
                onClick={printQuote}
              >
                Print / PDF
              </button>
              {selected?.status === "won" ? (
                <button
                  type="button"
                  className="btn success"
                  disabled={saving}
                  onClick={createJobFromQuote}
                >
                  {selected.jobId ? "View job" : "Create Job"}
                </button>
              ) : null}
              {selected ? (
                <button
                  type="button"
                  className="btn secondary"
                  onClick={() => {
                    const params = new URLSearchParams({
                      new: "1",
                      quoteId: selected.id,
                      clientName: selected.clientName,
                      serviceAddress: selected.address,
                      billingAddress:
                        selected.billingAddress || selected.address,
                      scope: selected.scope,
                      amount:
                        selected.amount == null ? "" : String(selected.amount),
                      notes: selected.notes,
                    });
                    if (selected.clientId) params.set("clientId", selected.clientId);
                    if (selected.requestId) {
                      params.set("requestId", selected.requestId);
                    }
                    window.location.assign(
                      `/work/invoices?${params.toString()}`,
                    );
                  }}
                >
                  Create invoice
                </button>
              ) : null}
              {selected ? (
                <button
                  type="button"
                  className="btn danger"
                  onClick={() => deleteQuote(selected.id, selected.clientName)}
                >
                  Delete
                </button>
              ) : null}
            </div>
          </header>

          {error ? (
            <p className="empty-state no-print" role="alert">
              {error}
            </p>
          ) : null}

          {selected && !editing ? (
            <div className="hunt-actions no-print quote-status-actions">
              {selected.status === "draft" ? (
                <button
                  type="button"
                  className="btn secondary small"
                  disabled={saving}
                  onClick={() => void markStatus("sent")}
                >
                  Mark sent
                </button>
              ) : null}
              {selected.status === "sent" ? (
                <>
                  <button
                    type="button"
                    className="btn success small"
                    disabled={saving}
                    onClick={() => void markStatus("won")}
                  >
                    Mark approved
                  </button>
                  <button
                    type="button"
                    className="btn secondary small"
                    disabled={saving}
                    onClick={() => void markStatus("lost")}
                  >
                    Mark declined
                  </button>
                </>
              ) : null}
            </div>
          ) : null}

          <div className="quote-print-root quote-composer-stage">
            <QuoteDocument
              quote={documentQuote}
              editable={editing || mode === "compose"}
              draft={draft}
              onDraftChange={(patch) =>
                setDraft((prev) => ({ ...prev, ...patch }))
              }
            />
          </div>
        </div>
      ) : (
        <div className="quotes-page">
          <div className="quotes-main no-print">
            <header className="page-intro">
              <div>
                <p className="hq-eyebrow">Work · Quotes</p>
                <h2>Quotes</h2>
                <p>
                  Open the official HES quote page — edit it, print it, or save
                  a PDF for clients to sign.
                </p>
              </div>
              <div className="jobs-intro-actions">
                <Link href="/work" className="btn secondary">
                  Work home
                </Link>
                <button
                  type="button"
                  className="btn primary"
                  onClick={() => startNewQuote()}
                >
                  New quote
                </button>
              </div>
            </header>

            <div className="quotes-toolbar">
              <input
                className="field"
                type="search"
                placeholder="Search client, address, scope…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-label="Search quotes"
              />
              <div
                className="quotes-filters"
                role="tablist"
                aria-label="Quote filters"
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

            <section className="panel quotes-list-panel" aria-label="Quote list">
              {!filtered.length ? (
                <p className="empty-state">
                  No quotes here.{" "}
                  <button
                    type="button"
                    className="btn primary small"
                    onClick={() => startNewQuote()}
                  >
                    Create first quote
                  </button>
                </p>
              ) : (
                <ul className="quotes-list">
                  {filtered.map((row) => (
                    <li key={row.id} className="quotes-list-item">
                      <button
                        type="button"
                        className="quotes-row"
                        onClick={() => openQuote(row.id)}
                      >
                        <div className="quotes-row-main">
                          <strong>{row.clientName}</strong>
                          <span className={`status-chip status-${row.status}`}>
                            {formatQuoteStatus(row.status)}
                          </span>
                        </div>
                        <p>{row.scope || "Exterior cleaning"}</p>
                        <p className="quotes-row-meta">
                          {[
                            row.number,
                            formatQuoteMoney(row.amount),
                            row.address,
                            row.requestId ? "From request" : "",
                            row.followUpDate
                              ? `Follow up ${row.followUpDate}`
                              : "",
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      </button>
                      <button
                        type="button"
                        className="btn danger small quotes-row-delete"
                        aria-label={`Delete quote for ${row.clientName}`}
                        onClick={(event) => {
                          event.stopPropagation();
                          deleteQuote(row.id, row.clientName);
                        }}
                      >
                        Delete
                      </button>
                    </li>
                  ))}
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
