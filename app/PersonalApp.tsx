"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ChecklistItem, DayEntry } from "@/lib/types";
import { addDays, formatDisplayDate, formatShortDate, todayKey } from "@/lib/dates";
import {
  getHuntActionMeta,
  getHuntPlanForDate,
  getNextHuntAction,
} from "@/lib/huntCoach";
import { getRealmStreaks } from "@/lib/progress";
import {
  getOrCreateDay,
  hydrateStoreFromCloud,
  loadStore,
  saveIdeaLot,
  upsertDay,
} from "@/lib/storage";
import AppShell from "./AppShell";

export default function PersonalApp() {
  const [ready, setReady] = useState(false);
  const [selectedDate, setSelectedDate] = useState(todayKey);
  const [day, setDay] = useState<DayEntry | null>(null);
  const [ideaLot, setIdeaLot] = useState("");
  const [toast, setToast] = useState(false);
  const [streak, setStreak] = useState(0);
  const ideaSaveTimer = useRef<number | null>(null);

  const refresh = useCallback((date: string) => {
    const store = loadStore();
    const entry = getOrCreateDay(store, date);
    if (!store.days[date]) upsertDay(store, entry);
    setDay(entry);
    setIdeaLot(store.ideaLot ?? "");
    setStreak(getRealmStreaks(store, todayKey()).personal);
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
    upsertDay(loadStore(), next);
    setDay(next);
    setStreak(getRealmStreaks(loadStore(), todayKey()).personal);
    setToast(true);
    window.setTimeout(() => setToast(false), 900);
  }, []);

  const plan = useMemo(
    () => getHuntPlanForDate(selectedDate),
    [selectedDate],
  );

  const recent = useMemo(() => {
    if (!ready) return [];
    return Object.values(loadStore().days)
      .filter((entry) => entry.date < selectedDate && entry.personalNotes?.trim())
      .sort((a, b) => (a.date < b.date ? 1 : -1))
      .slice(0, 4);
  }, [ready, selectedDate, day?.updatedAt]);

  if (!ready || !day) {
    return (
      <AppShell>
        <p className="brand-sub">Loading personal…</p>
      </AppShell>
    );
  }

  const currentDay = day;
  const hunt = currentDay.huntChecklist ?? [];
  const nextAction = getNextHuntAction(hunt);
  const nextMeta = nextAction
    ? getHuntActionMeta(selectedDate, nextAction.id)
    : null;
  const huntDone = hunt.filter((item) => item.done).length;
  const isToday = selectedDate === todayKey();
  const checklist = currentDay.dailyChecklist;
  const checklistDone = checklist.filter((item) => item.done).length;

  function toggleHuntItem(item: ChecklistItem) {
    persist({
      ...currentDay,
      huntChecklist: hunt.map((row) =>
        row.id === item.id ? { ...row, done: !row.done } : row,
      ),
    });
  }

  function completeNext() {
    if (!nextAction) return;
    toggleHuntItem(nextAction);
  }

  function toggleChecklistItem(item: ChecklistItem) {
    persist({
      ...currentDay,
      dailyChecklist: currentDay.dailyChecklist.map((row) =>
        row.id === item.id ? { ...row, done: !row.done } : row,
      ),
    });
  }

  function updateIdeaLot(text: string) {
    setIdeaLot(text);
    if (ideaSaveTimer.current) window.clearTimeout(ideaSaveTimer.current);
    ideaSaveTimer.current = window.setTimeout(() => {
      saveIdeaLot(text);
      setToast(true);
      window.setTimeout(() => setToast(false), 900);
    }, 400);
  }

  return (
    <AppShell>
      <div className="page-intro">
        <div>
          <p className="hq-eyebrow">Personal command center</p>
          <h2>{formatDisplayDate(selectedDate)}</h2>
          <p>
            One next action. Park every other idea. Find work without getting
            lost.
          </p>
        </div>
        <div className="personal-intro-side">
          <div className="streak-tile personal-streak" aria-label="Personal streak">
            <strong>
              {streak}
              <span className="streak-unit">d</span>
            </strong>
            <span>Personal streak</span>
          </div>
          <div className="date-nav compact">
            <button
              type="button"
              className="nav-btn"
              onClick={() => setSelectedDate((d) => addDays(d, -1))}
              aria-label="Previous day"
            >
              ‹
            </button>
            <button
              type="button"
              className="nav-btn primary"
              onClick={() => setSelectedDate(todayKey())}
            >
              Today
            </button>
            <button
              type="button"
              className="nav-btn"
              onClick={() => setSelectedDate((d) => addDays(d, 1))}
              aria-label="Next day"
            >
              ›
            </button>
          </div>
        </div>
      </div>

      <section className="hunt-coach" aria-label="Do this next">
        <div className="hunt-coach-top">
          <p className="hq-eyebrow">Do this next</p>
          <span className="panel-meta">
            {huntDone}/{hunt.length} · {plan.name}
          </span>
        </div>

        {nextAction ? (
          <>
            <h3 className="hunt-next-label">{nextAction.label}</h3>
            <p className="hunt-mission">
              <strong>Today&apos;s mission:</strong> {plan.mission}
            </p>
            <p className="hunt-why">{plan.why}</p>
            <div className="hunt-actions">
              {nextMeta ? (
                <Link href={nextMeta.href} className="btn primary">
                  {nextMeta.cta}
                </Link>
              ) : null}
              <button
                type="button"
                className="btn"
                onClick={completeNext}
                disabled={!isToday}
              >
                I did this
              </button>
            </div>
            {!isToday ? (
              <p className="hunt-note">
                Viewing another day — switch to Today to check items off.
              </p>
            ) : null}
          </>
        ) : (
          <>
            <h3 className="hunt-next-label">You cleared today&apos;s hunt list.</h3>
            <p className="hunt-mission">
              Mission was: {plan.mission} Protect the win. Do not invent a new
              project tonight.
            </p>
            <div className="hunt-actions">
              <Link href="/work" className="btn primary">
                Open Work
              </Link>
            </div>
          </>
        )}

        <ul className="checklist hunt-checklist">
          {hunt.map((item) => {
            const meta = getHuntActionMeta(selectedDate, item.id);
            return (
              <li key={item.id}>
                <label className={`check-row ${item.done ? "done" : ""}`}>
                  <input
                    type="checkbox"
                    checked={item.done}
                    disabled={!isToday}
                    onChange={() => toggleHuntItem(item)}
                  />
                  <span>
                    {meta ? (
                      <Link href={meta.href} className="hunt-step-link">
                        {item.label}
                      </Link>
                    ) : (
                      item.label
                    )}
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      </section>

      <div className="content-grid personal-grid">
        <section className="panel parking-panel">
          <div className="panel-head">
            <h2 className="panel-title">Idea parking lot</h2>
            <span className="panel-meta">Dump it · stay on mission</span>
          </div>
          <p className="hunt-why">
            New idea popped up? Write it here and go back to{" "}
            <strong>Do this next</strong>. Do not start building it.
          </p>
          <textarea
            className="field textarea journal-field"
            placeholder="Website colors, new app feature, random business idea…"
            value={ideaLot}
            onChange={(event) => updateIdeaLot(event.target.value)}
          />
        </section>

        <section className="panel checklist-panel">
          <div className="panel-head">
            <h2 className="panel-title">Daily pillars</h2>
            <span className="panel-meta">
              {checklistDone}/{checklist.length} · after the hunt
            </span>
          </div>
          <ul className="checklist">
            {checklist.map((item) => (
              <li key={item.id}>
                <label className={`check-row ${item.done ? "done" : ""}`}>
                  <input
                    type="checkbox"
                    checked={item.done}
                    onChange={() => toggleChecklistItem(item)}
                  />
                  <span>{item.label}</span>
                </label>
              </li>
            ))}
          </ul>
        </section>

        <section className="panel journal-panel">
          <div className="panel-head">
            <h2 className="panel-title">Notes</h2>
            <span className="panel-meta">One place for the day</span>
          </div>
          <textarea
            className="field textarea journal-field"
            placeholder="What happened on the hunt? Who answered? What hurt?"
            value={currentDay.personalNotes}
            onChange={(event) =>
              persist({ ...currentDay, personalNotes: event.target.value })
            }
          />
        </section>

        <section className="panel recent-panel">
          <div className="panel-head">
            <h2 className="panel-title">Recent notes</h2>
            <span className="panel-meta">Last few days</span>
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
            <p className="empty-state">
              Notes from prior days will show up here.
            </p>
          )}
        </section>
      </div>

      <div className={`save-toast ${toast ? "show" : ""}`} aria-live="polite">
        Saved
      </div>
    </AppShell>
  );
}
