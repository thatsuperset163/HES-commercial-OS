"use client";

import Link from "next/link";
import { moneyLabel } from "@/lib/jobs/statusStyles";
import type { WeekGlanceDay } from "@/lib/jobs/calendar";
import { parseDateKey } from "@/lib/dates";
import { jobsDayHref } from "@/lib/osNav";

type Props = {
  days: WeekGlanceDay[];
};

const WEEKDAY_CLASS = [
  "is-sun",
  "is-mon",
  "is-tue",
  "is-wed",
  "is-thu",
  "is-fri",
  "is-sat",
] as const;

export default function HQWeekAtGlance({ days }: Props) {
  return (
    <section className="hq-card hq-week-glance" aria-label="This week schedule">
      <div className="hq-section-head">
        <h2>This Week</h2>
        <Link href="/work/jobs" className="hq-link">
          Open Schedule →
        </Link>
      </div>
      <div className="hq-week-grid">
        {days.map((day) => {
          const weekday = WEEKDAY_CLASS[parseDateKey(day.dateKey).getDay()];
          return (
            <Link
              key={day.dateKey}
              href={jobsDayHref(day.dateKey)}
              className={`hq-week-day ${weekday}${day.isToday ? " is-today" : ""}`}
              aria-label={`${day.label} agenda`}
            >
              <header>
                <strong>{day.label}</strong>
                {day.isToday ? <span className="hq-pill accent">Today</span> : null}
              </header>
              <p className="hq-week-stats">
                {day.count} job{day.count === 1 ? "" : "s"} · {moneyLabel(day.revenue)} ·{" "}
                {day.hours}h
              </p>
              {day.names.length ? (
                <ul className="hq-week-names">
                  {day.names.map((name) => (
                    <li key={`${day.dateKey}-${name}`}>{name}</li>
                  ))}
                  {day.more > 0 ? <li className="muted">+{day.more} more</li> : null}
                </ul>
              ) : (
                <p className="hq-week-empty">Open</p>
              )}
            </Link>
          );
        })}
      </div>
    </section>
  );
}
