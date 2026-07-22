"use client";

import Link from "next/link";
import { moneyLabel } from "@/lib/jobs/statusStyles";
import type { HqWeekGlanceDay } from "@/lib/home/todayOps";
import { parseDateKey } from "@/lib/dates";
import { jobsDayHref } from "@/lib/osNav";

type Props = {
  days: HqWeekGlanceDay[];
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
          const followUps = day.requestFollowUps + day.quoteFollowUps;
          return (
            <Link
              key={day.dateKey}
              href={jobsDayHref(day.dateKey)}
              className={`hq-week-day ${weekday}${day.isToday ? " is-today" : ""}${
                day.hasConflict || day.hasOverdue ? " has-exception" : ""
              }`}
              aria-label={`${day.label} agenda`}
            >
              <header>
                <strong>{day.label}</strong>
                {day.isToday ? <span className="hq-pill accent">Today</span> : null}
              </header>
              <p className="hq-week-stats">
                {day.jobCount} job{day.jobCount === 1 ? "" : "s"} ·{" "}
                {moneyLabel(day.jobValue)}
              </p>
              {followUps > 0 ? (
                <p className="hq-week-followups">
                  {followUps} follow-up{followUps === 1 ? "" : "s"}
                </p>
              ) : null}
              {day.hasConflict ? (
                <p className="hq-week-flag">Conflict</p>
              ) : day.hasOverdue ? (
                <p className="hq-week-flag">Overdue</p>
              ) : !day.jobCount && !followUps ? (
                <p className="hq-week-empty">Open</p>
              ) : null}
            </Link>
          );
        })}
      </div>
    </section>
  );
}
