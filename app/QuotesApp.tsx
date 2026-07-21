"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { todayKey } from "@/lib/dates";
import { formatQuoteMoney } from "@/lib/quotes/template";
import {
  advanceQuoteStatus,
  createQuote,
  markQuoteLost,
} from "@/lib/work/model";
import type { QuoteDoc, QuoteStatus } from "@/lib/work/types";
import {
  hydrateStoreFromCloud,
  listQuotes,
  removeQuote,
  upsertQuote,
} from "@/lib/storage";
import AppShell from "@/app/AppShell";
import QuoteDocument from "@/app/quotes/QuoteDocument";
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

export default function QuotesApp() {
  const [ready, setReady] = useState(false);
  const [tick, setTick] = useState(0);
  const [filter, setFilter] = useState<(typeof STATUS_FILTERS)[number]["id"]>("open");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [editing, setEditing] = useState(false);
  const [toast, setToast] = useState("");
  const today = todayKey();

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
      return [row.clientName, row.address, row.scope, row.notes, row.id]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [quotes, filter, query]);

  function flash(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 1200);
    refresh();
  }

  function onCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fd = new FormData(event.currentTarget);
    const clientName = String(fd.get("clientName") || "").trim();
    if (!clientName) return;
    const amountRaw = String(fd.get("amount") || "").trim();
    const amount = amountRaw === "" ? null : Number(amountRaw);
    const row = createQuote({
      clientName,
      address: String(fd.get("address") || ""),
      scope: String(fd.get("scope") || ""),
      amount,
      followUpDate: String(fd.get("followUpDate") || today),
      notes: String(fd.get("notes") || ""),
    });
    upsertQuote(row);
    setShowNew(false);
    event.currentTarget.reset();
    setSelectedId(row.id);
    setEditing(false);
    flash("Quote created");
  }

  function onSaveEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    const fd = new FormData(event.currentTarget);
    const amountRaw = String(fd.get("amount") || "").trim();
    const next: QuoteDoc = {
      ...selected,
      clientName: String(fd.get("clientName") || selected.clientName).trim(),
      address: String(fd.get("address") || "").trim(),
      scope: String(fd.get("scope") || "").trim(),
      amount: amountRaw === "" ? null : Number(amountRaw),
      followUpDate: String(fd.get("followUpDate") || selected.followUpDate),
      notes: String(fd.get("notes") || "").trim(),
      updatedAt: new Date().toISOString(),
    };
    upsertQuote(next);
    setEditing(false);
    flash("Quote updated");
  }

  function printQuote() {
    window.print();
  }

  if (!ready) {
    return (
      <AppShell>
        <p className="hq-lede">Loading quotes…</p>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className={`quotes-page${selected ? " has-preview" : ""}`}>
        <div className="quotes-main no-print">
          <header className="page-intro">
            <div>
              <p className="hq-eyebrow">Work · Quotes</p>
              <h2>Quotes</h2>
              <p>
                Price the work with the official HES quote template. Send it.
                Follow up.
              </p>
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
            <div className="quotes-filters" role="tablist" aria-label="Quote filters">
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
                  onClick={() => setShowNew(true)}
                >
                  Create first quote
                </button>
              </p>
            ) : (
              <ul className="quotes-list">
                {filtered.map((row) => (
                  <li key={row.id}>
                    <button
                      type="button"
                      className={`quotes-row${selectedId === row.id ? " is-active" : ""}`}
                      onClick={() => {
                        setSelectedId(row.id);
                        setEditing(false);
                      }}
                    >
                      <div className="quotes-row-main">
                        <strong>{row.clientName}</strong>
                        <span className={`status-chip status-${row.status}`}>
                          {row.status}
                        </span>
                      </div>
                      <p>{row.scope || "Exterior cleaning"}</p>
                      <p className="quotes-row-meta">
                        {[
                          formatQuoteMoney(row.amount),
                          row.address,
                          row.followUpDate
                            ? `Follow up ${row.followUpDate}`
                            : "",
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        {selected ? (
          <aside className="quotes-preview panel" aria-label="Quote preview">
            <div className="panel-head no-print">
              <h2 className="panel-title">Quote document</h2>
              <div className="quote-preview-actions">
                <button
                  type="button"
                  className="btn secondary small"
                  onClick={() => setEditing((v) => !v)}
                >
                  {editing ? "Preview" : "Edit"}
                </button>
                <button
                  type="button"
                  className="btn primary small"
                  onClick={printQuote}
                >
                  Print / PDF
                </button>
                <button
                  type="button"
                  className="btn secondary small"
                  onClick={() => {
                    setSelectedId(null);
                    setEditing(false);
                  }}
                >
                  Close
                </button>
              </div>
            </div>

            <div className="hunt-actions no-print" style={{ marginBottom: 12 }}>
              {selected.status === "draft" ? (
                <button
                  type="button"
                  className="btn secondary small"
                  onClick={() => {
                    upsertQuote(advanceQuoteStatus(selected));
                    flash("Marked sent");
                  }}
                >
                  Mark sent
                </button>
              ) : null}
              {selected.status === "sent" ? (
                <>
                  <button
                    type="button"
                    className="btn success small"
                    onClick={() => {
                      upsertQuote(advanceQuoteStatus(selected));
                      flash("Marked won");
                    }}
                  >
                    Mark won
                  </button>
                  <button
                    type="button"
                    className="btn secondary small"
                    onClick={() => {
                      upsertQuote(markQuoteLost(selected));
                      flash("Marked lost");
                    }}
                  >
                    Mark lost
                  </button>
                </>
              ) : null}
              <button
                type="button"
                className="btn secondary small"
                onClick={() => {
                  if (!window.confirm("Remove this quote?")) return;
                  removeQuote(selected.id);
                  setSelectedId(null);
                  flash("Removed");
                }}
              >
                Remove
              </button>
            </div>

            {editing ? (
              <form className="jobs-form no-print" onSubmit={onSaveEdit}>
                <label className="field-label">
                  Client name
                  <input
                    className="field"
                    name="clientName"
                    defaultValue={selected.clientName}
                    required
                  />
                </label>
                <label className="field-label">
                  Property address
                  <input
                    className="field"
                    name="address"
                    defaultValue={selected.address}
                  />
                </label>
                <label className="field-label">
                  Project overview (This project includes…)
                  <textarea
                    className="field textarea"
                    name="scope"
                    rows={5}
                    defaultValue={selected.scope}
                    required
                    placeholder="Pressure washing of driveway, sidewalks, and front walkway…"
                  />
                </label>
                <div className="jobs-form-row">
                  <label className="field-label">
                    Pricing ($)
                    <input
                      className="field"
                      name="amount"
                      type="number"
                      min={0}
                      step="1"
                      defaultValue={selected.amount ?? ""}
                    />
                  </label>
                  <label className="field-label">
                    Follow up
                    <input
                      className="field"
                      name="followUpDate"
                      type="date"
                      defaultValue={selected.followUpDate || today}
                    />
                  </label>
                </div>
                <label className="field-label">
                  Pricing notes (optional)
                  <textarea
                    className="field textarea"
                    name="notes"
                    rows={3}
                    defaultValue={selected.notes}
                    placeholder="Includes materials, travel, or deposit notes…"
                  />
                </label>
                <button type="submit" className="btn primary">
                  Save changes
                </button>
              </form>
            ) : (
              <div className="quote-print-root quote-preview-shell">
                <QuoteDocument quote={selected} />
              </div>
            )}
          </aside>
        ) : null}
      </div>

      {showNew ? (
        <div className="modal-backdrop no-print" role="presentation">
          <div className="modal-card" role="dialog" aria-label="New quote">
            <div className="panel-head">
              <h2 className="panel-title">New quote</h2>
              <button
                type="button"
                className="btn secondary small"
                onClick={() => setShowNew(false)}
              >
                Close
              </button>
            </div>
            <form className="jobs-form" onSubmit={onCreate}>
              <label className="field-label">
                Client name *
                <input className="field" name="clientName" required autoFocus />
              </label>
              <label className="field-label">
                Property address
                <input className="field" name="address" />
              </label>
              <label className="field-label">
                Project overview (This project includes…) *
                <textarea
                  className="field textarea"
                  name="scope"
                  rows={4}
                  required
                  placeholder="Describe the work included in this quote"
                  defaultValue="Exterior cleaning"
                />
              </label>
              <div className="jobs-form-row">
                <label className="field-label">
                  Pricing ($)
                  <input className="field" name="amount" type="number" min={0} />
                </label>
                <label className="field-label">
                  Follow up
                  <input
                    className="field"
                    name="followUpDate"
                    type="date"
                    defaultValue={today}
                  />
                </label>
              </div>
              <label className="field-label">
                Pricing notes (optional)
                <textarea className="field textarea" name="notes" rows={2} />
              </label>
              <button type="submit" className="btn primary">
                Create quote
              </button>
            </form>
          </div>
        </div>
      ) : null}

      {toast ? (
        <p className="toast no-print" role="status">
          {toast}
        </p>
      ) : null}
    </AppShell>
  );
}
