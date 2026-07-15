"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ChecklistItem, DayEntry, GoalItem } from "@/lib/types";
import {
  addDays,
  formatDisplayDate,
  todayKey,
} from "@/lib/dates";
import {
  getOrCreateDay,
  loadStore,
  upsertDay,
} from "@/lib/storage";
import AppShell from "./AppShell";

export default function PersonalApp() {
  const [ready, setReady] = useState(false);
  const [selectedDate, setSelectedDate] = useState(todayKey);
  const [day, setDay] = useState<DayEntry | null>(null);
  const [toast, setToast] = useState(false);

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
  }, []);

  useEffect(() => {
    refresh(selectedDate);
    setReady(true);
  }, [selectedDate, refresh]);

  const persist = useCallback(
    (next: DayEntry) => {
      const store = loadStore();
      upsertDay(store, next);
      setDay(next);
      flashSaved();
    },
    [flashSaved]
  );

  const personalGoal = useMemo(
    () => day?.goals.find((g) => g.category === "personal") ?? null,
    [day]
  );

  function doneCount(list: ChecklistItem[]) {
    return list.filter((i) => i.done).length;
  }

  function toggleChecklist(id: string, done: boolean) {
    if (!day) return;
    persist({
      ...day,
      dailyChecklist: day.dailyChecklist.map((row) =>
        row.id === id ? { ...row, done } : row
      ),
    });
  }

  function addChecklistItem() {
    if (!day) return;
    const label = window.prompt("New personal checklist item:");
    if (!label?.trim()) return;
    persist({
      ...day,
      dailyChecklist: [
        ...day.dailyChecklist,
        {
          id: `dailyChecklist-${Date.now()}`,
          label: label.trim(),
          done: false,
        },
      ],
    });
  }

  function updateGoal(patch: Partial<GoalItem>) {
    if (!day || !personalGoal) return;
    persist({
      ...day,
      goals: day.goals.map((g) =>
        g.id === personalGoal.id ? { ...g, ...patch } : g
      ),
    });
  }

  if (!ready || !day) {
    return (
      <AppShell>
        <p className="brand-sub">Loading personal…</p>
      </AppShell>
    );
  }

  const done = doneCount(day.dailyChecklist);

  return (
    <AppShell>
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

      {personalGoal ? (
        <section className="panel">
          <div className="panel-head">
            <h2 className="panel-title">Personal goal</h2>
            <span className="panel-meta">Changes daily</span>
          </div>
          <ul className="checklist goal-list">
            <li
              className={`check-row goal-row ${
                personalGoal.done ? "done" : ""
              }`}
            >
              <input
                id="personal-goal"
                type="checkbox"
                checked={personalGoal.done}
                onChange={(e) => updateGoal({ done: e.target.checked })}
              />
              <label htmlFor="personal-goal" className="goal-copy">
                <span className="goal-kicker">Faith · Social · Growth</span>
                <span className="goal-text">{personalGoal.text}</span>
              </label>
            </li>
          </ul>
        </section>
      ) : null}

      <section className="panel">
        <div className="panel-head">
          <h2 className="panel-title">Daily checklist</h2>
          <span className="panel-meta">
            {done}/{day.dailyChecklist.length} · essentials + rotating
          </span>
        </div>
        <ul className="checklist">
          {day.dailyChecklist.map((item) => (
            <li
              key={item.id}
              className={`check-row ${item.done ? "done" : ""}`}
            >
              <input
                id={`personal-${item.id}`}
                type="checkbox"
                checked={item.done}
                onChange={(e) => toggleChecklist(item.id, e.target.checked)}
              />
              <label htmlFor={`personal-${item.id}`}>{item.label}</label>
            </li>
          ))}
        </ul>
        <div className="progress-bar" aria-hidden>
          <span
            style={{
              width: `${(done / Math.max(day.dailyChecklist.length, 1)) * 100}%`,
            }}
          />
        </div>
        <div className="row-actions">
          <button type="button" className="btn ghost" onClick={addChecklistItem}>
            + Add item
          </button>
        </div>
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2 className="panel-title">Personal notes</h2>
          <span className="panel-meta">Faith · people · life</span>
        </div>
        <textarea
          className="field textarea"
          placeholder="Gratitude, conversations, how you showed up…"
          value={day.personalNotes}
          onChange={(e) => persist({ ...day, personalNotes: e.target.value })}
        />
      </section>

      <div className={`save-toast ${toast ? "show" : ""}`} aria-live="polite">
        Saved
      </div>
    </AppShell>
  );
}
