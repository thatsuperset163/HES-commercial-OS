"use client";

import { getWeekKeys } from "@/lib/dates";
import {
  DAY_END_HOUR,
  DAY_START_HOUR,
  hourSlots,
  jobBlockStyle,
  minutesToTime,
  timeToMinutes,
  unscheduledJobs,
} from "@/lib/jobs/calendar";
import { formatTimeLabel } from "@/lib/jobs/model";
import { isQuoteOrVisit, statusVisual } from "@/lib/jobs/statusStyles";
import type { Job } from "@/lib/jobs/types";

type Props = {
  anchorKey: string;
  jobs: Job[];
  onSelectJob: (job: Job) => void;
  onOpenDay: (dateKey: string) => void;
  onCreateAt: (dateKey: string, startTime: string) => void;
  onReschedule: (
    job: Job,
    scheduledDate: string,
    startTime: string,
  ) => void;
};

export default function WeekView({
  anchorKey,
  jobs,
  onSelectJob,
  onOpenDay,
  onCreateAt,
  onReschedule,
}: Props) {
  const days = getWeekKeys(anchorKey);
  const hours = hourSlots();
  const floating = unscheduledJobs(jobs);

  const dropOn = (
    dateKey: string,
    clientY: number,
    target: HTMLElement,
    jobId: string,
  ) => {
    const rect = target.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (clientY - rect.top) / rect.height));
    const totalMin = (DAY_END_HOUR - DAY_START_HOUR) * 60;
    const start = minutesToTime(DAY_START_HOUR * 60 + ratio * totalMin);
    const job = jobs.find((j) => j.id === jobId);
    if (job) onReschedule(job, dateKey, start);
  };

  return (
    <div className="jobs-week">
      {floating.length ? (
        <div className="jobs-week-unscheduled">
          <strong>Unscheduled</strong>
          <div className="jobs-week-unscheduled-list">
            {floating.map((job) => (
              <button
                key={job.id}
                type="button"
                className="jobs-week-chip"
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData("text/job-id", job.id);
                  e.dataTransfer.effectAllowed = "move";
                }}
                onClick={() => onSelectJob(job)}
              >
                {job.companyName || job.customerName}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="jobs-week-grid">
        <div className="jobs-week-gutter">
          <div className="jobs-week-corner" />
          {hours.map((h) => (
            <div key={h} className="jobs-week-hour">
              {formatTimeLabel(`${String(h).padStart(2, "0")}:00`)}
            </div>
          ))}
        </div>
        {days.map((dateKey) => {
          const dayJobs = jobs.filter(
            (j) =>
              j.scheduledDate === dateKey &&
              j.status !== "cancelled" &&
              j.status !== "unscheduled",
          );
          return (
            <div key={dateKey} className="jobs-week-col">
              <button
                type="button"
                className="jobs-week-dayhead"
                onClick={() => onOpenDay(dateKey)}
              >
                {new Date(dateKey + "T12:00:00").toLocaleDateString(undefined, {
                  weekday: "short",
                  month: "numeric",
                  day: "numeric",
                })}
              </button>
              <div
                className="jobs-week-lanes"
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const ratio = (e.clientY - rect.top) / rect.height;
                  const totalMin = (DAY_END_HOUR - DAY_START_HOUR) * 60;
                  const start = minutesToTime(
                    DAY_START_HOUR * 60 + ratio * totalMin,
                  );
                  onCreateAt(dateKey, start);
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  const id = e.dataTransfer.getData("text/job-id");
                  if (id) dropOn(dateKey, e.clientY, e.currentTarget, id);
                }}
              >
                {hours.map((h) => (
                  <div key={h} className="jobs-week-slot" />
                ))}
                {dayJobs.map((job) => {
                  const style = jobBlockStyle(job);
                  const visual = statusVisual(job.status);
                  const quote = isQuoteOrVisit(job);
                  return (
                    <button
                      key={job.id}
                      type="button"
                      className={`jobs-week-block ${visual.className}${quote ? " is-quote" : ""}`}
                      style={style}
                      draggable
                      onDragStart={(e) => {
                        e.stopPropagation();
                        e.dataTransfer.setData("text/job-id", job.id);
                        e.dataTransfer.effectAllowed = "move";
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectJob(job);
                      }}
                      title={`${formatTimeLabel(job.startTime)} ${job.customerName}`}
                    >
                      <span>{formatTimeLabel(job.startTime)}</span>
                      <strong>{job.companyName || job.customerName}</strong>
                      <em>{job.title || job.service}</em>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Exported for tests / duration math. */
export function overlapHint(jobs: Job[]): boolean {
  const timed = jobs
    .filter((j) => j.startTime)
    .sort((a, b) => a.startTime.localeCompare(b.startTime));
  for (let i = 1; i < timed.length; i += 1) {
    if (
      timeToMinutes(timed[i].startTime) <
      timeToMinutes(timed[i - 1].endTime || timed[i - 1].startTime)
    ) {
      return true;
    }
  }
  return false;
}
