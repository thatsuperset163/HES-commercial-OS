"use client";

import Link from "next/link";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  clientDisplayName,
  clientInitials,
  formatClientSince,
} from "@/lib/clients/display";
import {
  buildClientActivity,
  buildClientSummary,
  gatherClientRelated,
  moneyLabel,
  type ClientRelated,
} from "@/lib/clients/related";
import type { Job } from "@/lib/jobs/types";
import type {
  InvoiceDoc,
  QuoteDoc,
  ServiceRequest,
  WorkClient,
  WorkTask,
} from "@/lib/work/types";
import ClientInitialsAvatar from "./ClientInitialsAvatar";
import ClientProperties from "./ClientProperties";

type Props = {
  client: WorkClient;
  requests: ServiceRequest[];
  quotes: QuoteDoc[];
  jobs: Job[];
  invoices: InvoiceDoc[];
  tasks: WorkTask[];
  onClose: () => void;
  onSave: (client: WorkClient) => void;
  onTogglePause: (client: WorkClient) => void;
  onArchive: (client: WorkClient) => void;
};

function mapsHref(address: string) {
  return `https://maps.google.com/?q=${encodeURIComponent(address)}`;
}

export default function ClientDetailDrawer({
  client,
  requests,
  quotes,
  jobs,
  invoices,
  tasks,
  onClose,
  onSave,
  onTogglePause,
  onArchive,
}: Props) {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState(false);

  const related: ClientRelated = useMemo(
    () =>
      gatherClientRelated(client, {
        requests,
        quotes,
        jobs,
        invoices,
        tasks,
      }),
    [client, requests, quotes, jobs, invoices, tasks],
  );

  const summary = useMemo(() => buildClientSummary(related), [related]);
  const activity = useMemo(() => buildClientActivity(related), [related]);
  const since = formatClientSince(client.createdAt);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (confirmArchive) setConfirmArchive(false);
        else if (menuOpen) setMenuOpen(false);
        else onClose();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, menuOpen, confirmArchive]);

  return (
    <div className="client-drawer-backdrop" role="presentation" onClick={onClose}>
      <aside
        className="client-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="client-drawer-head">
          <button
            ref={closeRef}
            type="button"
            className="btn ghost small"
            onClick={onClose}
          >
            Close
          </button>
          <div className="client-drawer-menu-wrap">
            <button
              type="button"
              className="client-overflow-btn"
              aria-label="Client options"
              aria-haspopup="menu"
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
                  {client.status === "active" ? "Archive client…" : "Already paused"}
                </button>
              </div>
            ) : null}
          </div>
        </header>

        {confirmArchive ? (
          <div className="client-confirm" role="alertdialog" aria-label="Confirm archive">
            <p>
              Archive <strong>{clientDisplayName(client)}</strong>? Their jobs,
              invoices, and history stay in the OS.
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
            <h2 id={titleId}>{clientDisplayName(client)}</h2>
            <p className="client-drawer-status">
              {client.status === "paused" ? "Paused" : "Active"}
              {since ? ` · Client since ${since}` : ""}
            </p>
          </div>
        </div>

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
            {client.notes ? (
              <div>
                <dt>Notes</dt>
                <dd>{client.notes}</dd>
              </div>
            ) : null}
          </dl>
        </section>

        <ClientProperties client={client} onSave={onSave} />

        <section className="client-drawer-section">
          <h3>Quick actions</h3>
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
            <Link className="btn ghost small" href="/work/requests">
              Create request
            </Link>
            <Link className="btn ghost small" href="/work/jobs">
              Schedule
            </Link>
            <Link className="btn ghost small" href="/work/quotes">
              Create quote
            </Link>
            <Link className="btn ghost small" href="/work/invoices">
              Create invoice
            </Link>
          </div>
        </section>

        <section className="client-drawer-section">
          <h3>Summary</h3>
          <ul className="client-summary-list">
            <li>
              <span>Next</span>
              <strong>{summary.nextActivity || "Nothing scheduled"}</strong>
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
            {summary.lifetimeRevenue > 0 ? (
              <li>
                <span>Collected</span>
                <strong>{moneyLabel(summary.lifetimeRevenue)}</strong>
              </li>
            ) : null}
          </ul>
        </section>

        <RelatedBlock
          title="Requests"
          empty="No requests linked"
          items={related.requests.map((r) => ({
            id: r.id,
            label: r.summary || r.status,
            meta: r.status,
            href: "/work/requests",
          }))}
        />
        <RelatedBlock
          title="Quotes"
          empty="No quotes linked"
          items={related.quotes.map((q) => ({
            id: q.id,
            label: q.scope || q.status,
            meta: [
              q.amount != null ? moneyLabel(q.amount) : null,
              q.status,
            ]
              .filter(Boolean)
              .join(" · "),
            href: "/work/quotes",
          }))}
        />
        <RelatedBlock
          title="Jobs"
          empty="No jobs linked"
          items={related.jobs.map((j) => ({
            id: j.id,
            label: j.service || j.title || j.customerName,
            meta: [j.scheduledDate, j.status].filter(Boolean).join(" · "),
            href: j.scheduledDate
              ? `/work/jobs?view=day&date=${encodeURIComponent(j.scheduledDate)}`
              : "/work/jobs",
          }))}
        />
        <RelatedBlock
          title="Invoices"
          empty="No invoices linked"
          items={related.invoices.map((i) => ({
            id: i.id,
            label: i.jobLabel || i.status,
            meta: [
              i.amount != null ? moneyLabel(i.amount) : null,
              i.status,
            ]
              .filter(Boolean)
              .join(" · "),
            href: "/work/invoices",
          }))}
        />

        {activity.length ? (
          <section className="client-drawer-section">
            <h3>Activity</h3>
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
          </section>
        ) : null}
      </aside>
    </div>
  );
}

function RelatedBlock({
  title,
  empty,
  items,
}: {
  title: string;
  empty: string;
  items: { id: string; label: string; meta: string; href: string }[];
}) {
  return (
    <section className="client-drawer-section">
      <h3>
        {title}
        {items.length ? (
          <span className="client-count">{items.length}</span>
        ) : null}
      </h3>
      {items.length ? (
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
      ) : (
        <p className="client-related-empty">{empty}</p>
      )}
    </section>
  );
}
