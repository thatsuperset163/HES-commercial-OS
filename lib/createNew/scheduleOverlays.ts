import type { Job } from "../jobs/types.ts";
import type { IntakeRequest } from "../requestsCenter/types.ts";
import type { WorkTask } from "../work/types.ts";
import { createJob } from "../jobs/model.ts";

/** Lightweight calendar overlays for non-job schedule items. */
export type ScheduleOverlay = {
  id: string;
  kind: "task" | "request_estimate";
  dateKey: string;
  startTime: string;
  title: string;
  subtitle: string;
  href: string;
};

export function tasksToOverlays(tasks: WorkTask[]): ScheduleOverlay[] {
  return tasks
    .filter((t) => t.status === "open" && t.dueDate)
    .map((t) => ({
      id: `task-${t.id}`,
      kind: "task" as const,
      dateKey: t.dueDate,
      startTime: "08:00",
      title: t.title,
      subtitle: "Task",
      href: "/work/tasks",
    }));
}

export function intakeEstimatesToOverlays(
  requests: IntakeRequest[],
): ScheduleOverlay[] {
  return requests
    .filter(
      (r) =>
        r.estimateDate &&
        r.status !== "declined" &&
        r.status !== "approved",
    )
    .map((r) => ({
      id: `est-${r.id}`,
      kind: "request_estimate" as const,
      dateKey: r.estimateDate!,
      startTime: r.estimateTime || "10:00",
      title: r.customerName,
      subtitle: "Quote visit / estimate",
      href: "/work/requests",
    }));
}

export function isBlockedTimeJob(job: Job): boolean {
  const hay = `${job.service} ${job.title}`.toLowerCase();
  return hay.includes("blocked time") || hay.includes("blocked-time");
}

export function isQuoteVisitJob(job: Job): boolean {
  const hay = `${job.service} ${job.title}`.toLowerCase();
  return (
    hay.includes("quote visit") ||
    hay.includes("site visit") ||
    hay.includes("estimate")
  );
}

/** Preset for creating a quote-visit appointment via field_jobs. */
export function quoteVisitDefaults(dateKey: string, startTime = "10:00"): Partial<Job> {
  return {
    service: "Quote Visit",
    title: "Quote visit",
    scheduledDate: dateKey,
    startTime,
    estimatedDurationMinutes: 60,
    status: "scheduled",
    customerName: "",
  };
}

/** Preset for blocked time via field_jobs. */
export function blockedTimeDefaults(
  dateKey: string,
  startTime = "09:00",
): Partial<Job> {
  return {
    customerName: "Blocked time",
    service: "Blocked Time",
    title: "Blocked time",
    scheduledDate: dateKey,
    startTime,
    estimatedDurationMinutes: 60,
    status: "confirmed",
    amount: null,
  };
}

export function overlayAsDisplayJob(overlay: ScheduleOverlay): Job {
  return {
    ...createJob({
      customerName: overlay.title,
      service: overlay.subtitle,
      title: overlay.title,
      scheduledDate: overlay.dateKey,
      startTime: overlay.startTime,
      estimatedDurationMinutes: 30,
      status: "scheduled",
      notes: `overlay:${overlay.kind}:${overlay.href}`,
    }),
    id: overlay.id,
  };
}
