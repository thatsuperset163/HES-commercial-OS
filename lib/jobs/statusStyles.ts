import type { Job, JobStatus } from "./types.ts";
import { jobStatusLabel } from "./types.ts";

export type StatusVisual = {
  status: JobStatus;
  label: string;
  cssVar: string;
  className: string;
  outline?: boolean;
};

const MAP: Record<JobStatus, Omit<StatusVisual, "status" | "label">> = {
  unscheduled: { cssVar: "--job-unscheduled", className: "job-status-unscheduled" },
  scheduled: { cssVar: "--job-scheduled", className: "job-status-scheduled" },
  confirmed: { cssVar: "--job-confirmed", className: "job-status-confirmed" },
  en_route: { cssVar: "--job-en-route", className: "job-status-en-route" },
  in_progress: { cssVar: "--job-in-progress", className: "job-status-in-progress" },
  completed: { cssVar: "--job-completed", className: "job-status-completed" },
  cancelled: { cssVar: "--job-cancelled", className: "job-status-cancelled" },
};

export function statusVisual(status: JobStatus): StatusVisual {
  return {
    status,
    label: jobStatusLabel(status),
    ...MAP[status],
  };
}

export function isQuoteOrVisit(job: Job): boolean {
  const hay = `${job.service} ${job.title} ${job.description}`.toLowerCase();
  return (
    hay.includes("quote") ||
    hay.includes("estimate") ||
    hay.includes("site visit") ||
    hay.includes("walkthrough")
  );
}

export function daySummary(jobs: Job[]) {
  const active = jobs.filter((j) => j.status !== "cancelled");
  const revenue = active.reduce((sum, j) => sum + (j.amount || 0), 0);
  const hours =
    active.reduce((sum, j) => sum + (j.estimatedDurationMinutes || 0), 0) / 60;
  return {
    count: active.length,
    revenue,
    hours: Math.round(hours * 10) / 10,
  };
}

export function moneyLabel(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "—";
  return `$${Math.round(value).toLocaleString("en-US")}`;
}

export function hoursLabel(minutes: number) {
  if (!minutes) return "—";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (!h) return `${m}m`;
  if (!m) return `${h}h`;
  return `${h}h ${m}m`;
}
