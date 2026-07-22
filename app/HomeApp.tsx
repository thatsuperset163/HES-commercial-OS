"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { formatDisplayDate, todayKey } from "@/lib/dates";
import {
  buildClearDayMessage,
  buildHomeGreeting,
} from "@/lib/home/commandCenter";
import {
  buildHqExceptions,
  buildHqTodaySections,
  buildHqWeekGlance,
  type HqTodayItem,
} from "@/lib/home/todayOps";
import { buildWeekJobValue } from "@/lib/clients/weekValue";
import JobValueWeekCard from "./JobValueWeekCard";
import {
  cacheJobsFromRemote,
  getBlackboardCloudStatus,
  hydrateStoreFromCloud,
  listClients,
  listJobs,
  listQuotes,
  loadStore,
  subscribeBlackboardCloudStatus,
  upsertJob,
  type BlackboardCloudStatus,
} from "@/lib/storage";
import { createJobRemote, fetchJobs } from "@/lib/jobs/api";
import type { Job, JobInput } from "@/lib/jobs/types";
import type { IntakeRequest } from "@/lib/requestsCenter/types";
import AppShell from "./AppShell";
import CreateNewController from "./create/CreateNewController";
import JobForm from "./jobs/JobForm";
import HQWeekAtGlance from "./jobs/HQWeekAtGlance";
import "./jobs-os.css";
import "./home-shell.css";
import "./home-command.css";

function urgencyClass(urgency: string) {
  if (urgency === "critical" || urgency === "overdue") {
    return "status-chip overdue";
  }
  if (urgency === "today" || urgency === "new" || urgency === "now") {
    return "status-chip due-today";
  }
  if (urgency === "later") return "status-chip soon";
  return "status-chip soon";
}

async function fetchIntakeRequests(): Promise<IntakeRequest[]> {
  try {
    const res = await fetch("/api/requests", {
      credentials: "same-origin",
      headers: { Accept: "application/json" },
    });
    const json = (await res.json()) as {
      ok?: boolean;
      data?: { requests?: IntakeRequest[] };
    };
    if (!res.ok || !json.ok) return [];
    return json.data?.requests ?? [];
  } catch {
    return [];
  }
}

