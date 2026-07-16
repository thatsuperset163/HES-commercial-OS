"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  ChecklistItem,
  ChecklistKey,
  DayEntry,
  MetricKey,
  Metrics,
} from "@/lib/types";
import { METRIC_LABELS } from "@/lib/types";
import {
  addDays,
  formatDisplayDate,
  formatShortDate,
  getWeekKeys,
  todayKey,
} from "@/lib/dates";
import {
  exportStoreJson,
  getOrCreateDay,
  hydrateStoreFromCloud,
  importStoreJson,
  loadStore,
  upsertDay,
} from "@/lib/storage";
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

function activityScore(m: Metrics): number {
  return m.doors + m.conversations + m.phoneNumbers + m.quotes + m.jobsBooked;
}

const RANGE_CHIPS: { id: ProgressRange; label: string }[] = [
  { id: "week", label: "This week" },
  { id: "month", label: "This month" },
  { id: "quarter", label: "This quarter" },
  { id: "all", label: "All time" },
];

export default function BoardApp() {
  const [ready, setReady] = useState(false);
  const [view, setView] = useState<View>("today");
  const [selectedDate, setSelectedDate] = useState(todayKey);
  const [day, setDay] = useState<DayEntry | null>(null);
  const [weekDays, setWeekDays] = useState<DayEntry[]>([]);
  const [toast, setToast] = useState(false);
  const [progressRange, setProgressRange] = useState<ProgressRange>("week");
  const [historyTick, setHistoryTick] = useState(0);
  const [fieldMode, setFieldMode] = useState(false);

  useEffect(() => {
    try {
      setFieldMode(localStorage.getItem("hes-field-mode") === "1");
    } catch {
      /* ignore */
    }
  }, []);

  function toggleFieldMode() {
    setFieldMode((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("hes-field-mode", next ? "1" : "0");
      } catch {
        /* ignore */
      }
      if (next) setView("today");
      return next;
    });
  }

  const flashSaved = useCallback(() => {
    setToast(true);
    window.setTimeout(() => setToast(false), 900);
  }, []);

  const refresh = useCallback((date: string) => {
    const store = loadStore();
    const entry = getOrCreateDay(store, date);
    if (!store.days[date]) {
      upsertDay(store, entry);
    }
    setDay(entry);
    const keys = getWeekKeys(date);
    setWeekDays(keys.map((k) => getOrCreateDay(store, k)));
    setHistoryTick((n) => n + 1);
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

  const persist = useCallback(
    (next: DayEntry) => {
      const store = loadStore();
      upsertDay(store, next);
      setDay(next);
      const keys = getWeekKeys(next.date);
      const updated = loadStore();
      setWeekDays(keys.map((k) => getOrCreateDay(updated, k)));
      setHistoryTick((n) => n + 1);
      flashSaved();
    },
    [flashSaved]
  );

  function doneCount(list: ChecklistItem[]) {
    return list.filter((i) => i.done).length;
  }

  function toggleChecklistItem(
    key: ChecklistKey,
    id: string,
    done: boolean
  ) {
    if (!day) return;
    persist({
      ...day,
      [key]: day[key].map((row) =>
        row.id === id ? { ...row, done } : row
      ),
    });
  }

  function addChecklistItem(key: ChecklistKey) {
    if (!day) return;
    const label = window.prompt("New checklist item:");
    if (!label?.trim()) return;
    persist({
      ...day,
      [key]: [
        ...day[key],
        { id: `${key}-${Date.now()}`, label: label.trim(), done: false },
      ],
    });
  }

  const weekTotals = useMemo(() => sumMetrics(weekDays), [weekDays]);

  const progressData = useMemo(() => {
    const store = loadStore();
    const range = getProgressRange(progressRange, selectedDate);
    const totals = sumMetricsInRange(store, range);
    const label =
      progressRange === "all" ? allTimeRangeLabel(store) : range.label;
    const history = listActiveHistory(store, 60);
    return { totals, label, history };
    // historyTick + selectedDate + progressRange keep this fresh after saves
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [progressRange, selectedDate, historyTick]);

  function onExport() {
    const blob = new Blob([exportStoreJson(loadStore())], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `hes-blackboard-${todayKey()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function onImport() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json,.json";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        importStoreJson(text);
        refresh(selectedDate);
        flashSaved();
      } catch {
        window.alert("Could not import that file.");
      }
    };
    input.click();
  }

  if (!ready || !day) {
    return (
      <AppShell>
        <p className="brand-sub">Loading board…</p>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="work-toolbar">
        <div className={`tabs tabs-3 ${fieldMode ? "tabs-locked" : ""}`} role="tablist">
          <button
            type="button"
            className={`tab ${view === "today" ? "active" : ""}`}
            onClick={() => setView("today")}
          >
            Day
          </button>
          <button
            type="button"
            className={`tab ${view === "week" ? "active" : ""}`}
            onClick={() => !fieldMode && setView("week")}
            disabled={fieldMode}
          >
            Week
          </button>
          <button
            type="button"
            className={`tab ${view === "progress" ? "active" : ""}`}
            onClick={() => !fieldMode && setView("progress")}
            disabled={fieldMode}
          >
            Progress
          </button>
        </div>
        <button
          type="button"
          className={`field-toggle ${fieldMode ? "on" : ""}`}
          onClick={toggleFieldMode}
        >
          {fieldMode ? "Field mode on" : "Field mode"}
        </button>
      </div>

      {view !== "progress" ? (
        <div className="date-nav">
          <button
            type="button"
            className="nav-btn"
            onClick={() => setSelectedDate((d) => addDays(d, -1))}
            aria-label="Previous day"
          >
            ‹
          </button>
          <div className="date-label">{formatDisplayDate(selectedDate)}</div>
          <button
            type="button"
            className="nav-btn"
            onClick={() => setSelectedDate((d) => addDays(d, 1))}
            aria-label="Next day"
          >
            ›
          </button>
          <button
            type="button"
            className="nav-btn primary"
            onClick={() => setSelectedDate(todayKey())}
          >
            Today
          </button>
        </div>
      ) : null}

      {view === "today" ? (
        <div className={fieldMode ? "field-mode" : undefined}>
          {day.goals
            .filter((g) => g.category === "business")
            .map((goal) => (
              <section className="panel" key={goal.id}>
                <div className="panel-head">
                  <h2 className="panel-title">Business goal</h2>
                  <span className="panel-meta">Changes daily</span>
                </div>
                <ul className="checklist goal-list">
                  <li
                    className={`check-row goal-row ${goal.done ? "done" : ""}`}
                  >
                    <input
                      id={`biz-goal-${goal.id}`}
                      type="checkbox"
                      checked={goal.done}
                      onChange={(e) => {
                        persist({
                          ...day,
                          goals: day.goals.map((row) =>
                            row.id === goal.id
                              ? { ...row, done: e.target.checked }
                              : row
                          ),
                        });
                      }}
                    />
                    <label
                      htmlFor={`biz-goal-${goal.id}`}
                      className="goal-copy"
                    >
                      <span className="goal-kicker">HES · Sales · Ops</span>
                      <span className="goal-text">{goal.text}</span>
                    </label>
                  </li>
                </ul>
              </section>
            ))}

          {(
            [
              {
                key: "morningWorkChecklist" as const,
                title: "Morning work session",
                meta: "Essentials + 2 that change daily",
                idPrefix: "am",
                field: false,
              },
              {
                key: "afternoonWorkChecklist" as const,
                title: "Afternoon work session",
                meta: "Field · doors · closeout",
                idPrefix: "pm",
                field: true,
              },
              {
                key: "outreach" as const,
                title: "Commercial outreach",
                meta: "Today’s 5 · changes each day",
                idPrefix: "out",
                field: true,
              },
            ] as const
          )
            .filter((section) => !fieldMode || section.field)
            .map((section) => {
            const list = day[section.key];
            const done = doneCount(list);
            return (
              <section className="panel" key={section.key}>
                <div className="panel-head">
                  <h2 className="panel-title">{section.title}</h2>
                  <span className="panel-meta">
                    {done}/{list.length} · {section.meta}
                  </span>
                </div>
                <ul className="checklist">
                  {list.map((item) => (
                    <li
                      key={item.id}
                      className={`check-row ${item.done ? "done" : ""}`}
                    >
                      <input
                        id={`${section.idPrefix}-${item.id}`}
                        type="checkbox"
                        checked={item.done}
                        onChange={(e) =>
                          toggleChecklistItem(
                            section.key,
                            item.id,
                            e.target.checked
                          )
                        }
                      />
                      <label htmlFor={`${section.idPrefix}-${item.id}`}>
                        {item.label}
                      </label>
                    </li>
                  ))}
                </ul>
                <div className="progress-bar" aria-hidden>
                  <span
                    style={{
                      width: `${(done / Math.max(list.length, 1)) * 100}%`,
                    }}
                  />
                </div>
                {!fieldMode ? (
                  <div className="row-actions">
                    <button
                      type="button"
                      className="btn ghost"
                      onClick={() => addChecklistItem(section.key)}
                    >
                      + Add item
                    </button>
                  </div>
                ) : null}
              </section>
            );
          })}

          <section className="panel">
            <div className="panel-head">
              <h2 className="panel-title">Door knocking</h2>
              <span className="panel-meta">
                {fieldMode ? "Tap fast" : "Afternoon tracker"}
              </span>
            </div>
            <div className="metrics-grid">
              {(Object.keys(METRIC_LABELS) as MetricKey[]).map((key) => (
                <div key={key} className="metric-card">
                  <span className="label">{METRIC_LABELS[key]}</span>
                  <div className="stepper">
                    <button
                      type="button"
                      aria-label={`Decrease ${METRIC_LABELS[key]}`}
                      onClick={() => {
                        persist({
                          ...day,
                          metrics: {
                            ...day.metrics,
                            [key]: Math.max(0, (day.metrics[key] || 0) - 1),
                          },
                        });
                      }}
                    >
                      −
                    </button>
                    <input
                      type="number"
                      inputMode="numeric"
                      min={0}
                      value={day.metrics[key] || 0}
                      onChange={(e) => {
                        const n = Math.max(0, Number(e.target.value) || 0);
                        persist({
                          ...day,
                          metrics: { ...day.metrics, [key]: n },
                        });
                      }}
                    />
                    <button
                      type="button"
                      aria-label={`Increase ${METRIC_LABELS[key]}`}
                      onClick={() => {
                        persist({
                          ...day,
                          metrics: {
                            ...day.metrics,
                            [key]: (day.metrics[key] || 0) + 1,
                          },
                        });
                      }}
                    >
                      +
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {!fieldMode ? (
            <section className="panel">
              <div className="panel-head">
                <h2 className="panel-title">End-of-day scoreboard</h2>
                <span className="panel-meta">Today&apos;s numbers</span>
              </div>
              <div className="score-summary">
                {(Object.keys(METRIC_LABELS) as MetricKey[]).map((key) => (
                  <div key={key} className="score-chip">
                    <strong>{day.metrics[key] || 0}</strong>
                    <span>{METRIC_LABELS[key]}</span>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: "0.9rem" }}>
                <label htmlFor="notes" className="panel-meta">
                  Work notes
                </label>
                <textarea
                  id="notes"
                  className="field textarea"
                  placeholder="Wins, follow-ups, weather, jobs booked details…"
                  value={day.notes}
                  onChange={(e) => persist({ ...day, notes: e.target.value })}
                />
              </div>
            </section>
          ) : (
            <section className="panel">
              <div className="panel-head">
                <h2 className="panel-title">Live score</h2>
                <span className="panel-meta">Field</span>
              </div>
              <div className="score-summary">
                {(Object.keys(METRIC_LABELS) as MetricKey[]).map((key) => (
                  <div key={key} className="score-chip">
                    <strong>{day.metrics[key] || 0}</strong>
                    <span>{METRIC_LABELS[key]}</span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      ) : null}

      {view === "week" ? (
        <>
          <section className="panel">
            <div className="panel-head">
              <h2 className="panel-title">Week totals</h2>
              <span className="panel-meta">Mon–Sun</span>
            </div>
            <div className="week-totals">
              {(Object.keys(METRIC_LABELS) as MetricKey[]).map((key) => (
                <div key={key} className="total-tile">
                  <strong>{weekTotals[key]}</strong>
                  <span>{METRIC_LABELS[key]}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="panel">
            <div className="panel-head">
              <h2 className="panel-title">Daily breakdown</h2>
            </div>
            <div className="week-grid">
              {weekDays.map((entry) => {
                const score = activityScore(entry.metrics);
                const isToday = entry.date === todayKey();
                return (
                  <button
                    key={entry.date}
                    type="button"
                    className={`week-day ${isToday ? "today" : ""}`}
                    onClick={() => {
                      setSelectedDate(entry.date);
                      setView("today");
                    }}
                  >
                    <div className="dow">{formatShortDate(entry.date)}</div>
                    <div className="stats">
                      <span className="stat">D {entry.metrics.doors}</span>
                      <span className="stat">
                        C {entry.metrics.conversations}
                      </span>
                      <span className="stat">
                        # {entry.metrics.phoneNumbers}
                      </span>
                      <span className="stat">Q {entry.metrics.quotes}</span>
                      <span className="stat">J {entry.metrics.jobsBooked}</span>
                    </div>
                    <div className="total">{score}</div>
                  </button>
                );
              })}
            </div>
          </section>
        </>
      ) : null}

      {view === "progress" ? (
        <>
          <section className="panel">
            <div className="panel-head">
              <h2 className="panel-title">Period summary</h2>
              <span className="panel-meta">{progressData.label}</span>
            </div>
            <div className="range-chips" role="tablist">
              {RANGE_CHIPS.map((chip) => (
                <button
                  key={chip.id}
                  type="button"
                  className={`range-chip ${
                    progressRange === chip.id ? "active" : ""
                  }`}
                  onClick={() => setProgressRange(chip.id)}
                >
                  {chip.label}
                </button>
              ))}
            </div>
            <div className="week-totals" style={{ marginTop: "0.85rem" }}>
              {(Object.keys(METRIC_LABELS) as MetricKey[]).map((key) => (
                <div key={key} className="total-tile">
                  <strong>{progressData.totals[key]}</strong>
                  <span>{METRIC_LABELS[key]}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="panel">
            <div className="panel-head">
              <h2 className="panel-title">Day history</h2>
              <span className="panel-meta">Tap a day to open</span>
            </div>
            {progressData.history.length === 0 ? (
              <p className="brand-sub" style={{ margin: 0 }}>
                Nothing logged yet — check items or add door numbers and
                they&apos;ll show up here.
              </p>
            ) : (
              <div className="week-grid">
                {progressData.history.map((row) => {
                  const { entry } = row;
                  const isToday = entry.date === todayKey();
                  return (
                    <button
                      key={entry.date}
                      type="button"
                      className={`week-day ${isToday ? "today" : ""}`}
                      onClick={() => {
                        setSelectedDate(entry.date);
                        setView("today");
                      }}
                    >
                      <div className="dow">
                        {formatShortDate(entry.date)}
                      </div>
                      <div className="stats">
                        <span className="stat">D {entry.metrics.doors}</span>
                        <span className="stat">
                          C {entry.metrics.conversations}
                        </span>
                        <span className="stat">
                          # {entry.metrics.phoneNumbers}
                        </span>
                        <span className="stat">Q {entry.metrics.quotes}</span>
                        <span className="stat">
                          J {entry.metrics.jobsBooked}
                        </span>
                        <span className="stat">
                          {row.checksDone}/{row.checksTotal} checks
                        </span>
                      </div>
                      <div className="total">{row.score}</div>
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          <section className="panel">
            <div className="panel-head">
              <h2 className="panel-title">Backup</h2>
              <span className="panel-meta">Saved on this device</span>
            </div>
            <p className="brand-sub" style={{ margin: "0 0 0.75rem" }}>
              Saved on this device — export anytime for backup.
            </p>
            <div className="row-actions">
              <button type="button" className="btn accent" onClick={onExport}>
                Export JSON
              </button>
              <button type="button" className="btn" onClick={onImport}>
                Import JSON
              </button>
            </div>
          </section>
        </>
      ) : null}

      {view !== "progress" ? (
        <section className="panel">
          <div className="panel-head">
            <h2 className="panel-title">Backup</h2>
            <span className="panel-meta">Saved on this device</span>
          </div>
          <div className="row-actions">
            <button type="button" className="btn" onClick={onImport}>
              Import JSON
            </button>
          </div>
        </section>
      ) : null}

      <div className={`save-toast ${toast ? "show" : ""}`} aria-live="polite">
        Saved
      </div>
    </AppShell>
  );
}
