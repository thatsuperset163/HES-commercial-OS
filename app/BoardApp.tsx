"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { formatDisplayDate, todayKey } from "@/lib/dates";
import { buildJobNextActions } from "@/lib/jobs/nextActions";
import { jobStatusLabel } from "@/lib/jobs/types";
import {
  hydrateStoreFromCloud,
  listJobs,
  loadStore,
} from "@/lib/storage";
import AppShell from "./AppShell";

const PEER_OS = [
  {
    id: "sales",
    name: "Sales OS",
    purpose: "Commercial pipeline, outreach, follow-ups",
    href: "/work/sales/",
    status: "live" as const,
    external: true,
  },
  {
    id: "jobs",
    name: "Jobs OS",
    purpose: "Schedule → run → done",
    href: "/work/jobs",
    status: "live" as const,
    external: false,
  },
  {
    id: "money",
    name: "Money OS",
    purpose: "Unbilled + unpaid → cash in",
    href: "/work/money",
    status: "next" as const,
    external: false,
  },
  {
    id: "leads",
    name: "Inbox / Leads",
    purpose: "Same-day inbound response",
    href: "/work/leads",
    status: "later" as const,
    external: false,
  },
  {
    id: "reputation",
    name: "Reputation OS",
    purpose: "Reviews and referrals after jobs",
    href: "/work/reputation",
    status: "later" as const,
    external: false,
  },
];

function money(value: number | null) {
  if (value == null || !Number.isFinite(value)) return "";
  return `$${Math.round(value).toLocaleString("en-US")}`;
}

export default function BoardApp() {
  const [ready, setReady] = useState(false);
  const [tick, setTick] = useState(0);
  const date = todayKey();

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

  const snapshot = useMemo(() => {
    const jobs = listJobs(loadStore());
    const actions = buildJobNextActions(jobs);
    return {
      jobs,
      top: actions[0] ?? null,
      unbilled: jobs.filter((job) => job.status === "done").length,
      todayCount: jobs.filter(
        (job) => job.status === "scheduled" && job.scheduledDate === date,
      ).length,
    };
    // tick refreshes after hydrate
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, tick]);

  const refresh = useCallback(() => {
    setTick((value) => value + 1);
  }, []);

  if (!ready) {
    return (
      <AppShell>
        <p className="brand-sub">Loading work…</p>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="page-intro">
        <div>
          <p className="hq-eyebrow">Work</p>
          <h2>{formatDisplayDate(date)}</h2>
          <p>Peer operating systems — pick a lane, do the next move.</p>
        </div>
        <button type="button" className="btn secondary" onClick={refresh}>
          Refresh
        </button>
      </div>

      {snapshot.top ? (
        <section className="panel focus-panel jobs-focus" aria-label="Do this next">
          <div className="panel-head">
            <h2 className="panel-title">Do this next</h2>
            <span className="panel-meta">From Jobs OS</span>
          </div>
          <div className="jobs-focus-body">
            <strong>{snapshot.top.title}</strong>
            <p>{snapshot.top.reason}</p>
            <p className="jobs-focus-meta">
              {jobStatusLabel(snapshot.top.status)}
              {snapshot.top.amount != null ? ` · ${money(snapshot.top.amount)}` : ""}
            </p>
          </div>
          <div className="row-actions">
            <Link className="btn accent" href="/work/jobs">
              Open in Jobs OS →
            </Link>
          </div>
        </section>
      ) : (
        <section className="panel">
          <p className="empty-state">
            No urgent job actions. Open an OS below — or add a job to get a queue.
          </p>
        </section>
      )}

      <section className="panel">
        <div className="panel-head">
          <h2 className="panel-title">Operating systems</h2>
          <span className="panel-meta">
            {snapshot.todayCount} jobs today · {snapshot.unbilled} unbilled
          </span>
        </div>
        <div className="os-grid">
          {PEER_OS.map((os) => {
            const live = os.status === "live";
            const body = (
              <>
                <div className="os-card-top">
                  <h3>{os.name}</h3>
                  <span className={`os-pill ${os.status}`}>
                    {os.status === "live"
                      ? "Live"
                      : os.status === "next"
                        ? "Next up"
                        : "Later"}
                  </span>
                </div>
                <p>{os.purpose}</p>
                <span className="os-card-cta">
                  {live ? "Enter →" : "Queued in roadmap"}
                </span>
              </>
            );
            if (!live) {
              return (
                <article key={os.id} className="os-card muted">
                  {body}
                </article>
              );
            }
            if (os.external) {
              return (
                <a key={os.id} className="os-card" href={os.href}>
                  {body}
                </a>
              );
            }
            return (
              <Link key={os.id} className="os-card" href={os.href}>
                {body}
              </Link>
            );
          })}
        </div>
      </section>
    </AppShell>
  );
}