function TodayGroup({
  title,
  empty,
  items,
}: {
  title: string;
  empty: string;
  items: HqTodayItem[];
}) {
  return (
    <div className="home-today-group">
      <div className="home-today-group-head">
        <h3>{title}</h3>
        <span className="hq-pill">{items.length ? `${items.length}` : "Clear"}</span>
      </div>
      {items.length ? (
        <ul className="home-today-list">
          {items.map((item) => (
            <li key={item.id}>
              <Link href={item.href} className="home-today-item">
                <div className="home-today-meta">
                  {item.timeLabel ? (
                    <span className="home-today-time">{item.timeLabel}</span>
                  ) : (
                    <span className={urgencyClass(item.urgency)}>
                      {item.urgencyLabel}
                    </span>
                  )}
                </div>
                <div className="home-today-copy">
                  <strong>{item.title}</strong>
                  <span>{item.detail}</span>
                  <span className="home-today-submeta">{item.meta}</span>
                </div>
                <span className="home-today-action">{item.actionLabel} →</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="home-today-clear">{empty}</p>
      )}
    </div>
  );
}

export default function HomeApp() {
  const [ready, setReady] = useState(false);
  const [tick, setTick] = useState(0);
  const [scheduleJobs, setScheduleJobs] = useState<Job[]>([]);
  const [intake, setIntake] = useState<IntakeRequest[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [formInitial, setFormInitial] = useState<Partial<Job> | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [clients, setClients] = useState(listClients());
  const [cloudStatus, setCloudStatus] = useState<BlackboardCloudStatus>(
    getBlackboardCloudStatus,
  );
  const date = todayKey();

  const refreshMeta = useCallback(() => {
    setClients(listClients());
    setTick((v) => v + 1);
  }, []);

  useEffect(() => {
    const unsub = subscribeBlackboardCloudStatus(setCloudStatus);
    return unsub;
  }, []);

  useEffect(() => {
    let cancelled = false;
    void hydrateStoreFromCloud().then(async () => {
      if (cancelled) return;
      refreshMeta();
      const [remoteJobs, requests] = await Promise.all([
        fetchJobs().catch(() => listJobs()),
        fetchIntakeRequests(),
      ]);
      if (cancelled) return;
      // Local cache only — do not schedule cloud writes on HQ load.
      cacheJobsFromRemote(remoteJobs);
      setScheduleJobs(remoteJobs);
      setIntake(requests);
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [refreshMeta]);

  const handleJobSubmit = async (input: JobInput & { id?: string }) => {
    setSaving(true);
    setFormError(null);
    try {
      const saved = input.id
        ? await createJobRemote({ ...input, id: input.id })
        : await createJobRemote(input);
      upsertJob(saved);
      setScheduleJobs((prev) => {
        const idx = prev.findIndex((j) => j.id === saved.id);
        if (idx === -1) return [...prev, saved];
        const next = [...prev];
        next[idx] = saved;
        return next;
      });
      setFormOpen(false);
      setTick((v) => v + 1);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const snapshot = useMemo(() => {
    const store = loadStore();
    const jobs = scheduleJobs.length ? scheduleJobs : listJobs();
    const quotes = listQuotes();
    const today = buildHqTodaySections({
      requests: intake,
      jobs,
      quotes,
      today: date,
    });
    const exceptions = buildHqExceptions({
      jobs,
      quotes,
      requests: intake,
      linkFlags: store.clientLinkFlags,
      cloudStatus,
      today: date,
    });
    return {
      week: buildHqWeekGlance({
        jobs,
        quotes,
        requests: intake,
        today: date,
      }),
      weekValue: buildWeekJobValue(jobs, date),
      today,
      exceptions,
      clearMessage: buildClearDayMessage(jobs, date),
      liveCount: today.combined.length,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, scheduleJobs, intake, tick, cloudStatus]);

  if (!ready) {
    return (
      <AppShell>
        <p className="hq-lede">Loading…</p>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="home-page">
        <header className="home-hero home-hero-primary">
          <div>
            <p className="hq-eyebrow">Harris Exterior Solutions</p>
            <h1 className="home-hero-title">{buildHomeGreeting("Will")}</h1>
            <p className="home-hero-lede">
              {formatDisplayDate(date)}. What must move toward cash today.
            </p>
          </div>
          <CreateNewController
            size="small"
            label="Create New"
            onOpenJobForm={(initial) => {
              setFormInitial(initial);
              setFormError(null);
              setFormOpen(true);
            }}
            onQuickCreateJob={async (input) => {
              const saved = await createJobRemote(input);
              upsertJob(saved);
              setScheduleJobs((prev) => [...prev, saved]);
              setTick((v) => v + 1);
            }}
            onCreated={async () => {
              refreshMeta();
              const [remote, requests] = await Promise.all([
                fetchJobs().catch(() => listJobs()),
                fetchIntakeRequests(),
              ]);
              cacheJobsFromRemote(remote);
              setScheduleJobs(remote);
              setIntake(requests);
            }}
          />
        </header>

        <section className="home-today" aria-label="Today">
          <div className="hq-section-head">
            <h2>Today</h2>
            {snapshot.liveCount ? (
              <span className="hq-pill accent">{snapshot.liveCount} live</span>
            ) : (
              <span className="hq-pill">Clear</span>
            )}
          </div>

          {!snapshot.liveCount ? (
            <p className="home-today-clear">{snapshot.clearMessage}</p>
          ) : null}

          <TodayGroup
            title="Requests needing action"
            empty="You’re caught up on active requests."
            items={snapshot.today.requests}
          />
          <TodayGroup
            title="Jobs today"
            empty="No jobs scheduled today."
            items={snapshot.today.jobs}
          />
          <TodayGroup
            title="Quote follow-ups"
            empty="No quote follow-ups due today."
            items={snapshot.today.quotes}
          />

          <div className="home-today-links">
            <Link href="/work/requests" className="btn secondary small">
              Requests OS
            </Link>
            <Link href="/work/jobs" className="btn secondary small">
              Jobs OS
            </Link>
            <Link href="/work/quotes" className="btn secondary small">
              Quotes
            </Link>
          </div>
        </section>

        {snapshot.exceptions.length ? (
          <section className="home-exceptions" aria-label="Exceptions">
            <div className="hq-section-head">
              <h2>Exceptions</h2>
              <span className="hq-pill">{snapshot.exceptions.length}</span>
            </div>
            <ul className="home-exception-list">
              {snapshot.exceptions.map((row) => (
                <li key={row.id}>
                  <Link
                    href={row.href}
                    className={`home-exception-item is-${row.severity}`}
                  >
                    <strong>{row.title}</strong>
                    <span>{row.detail}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <JobValueWeekCard value={snapshot.weekValue} />

        <section className="home-secondary" aria-label="This week">
          <HQWeekAtGlance days={snapshot.week} />
        </section>
      </div>

      <JobForm
        open={formOpen}
        initial={formInitial}
        clients={clients}
        saving={saving}
        error={formError}
        onClose={() => setFormOpen(false)}
        onSubmit={handleJobSubmit}
      />
    </AppShell>
  );
}
