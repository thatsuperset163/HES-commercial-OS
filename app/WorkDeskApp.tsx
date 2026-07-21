"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { formatDisplayDate, todayKey } from "@/lib/dates";
import { resolveClient } from "@/lib/clients/resolver";
import { getWorkDesk, statusLabel } from "@/lib/work/catalog";
import {
  advanceClientStatus,
  advanceExpenseStatus,
  advanceInvoiceStatus,
  advanceQuoteStatus,
  advanceRequestStatus,
  advanceTaskStatus,
  createExpense,
  createInvoice,
  createQuote,
  createRequest,
  createTask,
  findOrCreateClient,
  markQuoteLost,
} from "@/lib/work/model";
import type { WorkDeskId } from "@/lib/work/types";
import {
  hydrateStoreFromCloud,
  listClients,
  listExpenses,
  listInvoices,
  listQuotes,
  listRequests,
  listTasks,
  removeClient,
  removeExpense,
  removeInvoice,
  removeQuote,
  removeRequest,
  removeTask,
  upsertClient,
  upsertExpense,
  upsertInvoice,
  upsertQuote,
  upsertRequest,
  upsertTask,
} from "@/lib/storage";
import AppShell from "./AppShell";

function money(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "";
  return `$${Math.round(value).toLocaleString("en-US")}`;
}

function primaryAdvanceLabel(deskId: WorkDeskId, status: string): string | null {
  if (deskId === "clients") return status === "active" ? "Pause" : "Activate";
  if (deskId === "requests") {
    if (status === "new") return "Mark contacted";
    if (status === "contacted") return "Mark quoted";
    if (status === "quoted") return "Close";
    return null;
  }
  if (deskId === "tasks") return status === "open" ? "Mark done" : null;
  if (deskId === "quotes") {
    if (status === "draft") return "Mark sent";
    if (status === "sent") return "Mark won";
    return null;
  }
  if (deskId === "invoices") {
    if (status === "draft") return "Mark sent";
    if (status === "sent" || status === "overdue") return "Mark paid";
    return null;
  }
  if (deskId === "expenses") return status === "logged" ? "Mark paid" : null;
  return null;
}

type Row = {
  id: string;
  title: string;
  subtitle: string;
  meta: string;
  status: string;
  raw: unknown;
};

