"use client";

import Link from "next/link";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  clientDisplayName,
  clientInitials,
  formatClientSince,
} from "@/lib/clients/display";
import { buildClientNextAction } from "@/lib/clients/nextAction";
import {
  buildClientActivity,
  buildClientSummary,
  gatherClientRelated,
  moneyLabel,
} from "@/lib/clients/related";
import type { Job, JobInput } from "@/lib/jobs/types";
import type {
  ClientType,
  InvoiceDoc,
  PreferredContact,
  QuoteDoc,
  ServiceRequest,
  WorkClient,
  WorkTask,
} from "@/lib/work/types";
import CreateNewController from "../create/CreateNewController";
import ClientInitialsAvatar from "./ClientInitialsAvatar";
import ClientProperties from "./ClientProperties";

type TabId =
  | "overview"
  | "activity"
  | "requests"
  | "quotes"
  | "jobs"
  | "invoices"
  | "notes"
  | "more";

type Props = {
  client: WorkClient;
  requests: ServiceRequest[];
  quotes: QuoteDoc[];
  jobs: Job[];
  invoices: InvoiceDoc[];
  tasks: WorkTask[];
  embedded?: boolean;
  onClose: () => void;
  onSave: (client: WorkClient) => void;
  onTogglePause: (client: WorkClient) => void;
  onArchive: (client: WorkClient) => void;
  onOpenJobForm: (initial: Partial<Job>) => void;
  onQuickCreateJob?: (input: JobInput) => Promise<void> | void;
  onCreated?: () => void;
};

const TABS: { id: TabId; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "activity", label: "Activity" },
  { id: "requests", label: "Requests" },
  { id: "quotes", label: "Quotes" },
  { id: "jobs", label: "Jobs" },
  { id: "invoices", label: "Invoices" },
  { id: "notes", label: "Notes" },
  { id: "more", label: "More" },
];

function mapsHref(address: string) {
  return `https://maps.google.com/?q=${encodeURIComponent(address)}`;
}

function urgencyClass(u: string) {
  if (u === "overdue") return "status-chip overdue";
  if (u === "today") return "status-chip due-today";
  if (u === "money") return "status-chip money";
  if (u === "clear") return "status-chip success";
  return "status-chip soon";
}

