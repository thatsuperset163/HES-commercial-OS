"use client";



import Link from "next/link";

import { useCallback, useEffect, useMemo, useState } from "react";

import type { DayEntry } from "@/lib/types";

import { formatDisplayDate, todayKey } from "@/lib/dates";

import { pickDailyQuote } from "@/lib/quotes";

import { getLastNDayCharts } from "@/lib/charts";

import {

  getOrCreateDay,

  hydrateStoreFromCloud,

  loadStore,

  upsertDay,

} from "@/lib/storage";

import { getCompletionInsights } from "@/lib/insights";

import AppShell from "./AppShell";

import { BarChart } from "./BarChart";



function listPct(done: number, total: number) {

  if (!total) return 0;

  return Math.round((done / total) * 100);

}



export default function HomeApp() {

  const [ready, setReady] = useState(false);

  const [day, setDay] = useState<DayEntry | null>(null);

  const date = todayKey();

  const quote = useMemo(() => pickDailyQuote(date), [date]);



  const refresh = useCallback(() => {

    const store = loadStore();

    const entry = getOrCreateDay(store, date);

    if (!store.days[date]) {

      upsertDay(store, entry);

    }

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



  const persist = useCallback((next: DayEntry) => {

    const store = loadStore();

    upsertDay(store, next);

    setDay(next);

  }, []);



  const snap = useMemo(() => {

    if (!day) return null;

    const store = loadStore();

    const personalBoxes = [

      ...day.dailyChecklist,

      ...day.goals.filter((g) => g.category === "personal"),

    ];

    const personalDone = personalBoxes.filter((i) => i.done).length;

    const personalTotal = personalBoxes.length;



    const workBoxes = [

      ...day.morningWorkChecklist,

      ...day.afternoonWorkChecklist,

      ...day.outreach,

      ...day.goals.filter((g) => g.category === "business"),

    ];

    const workDone = workBoxes.filter((i) => i.done).length;

    const workTotal = workBoxes.length;



    const charts = getLastNDayCharts(store, 7, date);

    const insights = getCompletionInsights(store, {

      minDays: 1,

      limit: 3,

    });



    return {

      personalDone,

      personalTotal,

      personalPct: listPct(personalDone, personalTotal),

      workDone,

      workTotal,

      workPct: listPct(workDone, workTotal),

      charts,

      insights,

      doorsWeek: charts.reduce((s, p) => s + p.doors, 0),

      quotesWeek: charts.reduce((s, p) => s + p.quotes, 0),

      jobsWeek: charts.reduce((s, p) => s + p.jobsBooked, 0),

    };

  }, [day, date]);



  if (!ready || !day || !snap) {

    return (

      <AppShell>

        <p className="hq-lede">Loading HQ…</p>

      </AppShell>

    );

  }



  const goalDone = day.goals.filter((g) => g.done).length;



  return (

    <AppShell>

      <div className="hq-page">

        <header className="hq-page-header">

          <p className="hq-eyebrow">Harris Exterior Solutions · HQ</p>

          <h2 className="hq-page-title">{formatDisplayDate(date)}</h2>

          <p className="hq-lede">

            One place for the blackboard and commercial sales pipeline.

          </p>

        </header>



        <section className="hq-metric-strip" aria-label="Today at a glance">

          <div className="hq-metric">

            <span>Personal today</span>

            <strong>{snap.personalPct}%</strong>

          </div>

          <div className="hq-metric">

            <span>Work today</span>

            <strong>{snap.workPct}%</strong>

          </div>

          <div className="hq-metric">

            <span>Doors (7d)</span>

            <strong>{snap.doorsWeek}</strong>

          </div>

          <div className="hq-metric">

            <span>Jobs booked (7d)</span>

            <strong>{snap.jobsWeek}</strong>

          </div>

        </section>



        <section className="hq-card">

          <div className="hq-section-head">

            <h2>Apps</h2>

            <span className="hq-pill accent">Launch</span>

          </div>

          <div className="hq-app-grid">

            <article className="hq-app-card">

              <div className="hq-app-card-head">

                <h3>Blackboard</h3>

                <span className="hq-pill">Daily board</span>

              </div>

              <p className="hq-app-blurb">

                Personal checklist, door metrics, outreach scoreboard, and

                journal.

              </p>

              <div className="hq-app-actions">

                <Link href="/personal" className="hq-btn">

                  Personal

                </Link>

                <Link href="/work" className="hq-btn secondary">

                  Work

                </Link>

              </div>

            </article>

            <article className="hq-app-card">

              <div className="hq-app-card-head">

                <h3>Commercial Sales OS</h3>

                <span className="hq-pill">Pipeline</span>

              </div>

              <p className="hq-app-blurb">

                Prospects, follow-ups, email templates, quotes, and analytics for

                pressure washing, window cleaning, and junk removal.

              </p>

              <div className="hq-app-actions">

                <a href="/sales/" className="hq-btn">

                  Open Sales OS

                </a>

              </div>

            </article>

          </div>

        </section>



        <div className="hq-split">

          <section className="hq-card">

            <div className="hq-section-head">

              <h2>Today&apos;s focus</h2>

              <span className="hq-pill">

                {goalDone}/2 · check off in Personal / Work

              </span>

            </div>

            <div className="hq-focus-grid">

              {day.goals.map((goal) => (

                <div

                  key={goal.id}

                  className={`hq-focus-card ${goal.done ? "done" : ""}`}

                >

                  <span className="hq-kicker">

                    {goal.category === "personal" ? "Personal" : "Business"}

                    {goal.done ? " · done" : ""}

                  </span>

                  <p>{goal.text}</p>

                  <Link

                    href={goal.category === "personal" ? "/personal" : "/work"}

                    className="hq-link"

                  >

                    Open {goal.category === "personal" ? "personal" : "work"} →

                  </Link>

                </div>

              ))}

            </div>

          </section>



          <section className="hq-card">

            <div className="hq-section-head">

              <h2>Charge</h2>

              <span className="hq-pill">Quote</span>

            </div>

            <blockquote className="hq-quote">

              <p>“{quote.text}”</p>

              <footer>— {quote.author}</footer>

            </blockquote>

          </section>

        </div>



        <section className="hq-card">

          <div className="hq-section-head">

            <h2>Week at a glance</h2>

            <span className="hq-pill">Last 7 days</span>

          </div>

          <div className="chart-grid">

            <BarChart

              title="Personal completion %"

              suffix="%"

              max={100}

              points={snap.charts.map((p) => ({

                label: p.label,

                value: p.personalPct,

              }))}

            />

            <BarChart

              title="Work completion %"

              suffix="%"

              max={100}

              points={snap.charts.map((p) => ({

                label: p.label,

                value: p.workPct,

              }))}

            />

            <BarChart

              title="Doors knocked"

              points={snap.charts.map((p) => ({

                label: p.label,

                value: p.doors,

              }))}

            />

            <BarChart

              title="Conversations"

              points={snap.charts.map((p) => ({

                label: p.label,

                value: p.conversations,

              }))}

            />

          </div>

          <p className="chart-footnote">

            Quotes this week: <strong>{snap.quotesWeek}</strong>

            {" · "}

            Jobs booked: <strong>{snap.jobsWeek}</strong>

          </p>

        </section>



        <div className="hq-wing-grid">

          <section className="hq-card">

            <div className="hq-section-head">

              <h2>Personal wing</h2>

              <span className="hq-pill accent">{snap.personalPct}%</span>

            </div>

            <p className="hq-app-blurb">

              Faith, health, social reps — the life side of HQ.

            </p>

            {day.personalNotes.trim() ? (

              <p className="hq-note">{day.personalNotes}</p>

            ) : (

              <p className="hq-note muted">No journal note yet today.</p>

            )}

            <Link href="/personal" className="hq-link">

              Enter personal →

            </Link>

          </section>



          <section className="hq-card">

            <div className="hq-section-head">

              <h2>Work wing</h2>

              <span className="hq-pill accent">{snap.workPct}%</span>

            </div>

            <p className="hq-app-blurb">

              Desk, doors, outreach, scoreboard — HES operations.

            </p>

            <div className="hq-mini-metrics">

              <span>

                D <strong>{day.metrics.doors}</strong>

              </span>

              <span>

                C <strong>{day.metrics.conversations}</strong>

              </span>

              <span>

                # <strong>{day.metrics.phoneNumbers}</strong>

              </span>

              <span>

                Q <strong>{day.metrics.quotes}</strong>

              </span>

              <span>

                J <strong>{day.metrics.jobsBooked}</strong>

              </span>

            </div>

            <Link href="/work" className="hq-link">

              Enter work →

            </Link>

          </section>

        </div>



        <section className="hq-card">

          <div className="hq-section-head">

            <h2>Journal</h2>

            <span className="hq-pill">What happened today</span>

          </div>

          <textarea

            className="field textarea journal-field"

            placeholder="Write it like a page in your book — wins, weird calls, convictions, jokes, whatever stuck…"

            value={day.notes}

            onChange={(e) => persist({ ...day, notes: e.target.value })}

          />

        </section>



        <section className="hq-card">

          <div className="hq-section-head">

            <h2>Signals</h2>

            <span className="hq-pill">

              {snap.insights.daysSampled

                ? `${snap.insights.daysSampled} day${

                    snap.insights.daysSampled === 1 ? "" : "s"

                  } in the log`

                : "Filling in over time"}

            </span>

          </div>

          {snap.insights.daysSampled === 0 ? (

            <p className="hq-note muted">

              Live in Personal + Work a few days. HQ will start showing what you

              crush and what needs pressure.

            </p>

          ) : (

            <div className="hq-insight-grid">

              <div>

                <p className="hq-kicker">You&apos;re crushing</p>

                <ul className="hq-insight-list">

                  {snap.insights.strongest.map((row) => (

                    <li key={row.id}>

                      <span className="hq-insight-pct">{row.pct}%</span>

                      <span className="hq-insight-label">

                        <span className="hq-kicker">{row.realm}</span>

                        {row.label}

                      </span>

                    </li>

                  ))}

                </ul>

              </div>

              <div>

                <p className="hq-kicker">Needs heat</p>

                {snap.insights.needsWork.length === 0 ? (

                  <p className="hq-note muted">Pretty even so far.</p>

                ) : (

                  <ul className="hq-insight-list">

                    {snap.insights.needsWork.map((row) => (

                      <li key={row.id}>

                        <span className="hq-insight-pct low">{row.pct}%</span>

                        <span className="hq-insight-label">

                          <span className="hq-kicker">{row.realm}</span>

                          {row.label}

                        </span>

                      </li>

                    ))}

                  </ul>

                )}

              </div>

            </div>

          )}

        </section>

      </div>

    </AppShell>

  );

}

