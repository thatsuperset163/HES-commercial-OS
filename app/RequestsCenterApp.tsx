"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { formatDisplayDate, todayKey } from "@/lib/dates";
import {
  DECLINE_REASONS,
  INTAKE_PRIORITIES,
  INTAKE_STATUSES,
  REQUEST_SOURCES,
  STATUS_LABELS,
  STATUS_SHORT,
  WAITING_REASONS,
  type IntakeActivity,
  type IntakePriority,
  type IntakeRequest,
  type IntakeStatus,
  type RequestSource,
} from "@/lib/requestsCenter/types";
import { todayDateKey } from "@/lib/requestsCenter/model";
import AppShell from "./AppShell";

type Dashboard = Record<IntakeStatus, number>;

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

export default function RequestsCenterApp() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [rows, setRows] = useState<IntakeRequest[]>([]);
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<IntakeRequest | null>(null);
  const [activities, setActivities] = useState<IntakeActivity[]>([]);
  const [showNew, setShowNew] = useState(false);
  const [busy, setBusy] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [toast, setToast] = useState("");
  const today = todayKey();

  const refresh = useCallback(async () => {
    const data = await api<{ requests: IntakeRequest[]; dashboard: Dashboard }>(
      "/api/requests",
    );
    setRows(data.requests);
    setDashboard(data.dashboard);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        await refresh();
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
  }, [refresh]);

  const selected = useMemo(
    () => rows.find((row) => row.id === selectedId) ?? detail,
    [rows, selectedId, detail],
  );

  async function openDetail(id: string) {
    setSelectedId(id);
    setBusy(true);
    try {
      const data = await api<{ request: IntakeRequest; activities: IntakeActivity[] }>(
        `/api/requests/${id}`,
      );
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
        const full = await api<{ request: IntakeRequest; activities: IntakeActivity[] }>(
          `/api/requests/${id}`,
        );
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
      activityType: "estimate_scheduled",
      activityBody: "Estimate scheduled",
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
    await patchRequest(selected.id, {
      status: "declined",
      declineReason: reason,
      activityType: "declined",
      activityBody: `Declined: ${reason}`,
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

  const byStatus = useMemo(() => {
    const map = Object.fromEntries(
      INTAKE_STATUSES.map((status) => [status, [] as IntakeRequest[]]),
    ) as Record<IntakeStatus, IntakeRequest[]>;
    for (const row of rows) map[row.status].push(row);
    return map;
  }, [rows]);

  if (!ready) {
    return (
      <AppShell>
        <p className="brand-sub">Loading Requests Center…</p>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="page-intro">
        <div>
          <p className="hq-eyebrow">Requests Center</p>
          <h2>{formatDisplayDate(today)}</h2>
          <p>Central intake — triage a new request in under 30 seconds.</p>
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

      {dashboard ? (
        <section className="rc-dash" aria-label="Requests dashboard">
          {INTAKE_STATUSES.map((status) => (
            <button
              key={status}
              type="button"
              className={`rc-dash-chip status-${status}`}
              onClick={() => {
                const first = byStatus[status][0];
                if (first) void openDetail(first.id);
              }}
            >
              <span>{STATUS_LABELS[status]}</span>
              <strong>{dashboard[status]}</strong>
            </button>
          ))}
        </section>
      ) : null}

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
                    {[row.company, row.requestSource, row.dateReceived]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </article>
              ))}
              {!byStatus[status].length ? (
                <p className="rc-empty">Drop a card here</p>
              ) : null}
            </div>
          </section>
        ))}
      </div>

      {selected ? (
        <section className="panel rc-detail" aria-label="Request detail">
          <div className="panel-head">
            <h2 className="panel-title">{selected.customerName}</h2>
            <div className="hunt-actions">
              <select
                className="field"
                value={selected.status}
                onChange={(event) =>
                  void moveStatus(selected.id, event.target.value as IntakeStatus)
                }
              >
                {INTAKE_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {STATUS_SHORT[status]}
                  </option>
                ))}
              </select>
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
                  {selected.requestSource} · {selected.priority}
                </strong>
              </p>
              <p className="rc-notes">{selected.notes || "No customer notes."}</p>

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
                <h3>Schedule estimate</h3>
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
                <button type="submit" className="btn primary small" disabled={busy}>
                  Schedule estimate
                </button>
              </form>

              <div className="rc-wait-block">
                <h3>Waiting on customer</h3>
                <div className="hunt-actions">
                  {WAITING_REASONS.map((reason) => (
                    <button
                      key={reason}
                      type="button"
                      className="btn secondary small"
                      onClick={() => void setWaiting(reason)}
                    >
                      {reason}
                    </button>
                  ))}
                </div>
              </div>

              <div className="rc-wait-block">
                <h3>Approve / decline</h3>
                <div className="hunt-actions">
                  <button
                    type="button"
                    className="btn success"
                    disabled={busy || Boolean(selected.convertedJobId)}
                    onClick={() => void convert()}
                  >
                    {selected.convertedJobId
                      ? "Already converted"
                      : "Convert to Job"}
                  </button>
                </div>
                <div className="hunt-actions">
                  {DECLINE_REASONS.map((reason) => (
                    <button
                      key={reason}
                      type="button"
                      className="btn secondary small"
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
                <pre className="rc-ai-pre">{selected.aiSuggestedReply || "—"}</pre>
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
                  onClick={() => void addAttachment("file")}
                >
                  Add attachment
                </button>
                <button
                  type="button"
                  className="btn secondary small"
                  onClick={() => void addAttachment("photo")}
                >
                  Add photo
                </button>
              </div>
              <ul className="rc-attach-list">
                {[...selected.attachments, ...selected.photos].map((item) => (
                  <li key={item.id}>
                    {item.kind}: {item.url ? (
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
                  <input className="field" name="customerName" required autoFocus />
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
                  placeholder="House soft wash"
                  defaultValue="Exterior cleaning"
                />
              </label>
              <div className="jobs-form-row">
                <label className="field-label">
                  Request source
                  <select className="field" name="requestSource" defaultValue="manual">
                    {REQUEST_SOURCES.map((source) => (
                      <option key={source} value={source}>
                        {source}
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

      <div className={`save-toast ${toast ? "show" : ""}`} aria-live="polite">
        {toast || "Saved"}
      </div>
    </AppShell>
  );
}
