"use client";

import type { MonthCell } from "@/lib/jobs/calendar";
import type { Job } from "@/lib/jobs/types";
import JobCalendarCard from "./JobCalendarCard";

const MAX_VISIBLE = 3;

type Props = {
  cells: MonthCell[];
  onSelectJob: (job: Job) => void;
  onOpenDay: (dateKey: string) => void;
  onCreateOnDate: (dateKey: string) => void;
};

export default function MonthView({
  cells,
  onSelectJob,
  onOpenDay,
  onCreateOnDate,
}: Props) {
  return (
    <div className="jobs-month">
      <div className="jobs-month-head" aria-hidden>
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <div key={d}>{d}</div>
        ))}
      </div>
      <div className="jobs-month-grid">
        {cells.map((cell) => {
          const visible = cell.jobs.slice(0, MAX_VISIBLE);
          const hidden = cell.jobs.length - visible.length;
          const dayNum = Number(cell.dateKey.slice(-2));
          return (
            <div
              key={cell.dateKey}
              className={`jobs-month-cell${cell.inMonth ? "" : " is-outside"}${cell.isToday ? " is-today" : ""}`}
              onClick={() => onCreateOnDate(cell.dateKey)}
            >
              <button
                type="button"
                className="jobs-month-daynum"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenDay(cell.dateKey);
                }}
              >
                {dayNum}
              </button>
              <div className="jobs-month-items">
                {visible.map((job) => (
                  <JobCalendarCard
                    key={job.id}
                    job={job}
                    dense
                    onClick={onSelectJob}
                  />
                ))}
                {hidden > 0 ? (
                  <button
                    type="button"
                    className="jobs-month-more"
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenDay(cell.dateKey);
                    }}
                  >
                    +{hidden} more
                  </button>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
