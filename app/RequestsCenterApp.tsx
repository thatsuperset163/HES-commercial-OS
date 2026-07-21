"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { formatDisplayDate, todayKey } from "@/lib/dates";
import {
  findPossibleClientMatches,
  type PossibleClientMatch,
} from "@/lib/clients/identity";
import {
  buildQuoteComposeUrl,
  matchReasonLabel,
} from "@/lib/quotes/fromRequest";
import {
  formatQuoteStatus,
  primaryQuoteForRequest,
  quoteKindLabel,
} from "@/lib/quotes/model";
import { buildRequestNextAction } from "@/lib/requestsCenter/nextAction";
import { todayDateKey } from "@/lib/requestsCenter/model";
import {
  DECLINE_REASONS,
  FOLLOW_UP_TYPES,
  INTAKE_PRIORITIES,
  INTAKE_STATUSES,
  PROPERTY_TYPES,
  REQUEST_SOURCES,
  SITE_VISIT_OUTCOMES,
  SOURCE_LABELS,
  STATUS_HELP,
  STATUS_LABELS,
  STATUS_SHORT,
  WAITING_REASONS,
  type IntakeActivity,
  type IntakePriority,
  type IntakeRequest,
  type IntakeStatus,
} from "@/lib/requestsCenter/types";
import {
  SAVED_VIEWS,
  buildOpsMetrics,
  matchesRequestQuery,
  matchesSavedView,
  readSavedView,
  requestRowSignals,
  writeSavedView,
  type SavedViewId,
} from "@/lib/requestsCenter/views";
import {
  hydrateStoreFromCloud,
  listClients,
  listQuotes,
  upsertClient,
} from "@/lib/storage";
import { createClient } from "@/lib/work/model";
import type { QuoteKind, WorkClient } from "@/lib/work/types";
import AppShell from "./AppShell";

type ViewMode = "list" | "board";

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    credentials: "same-origin",
    headers: {
      Accept: "application/json",
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
    },
    ...init,
  });
  const json = (await res.json()) as {
    ok: boolean;
    data?: T;
    error?: { message?: string };
  };
  if (!res.ok || !json.ok) {
    throw new Error(json.error?.message || `Request failed (${res.status})`);
  }
  return json.data as T;
}

function priorityClass(priority: IntakePriority) {
  if (priority === "urgent") return "rc-priority urgent";
  if (priority === "high") return "rc-priority high";
  if (priority === "low") return "rc-priority low";
  return "rc-priority normal";
}

function money(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "—";
  return `$${Math.round(value).toLocaleString("en-US")}`;
}

function telHref(phone: string) {
  const digits = phone.replace(/\D/g, "");
  return digits ? `tel:+${digits}` : undefined;
}

function smsHref(phone: string) {
  const digits = phone.replace(/\D/g, "");
  return digits ? `sms:+${digits}` : undefined;
}

