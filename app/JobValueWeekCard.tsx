"use client";

import { moneyCompact, type WeekJobValue } from "@/lib/clients/weekValue";

type Props = {
  value: WeekJobValue;
};

export default function JobValueWeekCard({ value }: Props) {
  const change =
    value.scheduledChangePct == null
      ? null
      : value.scheduledChangePct >= 0
        ? `+${value.scheduledChangePct}% vs last week`
        : `${value.scheduledChangePct}% vs last week`;

  return (
    <section className="home-kpi-week" aria-label="Job value this week">
      <div className="hq-section-head">
        <h2>Job value this week</h2>
        <span className="hq-pill accent">Scheduled</span>
      </div>
      <p className="home-kpi-lede">
        Based on scheduled job amounts (Mon–Sun). Canceled jobs excluded.
      </p>
      <div className="home-kpi-hero">
        <strong>{moneyCompact(value.scheduledValue)}</strong>
        <span>
          {value.scheduledCount} job{value.scheduledCount === 1 ? "" : "s"}
          {value.scheduledCount
            ? ` · avg ${moneyCompact(value.averageJobValue)}`
            : ""}
        </span>
        {change ? <span className="home-kpi-change">{change}</span> : null}
      </div>
      <ul className="home-kpi-breakdown">
        <li>
          <span>Scheduled</span>
          <strong>{moneyCompact(value.scheduledValue)}</strong>
        </li>
        <li>
          <span>Completed</span>
          <strong>{moneyCompact(value.completedValue)}</strong>
        </li>
        <li>
          <span>Collected</span>
          <strong>{moneyCompact(value.collectedValue)}</strong>
        </li>
      </ul>
    </section>
  );
}
