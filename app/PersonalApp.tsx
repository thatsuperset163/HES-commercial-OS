"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { DayEntry } from "@/lib/types";
import { addDays, formatDisplayDate, formatShortDate, todayKey } from "@/lib/dates";
import {
  getOrCreateDay,
  hydrateStoreFromCloud,
  loadStore,
  upsertDay,
} from "@/lib/storage";
import AppShell from "./AppShell";

export default function PersonalApp() {
  const [ready, setReady] = useState(false);
  const [selectedDate, setSelectedDate] = useState(todayKey);
  const [day, setDay] = useState<DayEntry | null>(null);
  const [toast, setToast] = useState(false);

  const refresh = useCallback((date: string) => {
    const store = loadStore();
    const entry = getOrCreateDay(store, date);
    if (!store.days[date]) upsertDay(store, entry);
    setDay(entry);
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
    setToast(true);
    window.setTimeout(() => setToast(false), 900);
  }, []);

  const recent = useMemo(() => {
    if (!ready) return [];
    return Object.values(loadStore().days)
      .filter((entry) => entry.date < selectedDate && entry.personalNotes?.trim())
      .sort((a, b) => (a.date < b.date ? 1 : -1))
      .slice(0, 4);
  }, [ready, selectedDate, day?.updatedAt]);

  if (!ready || !day) {
    return <AppShell><p className="brand-sub">Loading personal…</p></AppShell>;
  }

  const personalGoal = day.goals.find((goal) => goal.category === "personal");

  function updateFocus(text: string) {
    if (!personalGoal || !day) return;
    persist({
      ...day,
      goals: day.goals.map((goal) =>
        goal.id === personalGoal.id ? { ...goal, text } : goal
      ),
    });
  }

  return (
    <AppShell>
      <div className="page-intro">
        <div>
          <p className="hq-eyebrow">Personal command center</p>
          <h2>{formatDisplayDate(selectedDate)}</h2>
          <p>Set the direction, capture the day, and notice what is changing.</p>
        </div>
        <div className="date-nav compact">
          <button type="button" className="nav-btn" onClick={() => setSelectedDate((d) => addDays(d, -1))} aria-label="Previous day">‹</button>
          <button type="button" className="nav-btn primary" onClick={() => setSelectedDate(todayKey())}>Today</button>
          <button type="button" className="nav-btn" onClick={() => setSelectedDate((d) => addDays(d, 1))} aria-label="Next day">›</button>
        </div>
      </div>

      <div className="content-grid personal-grid">
        <section className="panel focus-panel">
          <div className="panel-head">
            <h2 className="panel-title">Current focus</h2>
            <span className="panel-meta">Editable daily direction</span>
          </div>
          <label className="field-label" htmlFor="personal-focus">What deserves your attention?</label>
          <textarea
            id="personal-focus"
            className="field focus-field"
            value={personalGoal?.text ?? ""}
            onChange={(event) => updateFocus(event.target.value)}
            placeholder="Name the personal focus for this day…"
          />
        </section>

        <section className="panel journal-panel">
          <div className="panel-head">
            <h2 className="panel-title">Notes & journal</h2>
            <span className="panel-meta">Faith · people · life</span>
          </div>
          <textarea
            className="field textarea journal-field"
            placeholder="What are you thinking, learning, or carrying today?"
            value={day.personalNotes}
            onChange={(event) => persist({ ...day, personalNotes: event.target.value })}
          />
        </section>

        <section className="panel recent-panel">
          <div className="panel-head">
            <h2 className="panel-title">Recent context</h2>
            <span className="panel-meta">Previous journal signals</span>
          </div>
          {recent.length ? (
            <div className="signal-list">
              {recent.map((entry) => (
                <article key={entry.date} className="signal-row">
                  <span>{formatShortDate(entry.date)}</span>
                  <p>{entry.personalNotes}</p>
                </article>
              ))}
            </div>
          ) : (
            <p className="empty-state">Your recent notes will collect here as a lightweight personal timeline.</p>
          )}
        </section>
      </div>

      <div className={`save-toast ${toast ? "show" : ""}`} aria-live="polite">Saved</div>
    </AppShell>
  );
}
