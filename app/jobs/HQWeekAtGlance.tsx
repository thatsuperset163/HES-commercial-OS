"use client";

import Link from "next/link";
import { moneyLabel } from "@/lib/jobs/statusStyles";
import type { WeekGlanceDay } from "@/lib/jobs/calendar";

type Props = {
  days: WeekGlanceDay[];
};

export default function HQWeekAtGlance({ days }: Props) {
  return (
    <section className="hq-card hq-week-glance" aria-label="This week schedule">
      <div className="hq-section-head">
        <h2>This Week</h2>
        <Link href="/work/jobs" className="hq-link">
          Open Jobs OS →
        </Link>
      </div>
      <div className="hq-week-grid">
        {days.map((day) => (
          <article
            key={day.dateKey}
            className={`hq-week-day${day.isToday ? " is-today" : ""}`}
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
          </article>
        ))}
      </div>
    </section>
  );
}
