"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { formatDisplayDate, todayKey } from "@/lib/dates";
import {
  buildClearDayMessage,
  buildHomeGreeting,
  buildHomeModules,
  buildTodayAttention,
} from "@/lib/home/commandCenter";
import {
  hydrateStoreFromCloud,
  listClients,
  listJobs,
  loadStore,
  upsertJob,
} from "@/lib/storage";
import { createJobRemote, fetchJobs } from "@/lib/jobs/api";
import { buildWeekGlance } from "@/lib/jobs/calendar";
import type { Job, JobInput } from "@/lib/jobs/types";
import AppShell from "./AppShell";
import CreateNewController from "./create/CreateNewController";
import JobForm from "./jobs/JobForm";
import HQWeekAtGlance from "./jobs/HQWeekAtGlance";
import "./jobs-os.css";
import "./home-shell.css";
import "./home-command.css";

function urgencyClass(urgency: string) {
  if (urgency === "overdue") return "status-chip overdue";
  if (urgency === "today") return "status-chip due-today";
  if (urgency === "money") return "status-chip money";
  return "status-chip soon";
}

function urgencyLabel(urgency: string) {
  if (urgency === "overdue") return "Overdue";
  if (urgency === "today") return "Today";
  if (urgency === "money") return "Money";
  return "Soon";
}

export default function HomeApp() {
  const [ready, setReady] = useState(false);
  const [tick, setTick] = useState(0);
  const [scheduleJobs, setScheduleJobs] = useState<Job[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [formInitial, setFormInitial] = useState<Partial<Job> | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [clients, setClients] = useState(listClients());
  const date = todayKey();

  const refreshMeta = useCallback(() => {
    setClients(listClients());
    setTick((v) => v + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void hydrateStoreFromCloud().then(async () => {
      if (cancelled) return;
      refreshMeta();
      try {
        const remote = await fetchJobs();
        if (cancelled) return;
        for (const job of remote) upsertJob(job);
        setScheduleJobs(remote);
      } catch {
        if (!cancelled) setScheduleJobs(listJobs());
      }
      if (!cancelled) setReady(true);
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
    return {
      week: buildWeekGlance(jobs, date),
      today: buildTodayAttention(store, jobs, 5),
      clearMessage: buildClearDayMessage(jobs, date),
      modules: buildHomeModules(store, jobs),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, scheduleJobs, tick]);

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
              {formatDisplayDate(date)}. Here is what needs your attention
              today.
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
              try {
                const remote = await fetchJobs();
                for (const job of remote) upsertJob(job);
                setScheduleJobs(remote);
              } catch {
                setScheduleJobs(listJobs());
              }
            }}
          />
        </header>

        <section className="home-today" aria-label="Today">
          <div className="hq-section-head">
            <h2>Today</h2>
            {snapshot.today.length ? (
              <span className="hq-pill accent">{snapshot.today.length} live</span>
            ) : (
              <span className="hq-pill">Clear</span>
            )}
          </div>

          {snapshot.today.length ? (
            <ul className="home-today-list">
              {snapshot.today.map((item) => (
                <li key={item.id}>
                  <Link href={item.href} className="home-today-item">
                    <div className="home-today-meta">
                      {item.timeLabel ? (
                        <span className="home-today-time">{item.timeLabel}</span>
                      ) : (
                        <span className={urgencyClass(item.urgency)}>
                          {urgencyLabel(item.urgency)}
                        </span>
                      )}
                    </div>
                    <div className="home-today-copy">
                      <strong>{item.title}</strong>
                      <span>{item.detail}</span>
                    </div>
                    <span className="home-today-action">{item.actionLabel} →</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="home-today-clear">{snapshot.clearMessage}</p>
          )}
        </section>

        <section className="home-secondary" aria-label="This week">
          <HQWeekAtGlance days={snapshot.week} />
        </section>

        <section className="home-modules" aria-label="Operating modules">
          <div className="hq-section-head">
            <h2>Desks</h2>
            <span className="hq-pill">Live</span>
          </div>
          <div className="home-module-grid">
            {snapshot.modules.map((mod) => (
              <Link
                key={mod.id}
                href={mod.href}
                className={`home-module-card${mod.attention ? " needs-attention" : ""}`}
              >
                <strong>{mod.label}</strong>
                {mod.lines.map((line) => (
                  <span key={line}>{line}</span>
                ))}
              </Link>
            ))}
          </div>
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
