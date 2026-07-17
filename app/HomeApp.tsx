"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { DayEntry, MetricKey } from "@/lib/types";
import { METRIC_LABELS } from "@/lib/types";
import { formatDisplayDate, formatShortDate, todayKey } from "@/lib/dates";
import { getLastNDayCharts } from "@/lib/charts";
import { getRealmStreaks } from "@/lib/progress";
import { getOrCreateDay, hydrateStoreFromCloud, loadStore, upsertDay } from "@/lib/storage";
import AppShell from "./AppShell";
import { BarChart } from "./BarChart";

export default function HomeApp() {
  const [ready, setReady] = useState(false);
  const [day, setDay] = useState<DayEntry | null>(null);
  const date = todayKey();

  const refresh = useCallback(() => {
    const store = loadStore();
    const entry = getOrCreateDay(store, date);
    if (!store.days[date]) upsertDay(store, entry);
    setDay(entry);
    setReady(true);
  }, [date]);

  useEffect(() => {
    let cancelled = false;
    void hydrateStoreFromCloud().then(() => {
      if (!cancelled) refresh();
    });
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  const snapshot = useMemo(() => {
    if (!day) return null;
    const store = loadStore();
    const charts = getLastNDayCharts(store, 7, date);
    const recent = Object.values(store.days)
      .filter((entry) => entry.date !== date && (entry.notes?.trim() || entry.personalNotes?.trim()))
      .sort((a, b) => (a.date < b.date ? 1 : -1))
      .slice(0, 4);
    return {
      charts,
      recent,
      personalStreak: getRealmStreaks(store, date).personal,
      totals: {
        doors: charts.reduce((sum, point) => sum + point.doors, 0),
        conversations: charts.reduce((sum, point) => sum + point.conversations, 0),
        phoneNumbers: charts.reduce((sum, point) => sum + point.phoneNumbers, 0),
        quotes: charts.reduce((sum, point) => sum + point.quotes, 0),
        jobsBooked: charts.reduce((sum, point) => sum + point.jobsBooked, 0),
      },
    };
  }, [day, date]);

  if (!ready || !day || !snapshot) {
    return <AppShell><p className="hq-lede">Loading HQ…</p></AppShell>;
  }

  const personalGoal = day.goals.find((goal) => goal.category === "personal");
  const personalFocus = personalGoal?.text;
  const workFocus = day.goals.find((goal) => goal.category === "business")?.text;
  const personalChecklistDone = day.dailyChecklist.filter((item) => item.done).length;
  const personalChecklistTotal = day.dailyChecklist.length;
  const personalStreak = snapshot.personalStreak;

  return (
    <AppShell>
      <div className="hq-page">
        <header className="page-intro">
          <div>
            <p className="hq-eyebrow">Command overview</p>
            <h2>{formatDisplayDate(date)}</h2>
            <p>Today&apos;s direction, operating pulse, and next moves across HES.</p>
          </div>
          <span className="hq-pill accent">Live overview</span>
        </header>

        <section className="hq-metric-strip" aria-label="Seven-day operating metrics">
          {(Object.keys(METRIC_LABELS) as MetricKey[]).map((key) => (
            <div className="hq-metric" key={key}>
              <span>{METRIC_LABELS[key]} · 7d</span>
              <strong>{snapshot.totals[key]}</strong>
            </div>
          ))}
        </section>

        <div className="hq-split">
          <section className="hq-card focus-summary">
            <div className="hq-section-head"><h2>Current focus</h2><span className="hq-pill">Today</span></div>
            <div className="hq-focus-grid">
              <article className="hq-focus-card">
                <span className="hq-kicker">Personal</span>
                <p>{personalFocus || "Set today’s personal direction."}</p>
                <p className="hq-focus-meta">
                  {personalGoal?.done ? "Focus done · " : ""}
                  Checklist {personalChecklistDone}/{personalChecklistTotal}
                  {personalStreak > 0 ? ` · ${personalStreak}d streak` : ""}
                </p>
                <Link href="/personal" className="hq-link">Open Personal →</Link>
              </article>
              <article className="hq-focus-card">
                <span className="hq-kicker">Work</span>
                <p>{workFocus || "Set today’s work priority."}</p>
                <Link href="/work" className="hq-link">Open Work →</Link>
              </article>
            </div>
          </section>

          <section className="hq-card sales-launch">
            <p className="hq-eyebrow">Commercial Sales</p>
            <h2>Build the next account</h2>
            <p>Prospecting, follow-ups, quotes, and pipeline analytics live inside Work.</p>
            <a href="/work/sales/" className="hq-btn">Enter Sales OS →</a>
          </section>
        </div>

        <section className="hq-card">
          <div className="hq-section-head"><h2>Operating trend</h2><span className="hq-pill">Last 7 days</span></div>
          <div className="chart-grid">
            <BarChart title="Doors knocked" points={snapshot.charts.map((point) => ({ label: point.label, value: point.doors }))} />
            <BarChart title="Conversations" points={snapshot.charts.map((point) => ({ label: point.label, value: point.conversations }))} />
            <BarChart title="Quotes" points={snapshot.charts.map((point) => ({ label: point.label, value: point.quotes }))} />
            <BarChart title="Jobs booked" points={snapshot.charts.map((point) => ({ label: point.label, value: point.jobsBooked }))} />
          </div>
        </section>

        <div className="hq-split">
          <section className="hq-card">
            <div className="hq-section-head"><h2>Today&apos;s notes</h2><span className="hq-pill">Live</span></div>
            <div className="notes-summary">
              <div><span className="hq-kicker">Personal</span><p>{day.personalNotes || "No personal note yet."}</p></div>
              <div><span className="hq-kicker">Work</span><p>{day.notes || "No work note yet."}</p></div>
            </div>
          </section>
          <section className="hq-card">
            <div className="hq-section-head"><h2>Recent signals</h2><span className="hq-pill">History</span></div>
            {snapshot.recent.length ? (
              <div className="signal-list">
                {snapshot.recent.map((entry) => (
                  <article className="signal-row" key={entry.date}>
                    <span>{formatShortDate(entry.date)}</span>
                    <p>{entry.notes?.trim() || entry.personalNotes}</p>
                  </article>
                ))}
              </div>
            ) : <p className="empty-state">Notes and operating signals will surface here over time.</p>}
          </section>
        </div>
      </div>
    </AppShell>
  );
}
