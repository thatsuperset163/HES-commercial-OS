"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  formatDisplayDate,
  formatShortDate,
  todayKey,
} from "@/lib/dates";
import {
  advanceJobStatus,
  createJob,
  patchJob,
} from "@/lib/jobs/model";
import { buildJobNextActions } from "@/lib/jobs/nextActions";
import type { Job, JobStatus } from "@/lib/jobs/types";
import { jobStatusLabel } from "@/lib/jobs/types";
import {
  hydrateStoreFromCloud,
  listJobs,
  removeJob,
  upsertJob,
} from "@/lib/storage";
import AppShell from "./AppShell";

function money(value: number | null) {
  if (value == null || !Number.isFinite(value)) return "";
  return `$${Math.round(value).toLocaleString("en-US")}`;
}

function urgencyLabel(urgency: string) {
  if (urgency === "overdue") return "Overdue";
  if (urgency === "today") return "Today";
  if (urgency === "money") return "Bill it";
  return "Soon";
}

function primaryActionLabel(status: JobStatus) {
  if (status === "scheduled") return "Mark done";
  if (status === "done") return "Mark invoiced";
  return null;
}

export default function JobsApp() {
  const [ready, setReady] = useState(false);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [toast, setToast] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const today = todayKey();

  const refresh = useCallback(() => {
    setJobs(listJobs());
  }, []);

  useEffect(() => {
    let cancelled = false;
    void hydrateStoreFromCloud().then(() => {
      if (cancelled) return;
      refresh();
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  const persist = useCallback(
    (job: Job) => {
      upsertJob(job);
      refresh();
      setToast(true);
      window.setTimeout(() => setToast(false), 900);
    },
    [refresh],
  );

  const actions = useMemo(() => buildJobNextActions(jobs), [jobs]);
  const top = actions[0] ?? null;

  const todayJobs = useMemo(
    () =>
      jobs
        .filter(
          (job) =>
            job.status !== "cancelled" &&
            (job.scheduledDate === today || job.status === "done"),
        )
        .sort((a, b) => {
          if (a.status === "done" && b.status !== "done") return -1;
          if (b.status === "done" && a.status !== "done") return 1;
          return a.customerName.localeCompare(b.customerName);
        }),
    [jobs, today],
  );

  const upcoming = useMemo(
    () =>
      jobs
        .filter(
          (job) => job.status === "scheduled" && job.scheduledDate > today,
        )
        .sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate))
        .slice(0, 8),
    [jobs, today],
  );

  const unbilled = useMemo(
    () => jobs.filter((job) => job.status === "done"),
    [jobs],
  );

  function onCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fd = new FormData(event.currentTarget);
    const amountRaw = String(fd.get("amount") || "").trim();
    const job = createJob({
      customerName: String(fd.get("customerName") || ""),
      address: String(fd.get("address") || ""),
      service: String(fd.get("service") || ""),
      scheduledDate: String(fd.get("scheduledDate") || today),
      amount: amountRaw === "" ? null : Number(amountRaw),
      notes: String(fd.get("notes") || ""),
    });
    persist(job);
    setShowNew(false);
    event.currentTarget.reset();
  }

  function advance(job: Job) {
    const next = advanceJobStatus(job);
    if (next === job) return;
    persist(next);
  }

  if (!ready) {
    return (
      <AppShell>
        <p className="brand-sub">Loading Jobs OS…</p>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="page-intro">
        <div>
          <p className="hq-eyebrow">Jobs OS</p>
          <h2>{formatDisplayDate(today)}</h2>
          <p>Schedule it. Run it. Mark done. Bill it.</p>
        </div>
        <div className="jobs-intro-actions">
          <Link href="/work" className="btn secondary">
            Work home
          </Link>
          <button type="button" className="btn accent" onClick={() => setShowNew(true)}>
            Add job
          </button>
        </div>
      </div>

      {top ? (
        <section className="panel focus-panel jobs-focus" aria-label="Do this next">
          <div className="panel-head">
            <h2 className="panel-title">Do this next</h2>
            <span className={`urgency-tag ${top.urgency}`}>
              {urgencyLabel(top.urgency)}
            </span>
          </div>
          <div className="jobs-focus-body">
            <strong>{top.title}</strong>
            <p>{top.reason}</p>
            <p className="jobs-focus-meta">
              {formatShortDate(top.scheduledDate)}
              {top.amount != null ? ` · ${money(top.amount)}` : ""}
              {` · ${jobStatusLabel(top.status)}`}
            </p>
          </div>
          <div className="row-actions">
            {primaryActionLabel(top.status) ? (
              <button
                type="button"
                className="btn accent"
                onClick={() => {
                  const job = jobs.find((row) => row.id === top.jobId);
                  if (job) advance(job);
                }}
              >
                {primaryActionLabel(top.status)}
              </button>
            ) : null}
            <button
              type="button"
              className="btn secondary"
              onClick={() => {
                const job = jobs.find((row) => row.id === top.jobId);
                if (!job) return;
                const nextDate = window.prompt(
                  "Reschedule to (YYYY-MM-DD)",
                  job.scheduledDate,
                );
                if (!nextDate) return;
                persist(patchJob(job, { scheduledDate: nextDate, status: "scheduled" }));
              }}
            >
              Reschedule
            </button>
          </div>
        </section>
      ) : (
        <section className="panel">
          <p className="empty-state">
            No urgent jobs. Add a job or enjoy a clear board.
          </p>
        </section>
      )}

      <div className="content-grid jobs-grid">
        <section className="panel">
          <div className="panel-head">
            <h2 className="panel-title">Today & unbilled</h2>
            <span className="panel-meta">
              {todayJobs.length} active · {unbilled.length} to invoice
            </span>
          </div>
          {todayJobs.length === 0 ? (
            <p className="empty-state">Nothing on for today yet.</p>
          ) : (
            <ul className="jobs-list">
              {todayJobs.map((job) => (
                <JobRow
                  key={job.id}
                  job={job}
                  onAdvance={() => advance(job)}
                  onRemove={() => {
                    if (confirm(`Remove ${job.customerName}?`)) {
                      removeJob(job.id);
                      refresh();
                    }
                  }}
                />
              ))}
            </ul>
          )}
        </section>

        <section className="panel">
          <div className="panel-head">
            <h2 className="panel-title">Upcoming</h2>
            <span className="panel-meta">Next on the calendar</span>
          </div>
          {upcoming.length === 0 ? (
            <p className="empty-state">No upcoming scheduled jobs.</p>
          ) : (
            <ul className="jobs-list">
              {upcoming.map((job) => (
                <JobRow
                  key={job.id}
                  job={job}
                  onAdvance={() => advance(job)}
                  onRemove={() => {
                    if (confirm(`Remove ${job.customerName}?`)) {
                      removeJob(job.id);
                      refresh();
                    }
                  }}
                />
              ))}
            </ul>
          )}
        </section>
      </div>

      {showNew ? (
        <div className="modal-backdrop" role="presentation" onClick={() => setShowNew(false)}>
          <div
            className="modal-card"
            role="dialog"
            aria-modal="true"
            aria-label="Add job"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="panel-head">
              <h2 className="panel-title">Add job</h2>
              <button type="button" className="btn secondary" onClick={() => setShowNew(false)}>
                Close
              </button>
            </div>
            <form className="jobs-form" onSubmit={onCreate}>
              <label className="field-label">
                Customer
                <input className="field" name="customerName" required placeholder="Name or company" />
              </label>
              <label className="field-label">
                Address
                <input className="field" name="address" placeholder="Job site" />
              </label>
              <label className="field-label">
                Service
                <input
                  className="field"
                  name="service"
                  placeholder="Pressure wash, windows…"
                  defaultValue="Exterior cleaning"
                />
              </label>
              <div className="jobs-form-row">
                <label className="field-label">
                  Date
                  <input className="field" name="scheduledDate" type="date" required defaultValue={today} />
                </label>
                <label className="field-label">
                  Amount
                  <input className="field" name="amount" type="number" min="0" step="1" placeholder="0" />
                </label>
              </div>
              <label className="field-label">
                Notes
                <textarea className="field textarea" name="notes" rows={2} placeholder="Access, gate code, scope…" />
              </label>
              <div className="row-actions">
                <button type="button" className="btn secondary" onClick={() => setShowNew(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn accent">
                  Save job
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

function JobRow({
  job,
  onAdvance,
  onRemove,
}: {
  job: Job;
  onAdvance: () => void;
  onRemove: () => void;
}) {
  const action = primaryActionLabel(job.status);
  return (
    <li className={`jobs-row status-${job.status}`}>
      <div className="jobs-row-main">
        <strong>{job.customerName}</strong>
        <span>
          {formatShortDate(job.scheduledDate)}
          {job.address ? ` · ${job.address}` : ""}
          {job.amount != null ? ` · ${money(job.amount)}` : ""}
        </span>
        <span className="jobs-status">{jobStatusLabel(job.status)} · {job.service}</span>
      </div>
      <div className="jobs-row-actions">
        {action ? (
          <button type="button" className="btn small accent" onClick={onAdvance}>
            {action}
          </button>
        ) : null}
        <button type="button" className="btn small secondary" onClick={onRemove}>
          Remove
        </button>
      </div>
    </li>
  );
}