export default function WorkDeskApp({ deskId }: { deskId: WorkDeskId }) {
  const desk = getWorkDesk(deskId);
  const [ready, setReady] = useState(false);
  const [toast, setToast] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [tick, setTick] = useState(0);
  const today = todayKey();

  useEffect(() => {
    let cancelled = false;
    void hydrateStoreFromCloud().then(() => {
      if (cancelled) return;
      setTick((value) => value + 1);
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const refresh = useCallback(() => setTick((value) => value + 1), []);

  const rows: Row[] = useMemo(() => {
    void tick;
    if (deskId === "clients") {
      return listClients().map((row) => ({
        id: row.id,
        title: row.name,
        subtitle: [row.phone, row.address].filter(Boolean).join(" · "),
        meta: row.email || row.notes,
        status: row.status,
        raw: row,
      }));
    }
    if (deskId === "requests") {
      return listRequests().map((row) => ({
        id: row.id,
        title: row.clientName,
        subtitle: row.summary,
        meta: row.phone || row.notes,
        status: row.status,
        raw: row,
      }));
    }
    if (deskId === "tasks") {
      return listTasks().map((row) => ({
        id: row.id,
        title: row.title,
        subtitle: `Due ${row.dueDate}`,
        meta: row.notes,
        status: row.status,
        raw: row,
      }));
    }
    if (deskId === "quotes") {
      return listQuotes().map((row) => ({
        id: row.id,
        title: row.clientName,
        subtitle: row.scope,
        meta: [money(row.amount), row.address, `Follow up ${row.followUpDate}`]
          .filter(Boolean)
          .join(" · "),
        status: row.status,
        raw: row,
      }));
    }
    if (deskId === "invoices") {
      return listInvoices().map((row) => ({
        id: row.id,
        title: row.clientName,
        subtitle: row.jobLabel,
        meta: [money(row.amount), `Due ${row.dueDate}`].filter(Boolean).join(" · "),
        status: row.status,
        raw: row,
      }));
    }
    return listExpenses().map((row) => ({
      id: row.id,
      title: row.vendor,
      subtitle: row.category,
      meta: [money(row.amount), row.date].filter(Boolean).join(" · "),
      status: row.status,
      raw: row,
    }));
  }, [deskId, tick]);

  const openRows = useMemo(() => {
    return rows.filter((row) => {
      if (deskId === "clients") return row.status === "active";
      if (deskId === "tasks") return row.status === "open";
      if (deskId === "requests") return row.status !== "closed";
      if (deskId === "quotes") return row.status === "draft" || row.status === "sent";
      if (deskId === "invoices") {
        return row.status !== "paid" && row.status !== "void";
      }
      if (deskId === "expenses") return row.status === "logged";
      return true;
    });
  }, [rows, deskId]);

  function flash() {
    setToast(true);
    window.setTimeout(() => setToast(false), 900);
    refresh();
  }

  function onCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fd = new FormData(event.currentTarget);
    const str = (key: string) => String(fd.get(key) || "");
    const amountRaw = str("amount").trim();
    const amount = amountRaw === "" ? null : Number(amountRaw);

    if (deskId === "clients") {
      const { client } = findOrCreateClient(
        listClients(),
        {
          name: str("name"),
          phone: str("phone"),
          email: str("email"),
          address: str("address"),
          notes: str("notes"),
        },
        "work_desk_clients",
      );
      upsertClient(client);
    } else if (deskId === "requests") {
      const resolved = resolveClient(listClients(), {
        identity: {
          name: str("clientName"),
          phone: str("phone"),
        },
      });
      upsertRequest(
        createRequest({
          clientName: str("clientName"),
          clientId:
            resolved.status === "resolved" ? resolved.client.id : "",
          summary: str("summary"),
          phone: str("phone"),
          notes: str("notes"),
        }),
      );
    } else if (deskId === "tasks") {
      upsertTask(
        createTask({
          title: str("title"),
          dueDate: str("dueDate") || today,
          notes: str("notes"),
        }),
      );
    } else if (deskId === "quotes") {
      const resolved = resolveClient(listClients(), {
        identity: {
          name: str("clientName"),
          address: str("address"),
        },
      });
      upsertQuote(
        createQuote({
          clientName: str("clientName"),
          clientId:
            resolved.status === "resolved" ? resolved.client.id : "",
          address: str("address"),
          scope: str("scope"),
          amount,
          followUpDate: str("followUpDate") || today,
          notes: str("notes"),
        }),
      );
    } else if (deskId === "invoices") {
      const resolved = resolveClient(listClients(), {
        identity: { name: str("clientName") },
      });
      upsertInvoice(
        createInvoice({
          clientName: str("clientName"),
          clientId:
            resolved.status === "resolved" ? resolved.client.id : "",
          jobLabel: str("jobLabel"),
          amount,
          dueDate: str("dueDate") || today,
          notes: str("notes"),
        }),
      );
    } else {
      upsertExpense(
        createExpense({
          vendor: str("vendor"),
          category: str("category"),
          amount,
          date: str("date") || today,
          notes: str("notes"),
        }),
      );
    }

    setShowNew(false);
    event.currentTarget.reset();
    flash();
  }

  function advance(row: Row) {
    if (deskId === "clients") {
      upsertClient(advanceClientStatus(row.raw as never));
    } else if (deskId === "requests") {
      upsertRequest(advanceRequestStatus(row.raw as never));
    } else if (deskId === "tasks") {
      upsertTask(advanceTaskStatus(row.raw as never));
    } else if (deskId === "quotes") {
      upsertQuote(advanceQuoteStatus(row.raw as never));
    } else if (deskId === "invoices") {
      upsertInvoice(advanceInvoiceStatus(row.raw as never));
    } else {
      upsertExpense(advanceExpenseStatus(row.raw as never));
    }
    flash();
  }

  function remove(row: Row) {
    if (deskId === "clients") removeClient(row.id);
    else if (deskId === "requests") removeRequest(row.id);
    else if (deskId === "tasks") removeTask(row.id);
    else if (deskId === "quotes") removeQuote(row.id);
    else if (deskId === "invoices") removeInvoice(row.id);
    else removeExpense(row.id);
    flash();
  }

  if (!ready) {
    return (
      <AppShell>
        <p className="brand-sub">Loading {desk.name}…</p>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="page-intro">
        <div>
          <p className="hq-eyebrow">Work · {desk.name}</p>
          <h2>{formatDisplayDate(today)}</h2>
          <p>{desk.purpose}</p>
        </div>
        <div className="jobs-intro-actions">
          <Link href="/work" className="btn secondary">
            Work home
          </Link>
          <button
            type="button"
            className="btn primary"
            onClick={() => setShowNew(true)}
          >
            {desk.addLabel}
          </button>
        </div>
      </div>

      <section className="panel focus-panel jobs-focus">
        <div className="panel-head">
          <h2 className="panel-title">Open {desk.name.toLowerCase()}</h2>
          <span className="panel-meta">
            {openRows.length} active · {rows.length} total
          </span>
        </div>
        {openRows.length ? (
          <ul className="jobs-list">
            {openRows.map((row) => {
              const action = primaryAdvanceLabel(deskId, row.status);
              return (
                <li key={row.id} className="jobs-row">
                  <div className="jobs-row-main">
                    <strong>{row.title}</strong>
                    <p>{row.subtitle}</p>
                    {row.meta ? <p className="jobs-focus-meta">{row.meta}</p> : null}
                    <span className="jobs-status">{statusLabel(row.status)}</span>
                  </div>
                  <div className="jobs-row-actions">
                    {action ? (
                      <button
                        type="button"
                        className="btn primary small"
                        onClick={() => advance(row)}
                      >
                        {action}
                      </button>
                    ) : null}
                    {deskId === "quotes" && row.status === "sent" ? (
                      <button
                        type="button"
                        className="btn secondary small"
                        onClick={() => {
                          upsertQuote(markQuoteLost(row.raw as never));
                          flash();
                        }}
                      >
                        Mark lost
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="btn secondary small"
                      onClick={() => remove(row)}
                    >
                      Remove
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="empty-state">
            Nothing open here yet. Hit {desk.addLabel.toLowerCase()} to start this
            lane of the pipeline.
          </p>
        )}
      </section>

      {showNew ? (
        <div className="modal-backdrop" role="presentation">
          <div className="modal-card" role="dialog" aria-label={desk.addLabel}>
            <div className="panel-head">
              <h2 className="panel-title">{desk.addLabel}</h2>
              <button
                type="button"
                className="btn secondary small"
                onClick={() => setShowNew(false)}
              >
                Close
              </button>
            </div>
            <form className="jobs-form" onSubmit={onCreate}>
              {desk.fields.map((field) => (
                <label key={field.key} className="field-label" htmlFor={field.key}>
                  {field.label}
                  {field.type === "textarea" ? (
                    <textarea
                      id={field.key}
                      name={field.key}
                      className="field textarea"
                      required={field.required}
                      placeholder={field.placeholder}
                      rows={3}
                    />
                  ) : (
                    <input
                      id={field.key}
                      name={field.key}
                      className="field"
                      type={field.type}
                      required={field.required}
                      placeholder={field.placeholder}
                      defaultValue={
                        field.type === "date" ? today : undefined
                      }
                    />
                  )}
                </label>
              ))}
              <div className="row-actions">
                <button type="submit" className="btn primary">
                  Save {desk.singular.toLowerCase()}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      <div className={`save-toast ${toast ? "show" : ""}`} aria-live="polite">
        Saved
      </div>
    </AppShell>
  );
}