export default function ClientDetailDrawer({
  client,
  requests,
  quotes,
  jobs,
  invoices,
  tasks,
  embedded = false,
  onClose,
  onSave,
  onTogglePause,
  onArchive,
  onOpenJobForm,
  onQuickCreateJob,
  onCreated,
}: Props) {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const [tab, setTab] = useState<TabId>("overview");
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(client);

  useEffect(() => {
    setDraft(client);
    setEditing(false);
    setTab("overview");
  }, [client.id]);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (confirmArchive) setConfirmArchive(false);
        else if (menuOpen) setMenuOpen(false);
        else if (!embedded) onClose();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, menuOpen, confirmArchive, embedded]);

  const related = useMemo(
    () => gatherClientRelated(client, { requests, quotes, jobs, invoices, tasks }),
    [client, requests, quotes, jobs, invoices, tasks],
  );
  const summary = useMemo(() => buildClientSummary(related), [related]);
  const activity = useMemo(() => buildClientActivity(related), [related]);
  const next = useMemo(
    () => buildClientNextAction(related, summary),
    [related, summary],
  );
  const since = formatClientSince(client.createdAt);

  const prefill = {
    id: client.id,
    name: client.name,
    companyName: client.companyName,
    phone: client.phone,
    email: client.email,
    address: client.address,
  };

  const body = (
    <aside
      className={`client-drawer${embedded ? " is-embedded" : ""}`}
      role={embedded ? undefined : "dialog"}
      aria-modal={embedded ? undefined : true}
      aria-labelledby={titleId}
      onClick={(e) => e.stopPropagation()}
    >
      <header className="client-drawer-head">
        {!embedded ? (
          <button
            ref={closeRef}
            type="button"
            className="btn ghost small"
            onClick={onClose}
          >
            Close
          </button>
        ) : (
          <span className="hq-eyebrow">Client profile</span>
        )}
        <div className="client-drawer-head-actions">
          <CreateNewController
            size="small"
            label="Create"
            clientPrefill={prefill}
            onOpenJobForm={onOpenJobForm}
            onQuickCreateJob={onQuickCreateJob}
            onCreated={() => onCreated?.()}
          />
          <div className="client-drawer-menu-wrap">
            <button
              type="button"
              className="client-overflow-btn"
              aria-label="Client options"
              aria-expanded={menuOpen}
              onClick={() => {
                setConfirmArchive(false);
                setMenuOpen((v) => !v);
              }}
            >
              ···
            </button>
            {menuOpen ? (
              <div className="client-overflow-menu" role="menu">
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    onSave({
                      ...client,
                      favorite: !client.favorite,
                      updatedAt: new Date().toISOString(),
                    });
                    setMenuOpen(false);
                  }}
                >
                  {client.favorite ? "Remove favorite" : "Mark favorite"}
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setEditing(true);
                    setMenuOpen(false);
                  }}
                >
                  Edit client
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    onTogglePause(client);
                    setMenuOpen(false);
                  }}
                >
                  {client.status === "active" ? "Pause client" : "Activate client"}
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className="is-danger"
                  onClick={() => {
                    setConfirmArchive(true);
                    setMenuOpen(false);
                  }}
                >
                  Archive client…
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </header>

      {confirmArchive ? (
        <div className="client-confirm" role="alertdialog">
          <p>
            Archive <strong>{clientDisplayName(client)}</strong>? Jobs and
            invoices stay in the OS.
          </p>
          <div className="client-confirm-actions">
            <button
              type="button"
              className="btn ghost small"
              onClick={() => setConfirmArchive(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn primary small"
              onClick={() => {
                onArchive(client);
                setConfirmArchive(false);
              }}
            >
              Archive
            </button>
          </div>
        </div>
      ) : null}

      <div className="client-drawer-identity">
        <ClientInitialsAvatar initials={clientInitials(client)} size="md" />
        <div>
          <h2 id={titleId}>
            {client.favorite ? "★ " : ""}
            {clientDisplayName(client)}
          </h2>
          <p className="client-drawer-status">
            {client.clientType === "commercial" ? "Commercial" : "Residential"}
            {" · "}
            {client.status === "paused" ? "Paused" : "Active"}
            {since ? ` · Since ${since}` : ""}
          </p>
          {client.companyName ? (
            <p className="client-drawer-company">{client.companyName}</p>
          ) : null}
          {client.tags.length ? (
            <div className="client-tag-row">
              {client.tags.map((t) => (
                <span key={t} className="client-tag">
                  {t}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      <div className="client-quick-actions">
        {client.phone ? (
          <a className="btn ghost small" href={`tel:${client.phone}`}>
            Call
          </a>
        ) : null}
        {client.email ? (
          <a className="btn ghost small" href={`mailto:${client.email}`}>
            Email
          </a>
        ) : null}
        {client.address ? (
          <a
            className="btn ghost small"
            href={mapsHref(client.address)}
            target="_blank"
            rel="noreferrer"
          >
            Maps
          </a>
        ) : null}
      </div>

      <nav className="client-tabs" aria-label="Client sections">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={tab === t.id ? "is-active" : ""}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {tab === "overview" ? (
        <div className="client-tab-panel">
          <section className="client-next-card">
            <div className="hq-section-head">
              <h3>What should I do next?</h3>
              <span className={urgencyClass(next.urgency)}>
                {next.urgency === "clear" ? "Clear" : next.urgency}
              </span>
            </div>
            <strong>{next.title}</strong>
            <p>{next.reason}</p>
            {next.urgency !== "clear" ? (
              <Link href={next.href} className="hq-link">
                Open →
              </Link>
            ) : null}
          </section>

          <section className="client-drawer-section">
            <h3>Summary</h3>
            <ul className="client-summary-list">
              <li>
                <span>Next scheduled</span>
                <strong>{summary.nextActivity || "None"}</strong>
              </li>
              <li>
                <span>Open quotes</span>
                <strong>{moneyLabel(summary.openQuoteValue)}</strong>
              </li>
              <li>
                <span>Outstanding</span>
                <strong>{moneyLabel(summary.outstandingBalance)}</strong>
              </li>
              <li>
                <span>Completed jobs</span>
                <strong>{summary.completedJobs}</strong>
              </li>
              <li>
                <span>Lifetime collected</span>
                <strong>{moneyLabel(summary.lifetimeRevenue)}</strong>
              </li>
            </ul>
          </section>

          <section className="client-drawer-section">
            <h3>Contact</h3>
            <dl className="client-contact-dl">
              <div>
                <dt>Phone</dt>
                <dd>{client.phone || "—"}</dd>
              </div>
              <div>
                <dt>Email</dt>
                <dd>{client.email || "—"}</dd>
              </div>
              <div>
                <dt>Preferred</dt>
                <dd>{client.preferredContact || "—"}</dd>
              </div>
              <div>
                <dt>City / area</dt>
                <dd>{client.city || "—"}</dd>
              </div>
            </dl>
          </section>

          <ClientProperties client={client} onSave={onSave} />
        </div>
      ) : null}

      {tab === "activity" ? (
        <div className="client-tab-panel">
          {activity.length ? (
            <ol className="client-activity">
              {activity.map((item) => (
                <li key={item.id}>
                  <Link href={item.href}>
                    <strong>{item.label}</strong>
                    <span>{item.detail}</span>
                  </Link>
                </li>
              ))}
            </ol>
          ) : (
            <p className="client-related-empty">
              Activity will appear here as work connects to this client.
            </p>
          )}
        </div>
      ) : null}

      {tab === "requests" ? (
        <RelatedList
          empty="No requests yet. Create one with Create → Request."
          items={related.requests.map((r) => ({
            id: r.id,
            label: r.summary || r.status,
            meta: r.status,
            href: "/work/requests",
          }))}
        />
      ) : null}
      {tab === "quotes" ? (
        <RelatedList
          empty="No quotes yet. Create one with Create → Quote."
          items={related.quotes.map((q) => ({
            id: q.id,
            label: q.scope || q.status,
            meta: [q.amount != null ? moneyLabel(q.amount) : null, q.status]
              .filter(Boolean)
              .join(" · "),
            href: `/work/quotes?id=${encodeURIComponent(q.id)}`,
          }))}
        />
      ) : null}
      {tab === "jobs" ? (
        <RelatedList
          empty="No jobs yet. Create one with Create → Job."
          items={related.jobs.map((j) => ({
            id: j.id,
            label: j.service || j.title || j.customerName,
            meta: [j.scheduledDate, j.status].filter(Boolean).join(" · "),
            href: j.scheduledDate
              ? `/work/jobs?view=day&date=${encodeURIComponent(j.scheduledDate)}`
              : "/work/jobs",
          }))}
        />
      ) : null}
      {tab === "invoices" ? (
        <RelatedList
          empty="No invoices yet. Create one with Create → Invoice."
          items={related.invoices.map((i) => ({
            id: i.id,
            label: i.jobLabel || i.status,
            meta: [i.amount != null ? moneyLabel(i.amount) : null, i.status]
              .filter(Boolean)
              .join(" · "),
            href: "/work/invoices",
          }))}
        />
      ) : null}

      {tab === "notes" ? (
        <div className="client-tab-panel">
          {editing || client.notes ? (
            <label className="client-notes-edit">
              Notes
              <textarea
                rows={6}
                value={editing ? draft.notes : client.notes}
                readOnly={!editing}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, notes: e.target.value }))
                }
              />
            </label>
          ) : (
            <p className="client-related-empty">No notes yet. Use Edit client to add one.</p>
          )}
          {editing ? (
            <div className="client-confirm-actions">
              <button
                type="button"
                className="btn ghost small"
                onClick={() => {
                  setDraft(client);
                  setEditing(false);
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn primary small"
                onClick={() => {
                  onSave({ ...draft, updatedAt: new Date().toISOString() });
                  setEditing(false);
                }}
              >
                Save notes
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      {tab === "more" ? (
        <div className="client-tab-panel">
          {editing ? (
            <form
              className="client-edit-form"
              onSubmit={(e) => {
                e.preventDefault();
                onSave({ ...draft, updatedAt: new Date().toISOString() });
                setEditing(false);
              }}
            >
              <label>
                Name
                <input
                  value={draft.name}
                  onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                  required
                />
              </label>
              <label>
                Company
                <input
                  value={draft.companyName}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, companyName: e.target.value }))
                  }
                />
              </label>
              <label>
                Type
                <select
                  value={draft.clientType}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      clientType: e.target.value as ClientType,
                    }))
                  }
                >
                  <option value="residential">Residential</option>
                  <option value="commercial">Commercial</option>
                </select>
              </label>
              <label>
                Preferred contact
                <select
                  value={draft.preferredContact}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      preferredContact: e.target.value as PreferredContact,
                    }))
                  }
                >
                  <option value="">Not set</option>
                  <option value="phone">Phone</option>
                  <option value="email">Email</option>
                  <option value="text">Text</option>
                </select>
              </label>
              <label>
                Phone
                <input
                  value={draft.phone}
                  onChange={(e) => setDraft((d) => ({ ...d, phone: e.target.value }))}
                />
              </label>
              <label>
                Email
                <input
                  value={draft.email}
                  onChange={(e) => setDraft((d) => ({ ...d, email: e.target.value }))}
                />
              </label>
              <label>
                Service address
                <input
                  value={draft.address}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, address: e.target.value }))
                  }
                />
              </label>
              <label>
                Billing address
                <input
                  value={draft.billingAddress}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, billingAddress: e.target.value }))
                  }
                />
              </label>
              <label>
                City / service area
                <input
                  value={draft.city}
                  onChange={(e) => setDraft((d) => ({ ...d, city: e.target.value }))}
                />
              </label>
              <label>
                Tags (comma separated)
                <input
                  value={draft.tags.join(", ")}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      tags: e.target.value
                        .split(",")
                        .map((t) => t.trim())
                        .filter(Boolean),
                    }))
                  }
                />
              </label>
              <label className="client-check">
                <input
                  type="checkbox"
                  checked={draft.favorite}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, favorite: e.target.checked }))
                  }
                />
                Favorite / VIP
              </label>
              <div className="client-confirm-actions">
                <button
                  type="button"
                  className="btn ghost small"
                  onClick={() => {
                    setDraft(client);
                    setEditing(false);
                  }}
                >
                  Cancel
                </button>
                <button type="submit" className="btn primary small">
                  Save client
                </button>
              </div>
            </form>
          ) : (
            <>
              <p className="client-related-empty">
                Photos, files, and message history will live here when those
                modules are connected. Use Edit client for profile fields.
              </p>
              <button
                type="button"
                className="btn ghost small"
                onClick={() => setEditing(true)}
              >
                Edit client
              </button>
            </>
          )}
        </div>
      ) : null}
    </aside>
  );

  if (embedded) return body;

  return (
    <div className="client-drawer-backdrop" role="presentation" onClick={onClose}>
      {body}
    </div>
  );
}

function RelatedList({
  empty,
  items,
}: {
  empty: string;
  items: { id: string; label: string; meta: string; href: string }[];
}) {
  if (!items.length) {
    return <p className="client-related-empty">{empty}</p>;
  }
  return (
    <ul className="client-related-list">
      {items.map((item) => (
        <li key={item.id}>
          <Link href={item.href}>
            <strong>{item.label}</strong>
            <span>{item.meta}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
