"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { DayEntry, MetricKey } from "@/lib/types";
import { METRIC_LABELS } from "@/lib/types";
import { formatDisplayDate, formatShortDate, todayKey } from "@/lib/dates";
import { getLastNDayCharts } from "@/lib/charts";
import { getRealmStreaks } from "@/lib/progress";
import {
  getOrCreateDay,
  hydrateStoreFromCloud,
  listClients,
  listJobs,
  listRequests,
  loadStore,
  upsertDay,
  upsertJob,
} from "@/lib/storage";
import { createJobRemote, fetchJobs } from "@/lib/jobs/api";
import { buildWeekGlance } from "@/lib/jobs/calendar";
import type { Job, JobInput } from "@/lib/jobs/types";
import {
  buildPipelineCounts,
  buildPipelineNextActions,
} from "@/lib/work/pipeline";
import AppShell from "./AppShell";
import { BarChart } from "./BarChart";
import CreateNewController from "./create/CreateNewController";
import JobForm from "./jobs/JobForm";
import HQWeekAtGlance from "./jobs/HQWeekAtGlance";
import "./jobs-os.css";

export default function HomeApp() {
  const [ready, setReady] = useState(false);
  const [day, setDay] = useState<DayEntry | null>(null);
  const [scheduleJobs, setScheduleJobs] = useState<Job[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [formInitial, setFormInitial] = useState<Partial<Job> | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [clients, setClients] = useState(listClients());
  const [requestOptions, setRequestOptions] = useState<
    { id: string; label: string }[]
  >([]);
  const date = todayKey();

  const refreshMeta = useCallback(() => {
    setClients(listClients());
    setRequestOptions(
      listRequests().map((r) => ({
        id: r.id,
        label: `${r.clientName} · ${r.summary || "Request"}`,
      })),
    );
  }, []);

  const refresh = useCallback(() => {
    const store = loadStore();
    const entry = getOrCreateDay(store, date);
    if (!store.days[date]) upsertDay(store, entry);
    setDay(entry);
    setReady(true);
  }, [date]);

  useEffect(() => {
    let cancelled = false;
    void hydrateStoreFromCloud().then(async () => {
      if (cancelled) return;
      refresh();
      refreshMeta();
      try {
        const remote = await fetchJobs();
        if (!cancelled) setScheduleJobs(remote);
      } catch {
        if (!cancelled) setScheduleJobs(listJobs());
      }
    });
    return () => {
      cancelled = true;
    };
  }, [refresh, refreshMeta]);

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
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const snapshot = useMemo(() => {
    if (!day) return null;
    const store = loadStore();
    const charts = getLastNDayCharts(store, 7, date);
    const recent = Object.values(store.days)
      .filter(
        (entry) =>
          entry.date !== date &&
          (entry.notes?.trim() || entry.personalNotes?.trim()),
      )
      .sort((a, b) => (a.date < b.date ? 1 : -1))
      .slice(0, 4);
    const pipeline = buildPipelineCounts(store);
    const workActions = buildPipelineNextActions(store);
    const week = buildWeekGlance(
      scheduleJobs.length ? scheduleJobs : listJobs(),
      date,
    );
    return {
      charts,
      recent,
      pipeline,
      week,
      workTop: workActions[0] ?? null,
      personalStreak: getRealmStreaks(store, date).personal,
      totals: {
        doors: charts.reduce((sum, point) => sum + point.doors, 0),
        conversations: charts.reduce(
          (sum, point) => sum + point.conversations,
          0,
        ),
        phoneNumbers: charts.reduce((sum, point) => sum + point.phoneNumbers, 0),
        quotes: charts.reduce((sum, point) => sum + point.quotes, 0),
        jobsBooked: charts.reduce((sum, point) => sum + point.jobsBooked, 0),
      },
    };
  }, [day, date, scheduleJobs]);

  if (!ready || !day || !snapshot) {
    return (
      <AppShell>
        <p className="hq-lede">Loading HQ…</p>
      </AppShell>
    );
  }

  const personalGoal = day.goals.find((goal) => goal.category === "personal");
  const personalFocus = personalGoal?.text;
  const workFocus = day.goals.find((goal) => goal.category === "business")?.text;
  const personalChecklistDone = day.dailyChecklist.filter((item) => item.done)
    .length;
  const personalChecklistTotal = day.dailyChecklist.length;
  const personalStreak = snapshot.personalStreak;

  return (
    <AppShell>
      <div className="hq-page">
        <header className="page-intro">
          <div>
            <p className="hq-eyebrow">Command overview</p>
            <h2>{formatDisplayDate(date)}</h2>
            <p>
              Today&apos;s direction, operating pulse, and next moves across HES.
            </p>
          </div>
          <div className="hq-intro-actions">
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
              }}
              onCreated={async () => {
                refreshMeta();
                try {
                  setScheduleJobs(await fetchJobs());
                } catch {
                  setScheduleJobs(listJobs());
                }
              }}
            />
            <span className="hq-pill accent">Live overview</span>
          </div>
        </header>

        <section
          className="hq-metric-strip"
          aria-label="Seven-day operating metrics"
        >
          {(Object.keys(METRIC_LABELS) as MetricKey[]).map((key) => (
            <div className="hq-metric" key={key}>
              <span>{METRIC_LABELS[key]} · 7d</span>
              <strong>{snapshot.totals[key]}</strong>
            </div>
          ))}
        </section>

        <section className="pipeline-strip hq-pipeline" aria-label="Work pipeline">
          {snapshot.pipeline.map((item) => (
            <Link key={item.id} href={item.href} className="pipeline-chip">
              <span className="pipeline-chip-label">{item.label}</span>
              <strong>{item.count}</strong>
              {item.attention > 0 ? (
                <span className="pipeline-chip-attn">{item.attention} open</span>
              ) : (
                <span className="pipeline-chip-attn muted">Clear</span>
              )}
            </Link>
          ))}
        </section>

        <HQWeekAtGlance days={snapshot.week} />

        {snapshot.workTop ? (
          <section className="hq-card hq-work-next">
            <div className="hq-section-head">
              <h2>Work · do this next</h2>
              <span className="hq-pill">Live</span>
            </div>
            <p className="hq-work-next-title">{snapshot.workTop.title}</p>
            <p>{snapshot.workTop.reason}</p>
            <Link href={snapshot.workTop.href} className="hq-link">
              Open in Work →
            </Link>
          </section>
        ) : null}

        <div className="hq-split">
          <section className="hq-card focus-summary">
            <div className="hq-section-head">
              <h2>Current focus</h2>
              <span className="hq-pill">Today</span>
            </div>
            <div className="hq-focus-grid">
              <article className="hq-focus-card">
                <span className="hq-kicker">Personal</span>
                <p>{personalFocus || "Open Personal for today’s hunt coach."}</p>
                <p className="hq-focus-meta">
                  {personalGoal?.done ? "Focus done · " : ""}
                  Checklist {personalChecklistDone}/{personalChecklistTotal}
                  {personalStreak > 0 ? ` · ${personalStreak}d streak` : ""}
                </p>
                <Link href="/personal" className="hq-link">
                  Open Personal →
                </Link>
              </article>
              <article className="hq-focus-card">
                <span className="hq-kicker">Work</span>
                <p>
                  {workFocus ||
                    snapshot.workTop?.title ||
                    "Open Work and pick a desk."}
                </p>
                <Link href="/work" className="hq-link">
                  Open Work →
                </Link>
              </article>
            </div>
          </section>

          <section className="hq-card sales-launch">
            <p className="hq-eyebrow">Work operating systems</p>
            <h2>Get to work, Son</h2>
            <p>
              Requests, clients, quotes, jobs, invoices, tasks, and expenses —
              live under Work, visible here.
            </p>
            <Link href="/work" className="hq-btn">
              Open Work →
            </Link>
          </section>
        </div>

        <section className="hq-card">
          <div className="hq-section-head">
            <h2>Operating trend</h2>
            <span className="hq-pill">Last 7 days</span>
          </div>
          <div className="chart-grid">
            <BarChart
              title="Doors knocked"
              points={snapshot.charts.map((point) => ({
                label: point.label,
                value: point.doors,
              }))}
            />
            <BarChart
              title="Conversations"
              points={snapshot.charts.map((point) => ({
                label: point.label,
                value: point.conversations,
              }))}
            />
            <BarChart
              title="Quotes"
              points={snapshot.charts.map((point) => ({
                label: point.label,
                value: point.quotes,
              }))}
            />
            <BarChart
              title="Jobs booked"
              points={snapshot.charts.map((point) => ({
                label: point.label,
                value: point.jobsBooked,
              }))}
            />
          </div>
        </section>

        <div className="hq-split">
          <section className="hq-card">
            <div className="hq-section-head">
              <h2>Today&apos;s notes</h2>
              <span className="hq-pill">Live</span>
            </div>
            <div className="notes-summary">
              <div>
                <span className="hq-kicker">Personal</span>
                <p>{day.personalNotes || "No personal note yet."}</p>
              </div>
              <div>
                <span className="hq-kicker">Work</span>
                <p>{day.notes || "No work note yet."}</p>
              </div>
            </div>
          </section>
          <section className="hq-card">
            <div className="hq-section-head">
              <h2>Recent signals</h2>
              <span className="hq-pill">History</span>
            </div>
            {snapshot.recent.length ? (
              <div className="signal-list">
                {snapshot.recent.map((entry) => (
                  <article className="signal-row" key={entry.date}>
                    <span>{formatShortDate(entry.date)}</span>
                    <p>{entry.notes?.trim() || entry.personalNotes}</p>
                  </article>
                ))}
              </div>
            ) : (
              <p className="empty-state">
                Notes and operating signals will surface here over time.
              </p>
            )}
          </section>
        </div>
      </div>

      <JobForm
        open={formOpen}
        initial={formInitial}
        clients={clients}
        requests={requestOptions}
        prospects={[]}
        saving={saving}
        error={formError}
        onClose={() => setFormOpen(false)}
        onSubmit={handleJobSubmit}
      />
    </AppShell>
  );
}