function mailHref(email: string, subject: string, body: string) {
  if (!email) return undefined;
  return `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

function urgencyClass(urgency: string) {
  if (urgency === "overdue") return "rc-next overdue";
  if (urgency === "today") return "rc-next today";
  if (urgency === "waiting") return "rc-next waiting";
  if (urgency === "done") return "rc-next done";
  if (urgency === "lost") return "rc-next lost";
  return "rc-next soon";
}

const OPS_CHIPS: {
  id: SavedViewId;
  label: string;
  value: (m: ReturnType<typeof buildOpsMetrics>) => string;
}[] = [
  { id: "new_today", label: "New", value: (m) => String(m.newCount) },
  {
    id: "needs_response",
    label: "Needs response",
    value: (m) => String(m.needsResponse),
  },
  { id: "site_visits", label: "Site visits", value: (m) => String(m.siteVisits) },
  {
    id: "follow_ups_due",
    label: "Follow-ups due",
    value: (m) => String(m.followUpsDue),
  },
  { id: "stale", label: "Stale", value: (m) => String(m.stale) },
  {
    id: "converted_week",
    label: "Converted week",
    value: (m) => String(m.convertedWeek),
  },
  {
    id: "high_value",
    label: "Potential $",
    value: (m) => money(m.potentialValue),
  },
  {
    id: "converted_week",
    label: "Conversion %",
    value: (m) =>
      m.conversionRate == null ? "—" : `${m.conversionRate}%`,
  },
];

export default function RequestsCenterApp() {
  const searchParams = useSearchParams();
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [rows, setRows] = useState<IntakeRequest[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<IntakeRequest | null>(null);
  const [activities, setActivities] = useState<IntakeActivity[]>([]);
  const [showNew, setShowNew] = useState(false);
  const [busy, setBusy] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [toast, setToast] = useState("");
  const [mode, setMode] = useState<ViewMode>("list");
  const [savedView, setSavedView] = useState<SavedViewId>("all");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<IntakeStatus | "all">("all");
  const [clients, setClients] = useState<WorkClient[]>([]);
  const [quoteTick, setQuoteTick] = useState(0);
  const [clientMatchOpen, setClientMatchOpen] = useState(false);
  const [clientMatches, setClientMatches] = useState<PossibleClientMatch[]>([]);
  const [pendingQuoteKind, setPendingQuoteKind] =
    useState<QuoteKind>("primary");
  const today = todayKey();

  useEffect(() => {
    const saved = readSavedView();
    setSavedView(saved.view);
    setQuery(saved.query);
    setStatusFilter(saved.status);
  }, []);

  useEffect(() => {
    if (!ready) return;
    writeSavedView({ view: savedView, query, status: statusFilter });
  }, [savedView, query, statusFilter, ready]);

  const refresh = useCallback(async () => {
    const data = await api<{ requests: IntakeRequest[] }>("/api/requests");
    setRows(data.requests);
  }, []);

  const refreshLocalWork = useCallback(async () => {
    await hydrateStoreFromCloud();
    setClients(listClients());
    setQuoteTick((v) => v + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        await refresh();
        await refreshLocalWork();
        if (!cancelled) setReady(true);
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Could not load Requests Center",
          );
          setReady(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refresh, refreshLocalWork]);

  // Deep-link from Quote "Open request"
  useEffect(() => {
    if (!ready) return;
    const id = searchParams.get("id");
    if (!id) return;
    void openDetail(id);
  }, [ready, searchParams]);

  const selected = useMemo(
    () => rows.find((row) => row.id === selectedId) ?? detail,
    [rows, selectedId, detail],
  );

  const metrics = useMemo(() => buildOpsMetrics(rows, today), [rows, today]);

  const filtered = useMemo(() => {
    return rows.filter((row) => {
      if (statusFilter !== "all" && row.status !== statusFilter) return false;
      if (!matchesSavedView(row, savedView, today)) return false;
      if (!matchesRequestQuery(row, query)) return false;
      return true;
    });
  }, [rows, savedView, query, statusFilter, today]);

  const byStatus = useMemo(() => {
    const map = Object.fromEntries(
      INTAKE_STATUSES.map((status) => [status, [] as IntakeRequest[]]),
    ) as Record<IntakeStatus, IntakeRequest[]>;
    for (const row of filtered) map[row.status].push(row);
    return map;
  }, [filtered]);

  async function openDetail(id: string) {
    setSelectedId(id);
    setBusy(true);
    try {
      const data = await api<{
        request: IntakeRequest;
        activities: IntakeActivity[];
      }>(`/api/requests/${id}`);
      setDetail(data.request);
      setActivities(data.activities);
    } catch (err) {
      setToast(err instanceof Error ? err.message : "Failed to open request");
    } finally {
      setBusy(false);
    }
  }

  async function patchRequest(id: string, body: Record<string, unknown>) {
    setBusy(true);
    try {
      const data = await api<{ request: IntakeRequest }>(`/api/requests/${id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      setDetail(data.request);
      await refresh();
      if (selectedId === id) {
        const full = await api<{
          request: IntakeRequest;
          activities: IntakeActivity[];
        }>(`/api/requests/${id}`);
        setActivities(full.activities);
      }
      setToast("Saved");
      window.setTimeout(() => setToast(""), 900);
    } catch (err) {
      setToast(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function moveStatus(id: string, status: IntakeStatus) {
    if (status === "declined") {
      setToast("Pick a lost reason below");
      return;
    }
    await patchRequest(id, { status });
  }

  async function onCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fd = new FormData(event.currentTarget);
    setBusy(true);
    try {
      const data = await api<{ request: IntakeRequest }>("/api/requests", {
        method: "POST",
        body: JSON.stringify({
          customerName: String(fd.get("customerName") || ""),
          company: String(fd.get("company") || ""),
          phone: String(fd.get("phone") || ""),
          email: String(fd.get("email") || ""),
          address: String(fd.get("address") || ""),
          serviceRequested: String(fd.get("serviceRequested") || ""),
          requestSource: String(fd.get("requestSource") || "manual"),
          priority: String(fd.get("priority") || "normal"),
          notes: String(fd.get("notes") || ""),
          dateReceived: String(fd.get("dateReceived") || todayDateKey()),
          potentialValue: String(fd.get("potentialValue") || "") || null,
          propertyType: String(fd.get("propertyType") || ""),
          status: "new",
        }),
      });
      setShowNew(false);
      event.currentTarget.reset();
      await refresh();
      await openDetail(data.request.id);
    } catch (err) {
      setToast(err instanceof Error ? err.message : "Create failed");
    } finally {
      setBusy(false);
    }
  }

  async function logTouch(type: "call" | "email" | "text") {
    if (!selected) return;
    await api(`/api/requests/${selected.id}/activities`, {
      method: "POST",
      body: JSON.stringify({
        activityType: type,
        body: `${type} touch logged`,
      }),
    });
    if (selected.status === "new") {
      await moveStatus(selected.id, "needs_response");
    } else {
      await openDetail(selected.id);
      await refresh();
    }
  }

  async function scheduleEstimate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    const fd = new FormData(event.currentTarget);
    await patchRequest(selected.id, {
      status: "estimate_scheduled",
      estimateDate: String(fd.get("estimateDate") || ""),
      estimateTime: String(fd.get("estimateTime") || ""),
      assignedPerson: String(fd.get("assignedPerson") || ""),
      directions: String(fd.get("directions") || ""),
      estimateNotes: String(fd.get("estimateNotes") || ""),
      siteVisitOutcome: String(fd.get("siteVisitOutcome") || ""),
      activityType: "estimate_scheduled",
      activityBody: "Site visit scheduled",
    });
  }

  async function saveFollowUp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    const fd = new FormData(event.currentTarget);
    await patchRequest(selected.id, {
      followUpDate: String(fd.get("followUpDate") || "") || null,
      followUpType: String(fd.get("followUpType") || ""),
      followUpNotes: String(fd.get("followUpNotes") || ""),
      activityType: "follow_up",
      activityBody: "Follow-up updated",
    });
  }

  async function setWaiting(reason: string) {
    if (!selected) return;
    await patchRequest(selected.id, {
      status: "waiting_on_customer",
      waitingReason: reason,
      activityType: "waiting",
      activityBody: reason,
    });
  }

  async function decline(reason: string) {
    if (!selected) return;
    if (!reason.trim()) {
      setToast("Lost reason is required");
      return;
    }
    await patchRequest(selected.id, {
      status: "declined",
      declineReason: reason,
      activityType: "declined",
      activityBody: `Lost: ${reason}`,
    });
  }

  async function convert() {
    if (!selected) return;
    setBusy(true);
    try {
      await api(`/api/requests/${selected.id}/convert`, { method: "POST" });
      await refresh();
      await openDetail(selected.id);
      setToast("Converted to client, job, invoice draft + calendar task");
    } catch (err) {
      setToast(err instanceof Error ? err.message : "Convert failed");
    } finally {
      setBusy(false);
    }
  }

  function navigateToQuoteCompose(
    request: IntakeRequest,
    clientId: string | null,
    quoteKind: QuoteKind,
  ) {
    const client = clientId
      ? clients.find((c) => c.id === clientId) ?? null
      : null;
    const url = buildQuoteComposeUrl({
      request,
      clientId,
      clientName: client?.name || request.company || request.customerName,
      quoteKind,
      forceNew: quoteKind !== "primary",
    });
    window.location.assign(url);
  }

  async function linkClientAndCompose(
    request: IntakeRequest,
    clientId: string,
    quoteKind: QuoteKind,
  ) {
    setBusy(true);
    try {
      await api<{ request: IntakeRequest }>(`/api/requests/${request.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          linkedClientId: clientId,
          activityType: "client_linked",
          activityBody: `Linked client ${clientId} for quote`,
        }),
      });
      setClientMatchOpen(false);
      navigateToQuoteCompose(request, clientId, quoteKind);
    } catch (err) {
      setToast(err instanceof Error ? err.message : "Could not link client");
      setBusy(false);
    }
  }

  async function createNewClientAndCompose(
    request: IntakeRequest,
    quoteKind: QuoteKind,
  ) {
    setBusy(true);
    try {
      const client = createClient({
        name: request.company.trim() || request.customerName.trim() || "Client",
        companyName: request.company.trim(),
        phone: request.phone,
        email: request.email,
        address: request.address,
        clientType:
          request.propertyType === "commercial" ? "commercial" : "residential",
        notes: `Created from request ${request.id} for quote`,
      });
      upsertClient(client);
      await api<{ request: IntakeRequest }>(`/api/requests/${request.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          linkedClientId: client.id,
          activityType: "client_created",
          activityBody: `Created client ${client.id} for quote`,
        }),
      });
      setClientMatchOpen(false);
      navigateToQuoteCompose(request, client.id, quoteKind);
    } catch (err) {
      setToast(err instanceof Error ? err.message : "Could not create client");
      setBusy(false);
    }
  }

  function beginCreateQuote(quoteKind: QuoteKind = "primary") {
    if (!selected) return;
    if (selected.status === "declined") {
      setToast("Lost requests cannot create quotes");
      return;
    }

    const linkedId =
      selected.linkedClientId || selected.convertedClientId || null;
    if (linkedId) {
      navigateToQuoteCompose(selected, linkedId, quoteKind);
      return;
    }

    const matches = findPossibleClientMatches(clients, {
      name: selected.customerName,
      companyName: selected.company,
      phone: selected.phone,
      email: selected.email,
      address: selected.address,
    });

    if (matches.length === 0) {
      // No match — ask before creating a client (never auto-create).
      setPendingQuoteKind(quoteKind);
      setClientMatches([]);
      setClientMatchOpen(true);
      return;
    }

    if (matches.length === 1 && quoteKind === "primary" && linkedId == null) {
      // Still require confirmation when a match exists.
      setPendingQuoteKind(quoteKind);
      setClientMatches(matches);
      setClientMatchOpen(true);
      return;
    }

    setPendingQuoteKind(quoteKind);
    setClientMatches(matches);
    setClientMatchOpen(true);
  }

  function beginAdditionalQuote() {
    if (!selected) return;
    const kind = window.prompt(
      "Create another quote for this request?\nType: revised, alternate, or additional",
      "additional",
    );
    if (!kind) return;
    const normalized = kind.trim().toLowerCase();
    if (
      normalized !== "revised" &&
      normalized !== "alternate" &&
      normalized !== "additional"
    ) {
      setToast("Use revised, alternate, or additional");
      return;
    }
    if (
      !window.confirm(
        `Create a ${quoteKindLabel(normalized as QuoteKind)} for this request?`,
      )
    ) {
      return;
    }
    beginCreateQuote(normalized as QuoteKind);
  }

  async function refreshAi() {
    if (!selected) return;
    setBusy(true);
    try {
      const data = await api<{ request: IntakeRequest }>(
        `/api/requests/${selected.id}/ai`,
        { method: "POST" },
      );
      setDetail(data.request);
      await refresh();
    } catch (err) {
      setToast(err instanceof Error ? err.message : "AI refresh failed");
    } finally {
      setBusy(false);
    }
  }

  async function saveInternalNotes(notes: string) {
    if (!selected) return;
    await patchRequest(selected.id, { internalNotes: notes });
  }

  async function addAttachment(kind: "file" | "photo") {
    if (!selected) return;
    const name = window.prompt(
      kind === "photo" ? "Photo label / URL" : "Attachment name / URL",
    );
    if (!name?.trim()) return;
    const item = {
      id: `att-${Math.random().toString(36).slice(2, 8)}`,
      name: name.trim(),
      url: name.trim().startsWith("http") ? name.trim() : "",
      kind,
      addedAt: new Date().toISOString(),
    };
    const key = kind === "photo" ? "photos" : "attachments";
    const list = [...(selected[key] ?? []), item];
    await patchRequest(selected.id, { [key]: list });
  }

  async function archiveRequest() {
    if (!selected) return;
    if (!window.confirm(`Archive ${selected.customerName}?`)) return;
    setBusy(true);
    try {
      await api(`/api/requests/${selected.id}`, { method: "DELETE" });
      setSelectedId(null);
      setDetail(null);
      setActivities([]);
      await refresh();
      setToast("Archived");
      window.setTimeout(() => setToast(""), 900);
    } catch (err) {
      setToast(err instanceof Error ? err.message : "Archive failed");
    } finally {
      setBusy(false);
    }
  }

  function setView(view: SavedViewId) {
    setSavedView(view);
    setStatusFilter("all");
  }

  if (!ready) {
    return (
      <AppShell>
        <p className="brand-sub">Loading Requests OS…</p>
      </AppShell>
    );
  }

  const nextSelected = selected
    ? buildRequestNextAction(selected, today)
    : null;

  void quoteTick;
  const linkedQuote = selected
    ? primaryQuoteForRequest(
        listQuotes(),
        selected.id,
        selected.convertedQuoteId,
      )
    : null;

  return (
    <AppShell>
      <div className="page-intro">
        <div>
          <p className="hq-eyebrow">Requests</p>
          <h2>Requests OS</h2>
          <p>{formatDisplayDate(today)} — triage inbound work fast.</p>
        </div>
        <div className="jobs-intro-actions">
          <div className="rc-mode-toggle" role="tablist" aria-label="View mode">
            <button
              type="button"
              role="tab"
              aria-selected={mode === "list"}
              className={mode === "list" ? "is-active" : ""}
              onClick={() => setMode("list")}
            >
              List
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === "board"}
              className={mode === "board" ? "is-active" : ""}
              onClick={() => setMode("board")}
            >
              Board
            </button>
          </div>
          <Link href="/work" className="btn secondary">
            Work home
          </Link>
          <button
            type="button"
            className="btn primary"
            onClick={() => setShowNew(true)}
          >
            New request
          </button>
        </div>
      </div>

      {error ? (
        <section className="panel">
          <p className="empty-state">
            {error}. Run{" "}
            <code>supabase/migrations/20260718042000_requests_center.sql</code>{" "}
            and confirm <code>SUPABASE_SERVICE_ROLE_KEY</code> on Vercel.
          </p>
        </section>
      ) : null}

      <section className="rc-ops" aria-label="Ops metrics">
        {OPS_CHIPS.map((chip) => (
          <button
            key={`${chip.label}-${chip.id}`}
            type="button"
            className={`rc-ops-chip${savedView === chip.id ? " is-active" : ""}`}
            onClick={() => setView(chip.id)}
          >
            <span>{chip.label}</span>
            <strong>{chip.value(metrics)}</strong>
          </button>
        ))}
      </section>

      <div className="rc-toolbar">
        <div className="rc-views" role="toolbar" aria-label="Saved views">
          {SAVED_VIEWS.map((view) => (
            <button
              key={view.id}
              type="button"
              className={savedView === view.id ? "is-active" : ""}
              onClick={() => setView(view.id)}
            >
              {view.label}
            </button>
          ))}
        </div>
        <label className="field-label rc-search">
          Search
          <input
            className="field"
            type="search"
            value={query}
            placeholder="Name, phone, service…"
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
      </div>

      <div className={`rc-split${selected ? " has-detail" : ""}`}>
        <div className="rc-split-main">
          {mode === "list" ? (
            <div className="rc-list" aria-label="Requests list">
              {!filtered.length ? (
                <p className="rc-empty">
                  No requests match this view
                  {query.trim() ? ` for “${query.trim()}”` : ""}.
                </p>
              ) : (
                filtered.map((row) => {
                  const signals = requestRowSignals(row, today);
                  return (
                    <button
                      key={row.id}
                      type="button"
                      className={`rc-list-row${selectedId === row.id ? " active" : ""}`}
                      onClick={() => void openDetail(row.id)}
                    >
                      <div className="rc-list-row-top">
                        <strong>{row.customerName}</strong>
                        <span className={`rc-status status-${row.status}`}>
                          {STATUS_SHORT[row.status]}
                        </span>
                      </div>
                      <p className="rc-list-row-meta">
                        {[
                          row.company || null,
                          row.serviceRequested,
                          row.dateReceived,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                      <p className="rc-list-row-next">{signals.next.title}</p>
                      <div className="rc-list-row-foot">
                        <span>
                          {row.followUpDate
                            ? `Follow-up ${row.followUpDate}`
                            : "No follow-up"}
                        </span>
                        <span>{money(row.potentialValue)}</span>
                        <span className={priorityClass(row.priority)}>
                          {row.priority}
                        </span>
                        {signals.isExistingClient ? (
                          <span className="rc-existing">Existing client</span>
                        ) : null}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          ) : (
            <div className="rc-board" aria-label="Requests board">
              {INTAKE_STATUSES.map((status) => (
                <section
                  key={status}
                  className={`rc-column status-${status}`}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={() => {
                    if (dragId) void moveStatus(dragId, status);
                    setDragId(null);
                  }}
                >
                  <header className="rc-column-head">
                    <h3>{STATUS_SHORT[status]}</h3>
                    <span>{byStatus[status].length}</span>
                  </header>
                  <div className="rc-column-body">
                    {byStatus[status].map((row) => (
                      <article
                        key={row.id}
                        className={`rc-card ${selectedId === row.id ? "active" : ""}`}
                        draggable
                        onDragStart={() => setDragId(row.id)}
                        onDragEnd={() => setDragId(null)}
                        onClick={() => void openDetail(row.id)}
                      >
                        <div className="rc-card-top">
                          <strong>{row.customerName}</strong>
                          <span className={priorityClass(row.priority)}>
                            {row.priority}
                          </span>
                        </div>
                        <p>{row.serviceRequested}</p>
                        <p className="rc-card-meta">
                          {[
                            row.company,
                            SOURCE_LABELS[row.requestSource] || row.requestSource,
                            row.dateReceived,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      </article>
                    ))}
                    {!byStatus[status].length ? (
                      <p className="rc-empty">
                        {filtered.length
                          ? "Drop a card here"
                          : "No matching requests"}
                      </p>
                    ) : null}
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>

        {selected ? (
          <section className="panel rc-detail" aria-label="Request detail">
            <div className="panel-head">
              <h2 className="panel-title">{selected.customerName}</h2>
              <div className="hunt-actions">
                <button
                  type="button"
                  className="btn secondary small"
                  disabled={busy}
                  onClick={() => void archiveRequest()}
                >
                  Archive
                </button>
                <button
                  type="button"
                  className="btn secondary small"
                  onClick={() => {
                    setSelectedId(null);
                    setDetail(null);
                  }}
                >
                  Close
                </button>
              </div>
            </div>

            {nextSelected ? (
              <div
                className={urgencyClass(nextSelected.urgency)}
                role="status"
              >
                <strong>{nextSelected.title}</strong>
                <span>{nextSelected.reason}</span>
              </div>
            ) : null}

            <label className="field-label">
              Status
              <select
                className="field"
                value={selected.status}
                disabled={busy}
                onChange={(event) =>
                  void moveStatus(
                    selected.id,
                    event.target.value as IntakeStatus,
                  )
                }
              >
                {INTAKE_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {STATUS_LABELS[status]}
                  </option>
                ))}
              </select>
              <span className="rc-status-help">{STATUS_HELP[selected.status]}</span>
            </label>

            <div className="rc-detail-grid">
              <div>
                <p className="rc-kv">
                  <span>Company</span>
                  <strong>{selected.company || "—"}</strong>
                </p>
                <p className="rc-kv">
                  <span>Service</span>
                  <strong>{selected.serviceRequested}</strong>
                </p>
                <p className="rc-kv">
                  <span>Address</span>
                  <strong>{selected.address || "—"}</strong>
                </p>
                <p className="rc-kv">
                  <span>Source / Priority</span>
                  <strong>
                    {SOURCE_LABELS[selected.requestSource] ||
                      selected.requestSource}{" "}
                    · {selected.priority}
                  </strong>
                </p>
                <p className="rc-notes">
                  {selected.notes || "No customer notes."}
                </p>

                <div className="hunt-actions">
                  <a
                    className="btn primary small"
                    href={telHref(selected.phone)}
                    onClick={() => void logTouch("call")}
                  >
                    Call
                  </a>
                  <a
                    className="btn secondary small"
                    href={mailHref(
                      selected.email,
                      `Harris Exterior Solutions — ${selected.serviceRequested}`,
                      selected.aiSuggestedReply || "",
                    )}
                    onClick={() => void logTouch("email")}
                  >
                    Email
                  </a>
                  <a
                    className="btn secondary small"
                    href={smsHref(selected.phone)}
                    onClick={() => void logTouch("text")}
                  >
                    Text
                  </a>
                </div>

                <form className="rc-estimate-form" onSubmit={scheduleEstimate}>
                  <h3>Schedule site visit</h3>
                  <div className="jobs-form-row">
                    <label className="field-label">
                      Date
                      <input
                        className="field"
                        name="estimateDate"
                        type="date"
                        defaultValue={selected.estimateDate || todayDateKey()}
                        required
                      />
                    </label>
                    <label className="field-label">
                      Time
                      <input
                        className="field"
                        name="estimateTime"
                        defaultValue={selected.estimateTime}
                        placeholder="9:00 AM"
                      />
                    </label>
                  </div>
                  <label className="field-label">
                    Assigned person
                    <input
                      className="field"
                      name="assignedPerson"
                      defaultValue={selected.assignedPerson}
                      placeholder="Will"
                    />
                  </label>
                  <label className="field-label">
                    Directions
                    <input
                      className="field"
                      name="directions"
                      defaultValue={selected.directions}
                    />
                  </label>
                  <label className="field-label">
                    Notes
                    <textarea
                      className="field textarea"
                      name="estimateNotes"
                      rows={2}
                      defaultValue={selected.estimateNotes}
                    />
                  </label>
                  <label className="field-label">
                    Outcome
                    <select
                      className="field"
                      name="siteVisitOutcome"
                      defaultValue={selected.siteVisitOutcome || ""}
                    >
                      <option value="">Not set</option>
                      {SITE_VISIT_OUTCOMES.map((outcome) => (
                        <option key={outcome} value={outcome}>
                          {outcome}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    type="submit"
                    className="btn primary small"
                    disabled={busy}
                  >
                    Schedule site visit
                  </button>
                </form>

                <form className="rc-estimate-form" onSubmit={saveFollowUp}>
                  <h3>Follow-up</h3>
                  <div className="jobs-form-row">
                    <label className="field-label">
                      Date
                      <input
                        className="field"
                        name="followUpDate"
                        type="date"
                        defaultValue={selected.followUpDate || ""}
                      />
                    </label>
                    <label className="field-label">
                      Type
                      <select
                        className="field"
                        name="followUpType"
                        defaultValue={selected.followUpType || "call"}
                      >
                        {FOLLOW_UP_TYPES.map((type) => (
                          <option key={type} value={type}>
                            {type.replace(/_/g, " ")}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <label className="field-label">
                    Notes
                    <textarea
                      className="field textarea"
                      name="followUpNotes"
                      rows={2}
                      defaultValue={selected.followUpNotes}
                    />
                  </label>
                  <button
                    type="submit"
                    className="btn secondary small"
                    disabled={busy}
                  >
                    Save follow-up
                  </button>
                </form>

                <div className="rc-estimate-form">
                  <h3>Value</h3>
                  <div className="jobs-form-row">
                    <label className="field-label">
                      Potential value
                      <input
                        className="field"
                        type="number"
                        min={0}
                        step={50}
                        key={`pv-${selected.id}-${selected.updatedAt}`}
                        defaultValue={selected.potentialValue ?? ""}
                        disabled={busy}
                        onBlur={(event) => {
                          const raw = event.target.value.trim();
                          const next = raw === "" ? null : Number(raw);
                          if (next !== selected.potentialValue) {
                            void patchRequest(selected.id, {
                              potentialValue: next,
                            });
                          }
                        }}
                      />
                    </label>
                    <label className="field-label">
                      Property type
                      <select
                        className="field"
                        key={`pt-${selected.id}-${selected.updatedAt}`}
                        defaultValue={selected.propertyType || ""}
                        disabled={busy}
                        onChange={(event) => {
                          const next = event.target.value;
                          if (next !== selected.propertyType) {
                            void patchRequest(selected.id, {
                              propertyType: next,
                            });
                          }
                        }}
                      >
                        {PROPERTY_TYPES.map((type) => (
                          <option key={type || "unset"} value={type}>
                            {type || "Not set"}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                </div>

                <div className="rc-wait-block">
                  <h3>Waiting on client</h3>
                  <div className="hunt-actions">
                    {WAITING_REASONS.map((reason) => (
                      <button
                        key={reason}
                        type="button"
                        className="btn secondary small"
                        disabled={busy}
                        onClick={() => void setWaiting(reason)}
                      >
                        {reason}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="rc-wait-block">
                  <h3>Quote</h3>
                  {linkedQuote || selected.convertedQuoteId ? (
                    <>
                      <p className="rc-status-help">
                        {linkedQuote ? (
                          <>
                            {quoteKindLabel(linkedQuote.quoteKind)}{" "}
                            <strong>
                              {linkedQuote.number || linkedQuote.id}
                            </strong>{" "}
                            · {formatQuoteStatus(linkedQuote.status)}
                          </>
                        ) : (
                          <>
                            Linked quote{" "}
                            <strong>{selected.convertedQuoteId}</strong>
                          </>
                        )}
                      </p>
                      <div className="hunt-actions">
                        <Link
                          className="btn primary small"
                          href={
                            linkedQuote
                              ? `/work/quotes?id=${encodeURIComponent(linkedQuote.id)}`
                              : `/work/quotes?id=${encodeURIComponent(selected.convertedQuoteId || "")}`
                          }
                        >
                          View Quote
                        </Link>
                        {linkedQuote?.status === "draft" ? (
                          <Link
                            className="btn secondary small"
                            href={`/work/quotes?id=${encodeURIComponent(linkedQuote.id)}&edit=1`}
                          >
                            Edit draft
                          </Link>
                        ) : null}
                        <button
                          type="button"
                          className="btn secondary small"
                          disabled={busy || selected.status === "declined"}
                          onClick={() => beginAdditionalQuote()}
                        >
                          Create another quote…
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <p className="rc-status-help">
                        Open the official quote document prefilled from this
                        request. Nothing is saved until you click Save.
                      </p>
                      <div className="hunt-actions">
                        <button
                          type="button"
                          className="btn primary"
                          disabled={busy || selected.status === "declined"}
                          onClick={() => beginCreateQuote("primary")}
                        >
                          Create Quote
                        </button>
                      </div>
                    </>
                  )}
                  {selected.linkedClientId || selected.convertedClientId ? (
                    <p className="rc-status-help">
                      Client{" "}
                      <Link
                        href={`/work/clients?id=${encodeURIComponent(selected.linkedClientId || selected.convertedClientId || "")}`}
                      >
                        {selected.linkedClientId || selected.convertedClientId}
                      </Link>
                    </p>
                  ) : null}
                </div>

                <div className="rc-wait-block">
                  <h3>Converted / Lost</h3>
                  <div className="hunt-actions">
                    <button
                      type="button"
                      className="btn success"
                      disabled={busy || Boolean(selected.convertedJobId)}
                      onClick={() => void convert()}
                    >
                      {selected.convertedJobId
                        ? "Already converted"
                        : "Converted"}
                    </button>
                  </div>
                  <p className="rc-status-help">
                    Lost requires a reason:
                  </p>
                  <div className="hunt-actions">
                    {DECLINE_REASONS.map((reason) => (
                      <button
                        key={reason}
                        type="button"
                        className="btn secondary small"
                        disabled={busy}
                        onClick={() => void decline(reason)}
                      >
                        {reason}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <div className="rc-ai-block">
                  <div className="panel-head">
                    <h3 className="panel-title">AI assist</h3>
                    <button
                      type="button"
                      className="btn secondary small"
                      disabled={busy}
                      onClick={() => void refreshAi()}
                    >
                      Refresh AI
                    </button>
                  </div>
                  <p>
                    <span className="status-chip ai">Summary</span>{" "}
                    {selected.aiSummary || "—"}
                  </p>
                  <p>
                    <span className="status-chip ai">Suggested reply</span>
                  </p>
                  <pre className="rc-ai-pre">
                    {selected.aiSuggestedReply || "—"}
                  </pre>
                  <p>
                    <span className="status-chip ai">Price estimate</span>{" "}
                    {selected.aiPriceEstimate || "—"}
                  </p>
                  <p>
                    <span className="status-chip ai">Upsells</span>{" "}
                    {selected.aiUpsellSuggestions || "—"}
                  </p>
                </div>

                <label className="field-label">
                  Internal notes
                  <textarea
                    className="field textarea"
                    rows={4}
                    defaultValue={selected.internalNotes}
                    key={`notes-${selected.id}-${selected.updatedAt}`}
                    disabled={busy}
                    onBlur={(event) => {
                      if (event.target.value !== selected.internalNotes) {
                        void saveInternalNotes(event.target.value);
                      }
                    }}
                  />
                </label>

                <div className="hunt-actions">
                  <button
                    type="button"
                    className="btn secondary small"
                    disabled={busy}
                    onClick={() => void addAttachment("file")}
                  >
                    Add attachment
                  </button>
                  <button
                    type="button"
                    className="btn secondary small"
                    disabled={busy}
                    onClick={() => void addAttachment("photo")}
                  >
                    Add photo
                  </button>
                </div>
                <ul className="rc-attach-list">
                  {[...selected.attachments, ...selected.photos].map((item) => (
                    <li key={item.id}>
                      {item.kind}:{" "}
                      {item.url ? (
                        <a href={item.url} target="_blank" rel="noreferrer">
                          {item.name}
                        </a>
                      ) : (
                        item.name
                      )}
                    </li>
                  ))}
                </ul>

                <h3>Activity timeline</h3>
                <ul className="rc-timeline">
                  {activities.map((act) => (
                    <li key={act.id}>
                      <span>{new Date(act.createdAt).toLocaleString()}</span>
                      <strong>{act.activityType}</strong>
                      <p>{act.body}</p>
                    </li>
                  ))}
                  {!activities.length ? <li>No activity yet.</li> : null}
                </ul>
              </div>
            </div>
          </section>
        ) : null}
      </div>

      {showNew ? (
        <div className="modal-backdrop" role="presentation">
          <div className="modal-card" role="dialog" aria-label="New request">
            <div className="panel-head">
              <h2 className="panel-title">New request</h2>
              <button
                type="button"
                className="btn secondary small"
                onClick={() => setShowNew(false)}
              >
                Close
              </button>
            </div>
            <form className="jobs-form" onSubmit={onCreate}>
              <div className="jobs-form-row">
                <label className="field-label">
                  Customer name *
                  <input
                    className="field"
                    name="customerName"
                    required
                    autoFocus
                  />
                </label>
                <label className="field-label">
                  Company
                  <input className="field" name="company" />
                </label>
              </div>
              <div className="jobs-form-row">
                <label className="field-label">
                  Phone
                  <input className="field" name="phone" type="tel" />
                </label>
                <label className="field-label">
                  Email
                  <input className="field" name="email" type="email" />
                </label>
              </div>
              <label className="field-label">
                Address
                <input className="field" name="address" />
              </label>
              <label className="field-label">
                Service requested
                <input
                  className="field"
                  name="serviceRequested"
                  placeholder="Pressure washing, window cleaning, or junk removal"
                  defaultValue="Exterior cleaning"
                />
              </label>
              <div className="jobs-form-row">
                <label className="field-label">
                  Request source
                  <select
                    className="field"
                    name="requestSource"
                    defaultValue="manual"
                  >
                    {REQUEST_SOURCES.map((source) => (
                      <option key={source} value={source}>
                        {SOURCE_LABELS[source]}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field-label">
                  Priority
                  <select className="field" name="priority" defaultValue="normal">
                    {INTAKE_PRIORITIES.map((priority) => (
                      <option key={priority} value={priority}>
                        {priority}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field-label">
                  Date received
                  <input
                    className="field"
                    name="dateReceived"
                    type="date"
                    defaultValue={todayDateKey()}
                  />
                </label>
              </div>
              <div className="jobs-form-row">
                <label className="field-label">
                  Potential value
                  <input
                    className="field"
                    name="potentialValue"
                    type="number"
                    min={0}
                    step={50}
                  />
                </label>
                <label className="field-label">
                  Property type
                  <select className="field" name="propertyType" defaultValue="">
                    {PROPERTY_TYPES.map((type) => (
                      <option key={type || "unset"} value={type}>
                        {type || "Not set"}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <label className="field-label">
                Notes
                <textarea className="field textarea" name="notes" rows={3} />
              </label>
              <button type="submit" className="btn primary" disabled={busy}>
                Create request
              </button>
            </form>
          </div>
        </div>
      ) : null}

      {clientMatchOpen && selected ? (
        <div
          className="rc-modal-backdrop"
          role="presentation"
          onClick={() => !busy && setClientMatchOpen(false)}
        >
          <div
            className="panel rc-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="rc-client-match-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="panel-head">
              <h3 id="rc-client-match-title" className="panel-title">
                Link a client before quoting
              </h3>
              <button
                type="button"
                className="btn secondary small"
                disabled={busy}
                onClick={() => setClientMatchOpen(false)}
              >
                Cancel
              </button>
            </div>
            <p className="rc-status-help">
              One real-world customer = one Client. Choose an existing match or
              intentionally create a new Client. Opening a quote never creates
              records by itself.
            </p>
            {clientMatches.length ? (
              <ul className="rc-client-match-list">
                {clientMatches.map((match) => (
                  <li key={match.client.id}>
                    <div>
                      <strong>{match.client.name}</strong>
                      <span className="rc-status-help">
                        {matchReasonLabel(match.reason)}
                        {match.client.email ? ` · ${match.client.email}` : ""}
                        {match.client.phone ? ` · ${match.client.phone}` : ""}
                      </span>
                    </div>
                    <button
                      type="button"
                      className="btn primary small"
                      disabled={busy}
                      onClick={() =>
                        void linkClientAndCompose(
                          selected,
                          match.client.id,
                          pendingQuoteKind,
                        )
                      }
                    >
                      Use this client
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="empty-state">No existing client matches found.</p>
            )}
            <div className="hunt-actions">
              <button
                type="button"
                className="btn secondary"
                disabled={busy}
                onClick={() =>
                  void createNewClientAndCompose(selected, pendingQuoteKind)
                }
              >
                Create new client &amp; continue
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div className={`save-toast ${toast ? "show" : ""}`} aria-live="polite">
        {toast || "Saved"}
      </div>
    </AppShell>
  );
}
