"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { DayEntry, MetricKey, Metrics } from "@/lib/types";
import { METRIC_LABELS } from "@/lib/types";
import { addDays, formatDisplayDate, formatShortDate, getWeekKeys, todayKey } from "@/lib/dates";
import { getOrCreateDay, hydrateStoreFromCloud, loadStore, upsertDay } from "@/lib/storage";
import {
  allTimeRangeLabel,
  getProgressRange,
  listActiveHistory,
  sumMetrics,
  sumMetricsInRange,
  type ProgressRange,
} from "@/lib/progress";
import AppShell from "./AppShell";

type View = "today" | "week" | "progress";

const RANGE_CHIPS: { id: ProgressRange; label: string }[] = [
  { id: "week", label: "This week" },
  { id: "month", label: "This month" },
  { id: "quarter", label: "This quarter" },
  { id: "all", label: "All time" },
];

function activityScore(metrics: Metrics) {
  return Object.values(metrics).reduce((sum, value) => sum + value, 0);
}

export default function BoardApp() {
  const [ready, setReady] = useState(false);
  const [view, setView] = useState<View>("today");
  const [selectedDate, setSelectedDate] = useState(todayKey);
  const [day, setDay] = useState<DayEntry | null>(null);
  const [weekDays, setWeekDays] = useState<DayEntry[]>([]);
  const [progressRange, setProgressRange] = useState<ProgressRange>("week");
  const [historyTick, setHistoryTick] = useState(0);
  const [toast, setToast] = useState(false);

  const refresh = useCallback((date: string) => {
    const store = loadStore();
    const entry = getOrCreateDay(store, date);
    if (!store.days[date]) upsertDay(store, entry);
    setDay(entry);
    setWeekDays(getWeekKeys(date).map((key) => getOrCreateDay(store, key)));
    setHistoryTick((value) => value + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void hydrateStoreFromCloud().then(() => {
      if (cancelled) return;
      refresh(selectedDate);
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [selectedDate, refresh]);

  const persist = useCallback((next: DayEntry) => {
    const store = loadStore();
    upsertDay(store, next);
    setDay(next);
    const updated = loadStore();
    setWeekDays(getWeekKeys(next.date).map((key) => getOrCreateDay(updated, key)));
    setHistoryTick((value) => value + 1);
    setToast(true);
    window.setTimeout(() => setToast(false), 900);
  }, []);

  const weekTotals = useMemo(() => sumMetrics(weekDays), [weekDays]);
  const progressData = useMemo(() => {
    const store = loadStore();
    const range = getProgressRange(progressRange, selectedDate);
    return {
      totals: sumMetricsInRange(store, range),
      label: progressRange === "all" ? allTimeRangeLabel(store) : range.label,
      history: listActiveHistory(store, 30),
    };
    // historyTick keeps cloud/local saves reflected in this aggregate.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [progressRange, selectedDate, historyTick]);

  if (!ready || !day) {
    return <AppShell><p className="brand-sub">Loading work…</p></AppShell>;
  }

  const businessGoal = day.goals.find((goal) => goal.category === "business");

  function updateFocus(text: string) {
    if (!businessGoal || !day) return;
    persist({
      ...day,
      goals: day.goals.map((goal) =>
        goal.id === businessGoal.id ? { ...goal, text } : goal
      ),
    });
  }

  function updateMetric(key: MetricKey, value: number) {
    if (!day) return;
    persist({ ...day, metrics: { ...day.metrics, [key]: Math.max(0, value) } });
  }

  return (
    <AppShell>
      <div className="page-intro">
        <div>
          <p className="hq-eyebrow">Operations desk</p>
          <h2>{view === "today" ? formatDisplayDate(selectedDate) : "Work performance"}</h2>
          <p>Priorities, field activity, and commercial growth in one operating view.</p>
        </div>
        <a className="btn accent sales-shortcut" href="/work/sales/">Open Commercial Sales →</a>
      </div>

      <div className="work-toolbar">
        <div className="tabs tabs-3" role="tablist">
          {(["today", "week", "progress"] as View[]).map((name) => (
            <button key={name} type="button" className={`tab ${view === name ? "active" : ""}`} onClick={() => setView(name)}>
              {name === "today" ? "Day" : name[0].toUpperCase() + name.slice(1)}
            </button>
          ))}
        </div>
        {view !== "progress" ? (
          <div className="date-nav compact">
            <button type="button" className="nav-btn" onClick={() => setSelectedDate((date) => addDays(date, -1))}>‹</button>
            <button type="button" className="nav-btn primary" onClick={() => setSelectedDate(todayKey())}>Today</button>
            <button type="button" className="nav-btn" onClick={() => setSelectedDate((date) => addDays(date, 1))}>›</button>
          </div>
        ) : null}
      </div>

      {view === "today" ? (
        <div className="content-grid work-grid">
          <section className="panel focus-panel">
            <div className="panel-head">
              <h2 className="panel-title">Work priority</h2>
              <span className="panel-meta">Editable daily focus</span>
            </div>
            <textarea className="field focus-field" value={businessGoal?.text ?? ""} onChange={(event) => updateFocus(event.target.value)} placeholder="What creates the most leverage today?" />
          </section>

          <section className="panel metrics-panel">
            <div className="panel-head">
              <h2 className="panel-title">Operating metrics</h2>
              <span className="panel-meta">Tap or type to update</span>
            </div>
            <div className="metrics-grid">
              {(Object.keys(METRIC_LABELS) as MetricKey[]).map((key) => (
                <div key={key} className="metric-card">
                  <span className="label">{METRIC_LABELS[key]}</span>
                  <div className="stepper">
                    <button type="button" onClick={() => updateMetric(key, (day.metrics[key] || 0) - 1)}>−</button>
                    <input type="number" min={0} inputMode="numeric" value={day.metrics[key] || 0} onChange={(event) => updateMetric(key, Number(event.target.value) || 0)} />
                    <button type="button" onClick={() => updateMetric(key, (day.metrics[key] || 0) + 1)}>+</button>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="panel notes-panel">
            <div className="panel-head">
              <h2 className="panel-title">Work notes</h2>
              <span className="panel-meta">Wins · follow-ups · details</span>
            </div>
            <textarea className="field textarea journal-field" value={day.notes} onChange={(event) => persist({ ...day, notes: event.target.value })} placeholder="Capture job details, next moves, and open loops…" />
          </section>

          <section className="panel sales-panel">
            <p className="hq-eyebrow">Commercial Sales</p>
            <h2>Pipeline and outreach</h2>
            <p>Move from daily operations into the dedicated prospecting, follow-up, quoting, and analytics workspace.</p>
            <a className="btn accent" href="/work/sales/">Launch Sales OS →</a>
          </section>
        </div>
      ) : null}

      {view === "week" ? (
        <div className="content-grid">
          <section className="panel">
            <div className="panel-head"><h2 className="panel-title">Week totals</h2><span className="panel-meta">Monday–Sunday</span></div>
            <MetricTotals metrics={weekTotals} />
          </section>
          <section className="panel">
            <div className="panel-head"><h2 className="panel-title">Daily movement</h2><span className="panel-meta">Open any day</span></div>
            <div className="week-grid">
              {weekDays.map((entry) => (
                <button key={entry.date} type="button" className={`week-day ${entry.date === todayKey() ? "today" : ""}`} onClick={() => { setSelectedDate(entry.date); setView("today"); }}>
                  <div className="dow">{formatShortDate(entry.date)}</div>
                  <div className="stats">{(Object.keys(METRIC_LABELS) as MetricKey[]).map((key) => <span className="stat" key={key}>{METRIC_LABELS[key]} {entry.metrics[key]}</span>)}</div>
                  <div className="total">{activityScore(entry.metrics)}</div>
                </button>
              ))}
            </div>
          </section>
        </div>
      ) : null}

      {view === "progress" ? (
        <div className="content-grid">
          <section className="panel">
            <div className="panel-head"><h2 className="panel-title">Period summary</h2><span className="panel-meta">{progressData.label}</span></div>
            <div className="range-chips">{RANGE_CHIPS.map((chip) => <button key={chip.id} type="button" className={`range-chip ${progressRange === chip.id ? "active" : ""}`} onClick={() => setProgressRange(chip.id)}>{chip.label}</button>)}</div>
            <div className="summary-spacer"><MetricTotals metrics={progressData.totals} /></div>
          </section>
          <section className="panel">
            <div className="panel-head"><h2 className="panel-title">Recent operating days</h2><span className="panel-meta">Metrics and notes</span></div>
            {progressData.history.length ? (
              <div className="week-grid">
                {progressData.history.map(({ entry }) => (
                  <button key={entry.date} type="button" className={`week-day ${entry.date === todayKey() ? "today" : ""}`} onClick={() => { setSelectedDate(entry.date); setView("today"); }}>
                    <div className="dow">{formatShortDate(entry.date)}</div>
                    <div className="stats">{entry.notes?.trim() ? entry.notes.slice(0, 100) : "Metrics logged"}</div>
                    <div className="total">{activityScore(entry.metrics)}</div>
                  </button>
                ))}
              </div>
            ) : <p className="empty-state">Operating days will appear here after metrics or notes are logged.</p>}
          </section>
        </div>
      ) : null}

      <div className={`save-toast ${toast ? "show" : ""}`} aria-live="polite">Saved</div>
    </AppShell>
  );
}

function MetricTotals({ metrics }: { metrics: Metrics }) {
  return (
    <div className="week-totals">
      {(Object.keys(METRIC_LABELS) as MetricKey[]).map((key) => (
        <div key={key} className="total-tile"><strong>{metrics[key]}</strong><span>{METRIC_LABELS[key]}</span></div>
      ))}
    </div>
  );
}
