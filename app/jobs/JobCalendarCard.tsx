"use client";

import type { DragEvent } from "react";
import { formatTimeLabel } from "@/lib/jobs/model";
import { isQuoteOrVisit, statusVisual } from "@/lib/jobs/statusStyles";
import type { Job } from "@/lib/jobs/types";

type Props = {
  job: Job;
  dense?: boolean;
  draggable?: boolean;
  onClick?: (job: Job) => void;
  onDragStart?: (job: Job, event: DragEvent) => void;
};

export default function JobCalendarCard({
  job,
  dense = false,
  draggable = false,
  onClick,
  onDragStart,
}: Props) {
  const visual = statusVisual(job.status);
  const quote = isQuoteOrVisit(job);
  const name = job.companyName || job.customerName;

  return (
    <button
      type="button"
      className={`job-cal-card ${visual.className}${quote ? " is-quote" : ""}${dense ? " is-dense" : ""}`}
      draggable={draggable}
      onDragStart={(e) => onDragStart?.(job, e)}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.(job);
      }}
      title={`${formatTimeLabel(job.startTime)} — ${name}\n${job.title || job.service}\n${visual.label}`}
    >
      <span className="job-cal-card-time">{formatTimeLabel(job.startTime)}</span>
      <span className="job-cal-card-name">{name}</span>
      {!dense ? (
        <span className="job-cal-card-service">{job.title || job.service}</span>
      ) : null}
      <span className="job-cal-card-status" aria-label={visual.label}>
        {visual.label}
      </span>
    </button>
  );
}
