import type { Job, JobStatus } from "./types.ts";

export type JobActionId =
  | "open"
  | "edit"
  | "en_route"
  | "in_progress"
  | "complete"
  | "call"
  | "navigate"
  | "send_eta"
  | "reschedule"
  | "cancel";

export type JobAction = {
  id: JobActionId;
  label: string;
  tone?: "primary" | "success" | "danger" | "ghost";
};

/** Status-aware actions for the day-view job card / details panel. */
export function actionsForJob(job: Job): JobAction[] {
  const actions: JobAction[] = [
    { id: "open", label: "Open Job", tone: "ghost" },
    { id: "edit", label: "Edit", tone: "ghost" },
  ];

  const status = job.status;
  if (status === "scheduled" || status === "confirmed") {
    actions.push({ id: "en_route", label: "Mark En Route", tone: "primary" });
  }
  if (status === "en_route" || status === "confirmed") {
    actions.push({
      id: "in_progress",
      label: "Mark In Progress",
      tone: "primary",
    });
  }
  if (
    status === "in_progress" ||
    status === "en_route" ||
    status === "confirmed" ||
    status === "scheduled"
  ) {
    actions.push({ id: "complete", label: "Mark Complete", tone: "success" });
  }

  if (job.phone.trim()) {
    actions.push({ id: "call", label: "Call Customer", tone: "ghost" });
  }
  if (job.address.trim()) {
    actions.push({ id: "navigate", label: "Open Navigation", tone: "ghost" });
  }
  if (
    status === "scheduled" ||
    status === "confirmed" ||
    status === "en_route"
  ) {
    actions.push({ id: "send_eta", label: "Send ETA", tone: "ghost" });
  }
  if (status !== "completed" && status !== "cancelled") {
    actions.push({ id: "reschedule", label: "Reschedule", tone: "ghost" });
    actions.push({ id: "cancel", label: "Cancel", tone: "danger" });
  }

  return actions;
}

export function mapsUrl(address: string) {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`;
}

export function telUrl(phone: string) {
  return `tel:${phone.replace(/[^\d+]/g, "")}`;
}

export function etaSmsBody(job: Job) {
  const name = job.contactName || job.customerName;
  const when = job.startTime ? ` around ${job.startTime}` : "";
  return `Hi ${name}, this is Harris Exterior Solutions. We're on the way${when}. See you soon!`;
}

export function statusPatch(action: JobActionId): Partial<Job> | null {
  const map: Partial<Record<JobActionId, JobStatus>> = {
    en_route: "en_route",
    in_progress: "in_progress",
    complete: "completed",
    cancel: "cancelled",
  };
  const status = map[action];
  return status ? { status } : null;
}
