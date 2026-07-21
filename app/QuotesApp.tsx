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

function draftQuoteShell(draft: QuoteDraftFields): QuoteDoc {
  const now = new Date().toISOString();
  return {
    id: "draft-new",
    clientName: draft.clientName || "Client",
    address: draft.address,
    scope: draft.scope,
    amount: draft.amount === "" ? null : Number(draft.amount),
    status: "draft",
    followUpDate: draft.followUpDate || todayKey(),
    notes: draft.notes,
    createdAt: now,
    updatedAt: now,
  };
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
  const [toast, setToast] = useState("");
  const [saving, setSaving] = useState(false);
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

  // Create → Quote lands here with ?new=1 (optional client prefill).
  useEffect(() => {
    if (!ready) return;
    const isNew = searchParams.get("new") === "1";
    if (!isNew) return;
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
      return [row.clientName, row.address, row.scope, row.notes, row.id]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [quotes, filter, query]);

  function flash(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 1400);
    refresh();
  }

  function startNewQuote(prefill?: Partial<QuoteDraftFields>) {
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
    setEditing(edit);
    setMode("view");
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
      const amount =
        draft.amount.trim() === "" ? null : Number(draft.amount);
      if (mode === "compose" || !selected) {
        const row = createQuote({
          clientName,
          address: draft.address.trim(),
          scope: draft.scope.trim() || "Exterior cleaning",
          amount,
          followUpDate: draft.followUpDate || today,
          notes: draft.notes.trim(),
        });
        upsertQuote(row);
        setSelectedId(row.id);
        setDraft(draftFromQuote(row));
        setMode("view");
        setEditing(false);
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
        setDraft(draftFromQuote(next));
        setEditing(false);
        flash("Quote updated");
      }
      refresh();
    } finally {
      setSaving(false);
    }
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

  const documentQuote =
    mode === "compose"
      ? draftQuoteShell(draft)
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

  return (
    <AppShell>
      {showDocument && documentQuote ? (
        <div className="quote-composer">
          <header className="quote-composer-bar no-print">
            <div>
              <p className="hq-eyebrow">Work · Quotes</p>
              <h2>
                {mode === "compose"
                  ? "New quote"
                  : editing
                    ? "Edit quote"
                    : "Quote document"}
              </h2>
              <p>
                Edit the official HES template, then print or save as PDF for
                your client to sign.
              </p>
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
                  onClick={saveDocument}
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
            </div>
          </header>

          {selected && !editing ? (
            <div className="hunt-actions no-print quote-status-actions">
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
                  backToList();
                  flash("Removed");
                }}
              >
                Remove
              </button>
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
                    <li key={row.id}>
                      <button
                        type="button"
                        className="quotes-row"
                        onClick={() => openQuote(row.id)}
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
