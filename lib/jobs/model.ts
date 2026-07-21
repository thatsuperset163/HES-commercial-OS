import type {
  InvoiceStatus,
  Job,
  JobInput,
  JobPriority,
  JobStatus,
  PaymentStatus,
} from "./types.ts";
import { coerceJobStatus, JOB_STATUSES } from "./types.ts";

export function uid(prefix = "job"): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function asAmount(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return Math.max(0, value);
  if (typeof value === "string" && value.trim()) {
    const n = Number(value.replace(/[$,\s]/g, ""));
    return Number.isFinite(n) ? Math.max(0, n) : null;
  }
  return null;
}

function pick<T extends string>(
  value: unknown,
  allowed: readonly T[],
  fallback: T,
): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

export function addMinutesToTime(startTime: string, minutes: number): string {
  const match = /^(\d{1,2}):(\d{2})$/.exec(startTime.trim());
  if (!match) return "";
  const total = Number(match[1]) * 60 + Number(match[2]) + Math.max(0, minutes);
  const h = Math.floor(total / 60) % 24;
  const m = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function createJob(input: JobInput): Job {
  const now = new Date().toISOString();
  const duration = Math.max(
    15,
    Number(input.estimatedDurationMinutes) || 120,
  );
  const startTime = (input.startTime ?? "09:00").trim() || "09:00";
  const endTime =
    (input.endTime ?? "").trim() || addMinutesToTime(startTime, duration);
  const scheduledDate = (input.scheduledDate ?? "").trim();
  const status =
    input.status ??
    (scheduledDate ? "scheduled" : "unscheduled");

  return {
    id: uid("job"),
    customerId: input.customerId ?? null,
    requestId: input.requestId ?? null,
    prospectId: input.prospectId ?? null,
    quoteId: input.quoteId ?? null,
    customerName: input.customerName.trim() || "Customer",
    companyName: (input.companyName ?? "").trim(),
    contactName: (input.contactName ?? "").trim(),
    phone: (input.phone ?? "").trim(),
    email: (input.email ?? "").trim(),
    address: (input.address ?? "").trim(),
    service: (input.service ?? "").trim() || "Exterior cleaning",
    title:
      (input.title ?? "").trim() ||
      (input.service ?? "").trim() ||
      "Exterior cleaning",
    description: (input.description ?? "").trim(),
    scheduledDate,
    startTime,
    endTime,
    estimatedDurationMinutes: duration,
    amount:
      input.amount === undefined || input.amount === null || Number.isNaN(Number(input.amount))
        ? null
        : Math.max(0, Number(input.amount)),
    assignedTo: (input.assignedTo ?? "").trim(),
    status,
    priority: input.priority ?? "normal",
    notes: (input.notes ?? "").trim(),
    customerNotes: (input.customerNotes ?? "").trim(),
    equipmentNeeded: (input.equipmentNeeded ?? "").trim(),
    invoiceStatus: input.invoiceStatus ?? "none",
    paymentStatus: input.paymentStatus ?? "na",
    recurringRule: (input.recurringRule ?? "").trim(),
    createdAt: now,
    updatedAt: now,
  };
}

export function patchJob(job: Job, patch: Partial<Job>): Job {
  const next = {
    ...job,
    ...patch,
    customerName: (patch.customerName ?? job.customerName).trim() || job.customerName,
    companyName: (patch.companyName ?? job.companyName).trim(),
    contactName: (patch.contactName ?? job.contactName).trim(),
    phone: (patch.phone ?? job.phone).trim(),
    email: (patch.email ?? job.email).trim(),
    address: (patch.address ?? job.address).trim(),
    service: (patch.service ?? job.service).trim() || job.service,
    title: (patch.title ?? job.title).trim() || job.title,
    description: (patch.description ?? job.description).trim(),
    notes: (patch.notes ?? job.notes).trim(),
    customerNotes: (patch.customerNotes ?? job.customerNotes).trim(),
    equipmentNeeded: (patch.equipmentNeeded ?? job.equipmentNeeded).trim(),
    assignedTo: (patch.assignedTo ?? job.assignedTo).trim(),
    updatedAt: new Date().toISOString(),
  };

  if (
    patch.startTime !== undefined ||
    patch.estimatedDurationMinutes !== undefined
  ) {
    if (!patch.endTime) {
      next.endTime = addMinutesToTime(
        next.startTime || "09:00",
        next.estimatedDurationMinutes || 120,
      );
    }
  }

  return next;
}

export function advanceJobStatus(job: Job): Job {
  const next: Record<JobStatus, JobStatus | null> = {
    unscheduled: "scheduled",
    scheduled: "confirmed",
    confirmed: "en_route",
    en_route: "in_progress",
    in_progress: "completed",
    completed: null,
    cancelled: null,
  };
  // Legacy compat: old "done" callers mapped already via coerce
  const status = next[job.status];
  if (!status) return job;
  return patchJob(job, { status });
}

export function primaryActionForStatus(status: JobStatus): string | null {
  const map: Record<JobStatus, string | null> = {
    unscheduled: "Schedule",
    scheduled: "Confirm",
    confirmed: "Mark en route",
    en_route: "Mark in progress",
    in_progress: "Mark complete",
    completed: null,
    cancelled: null,
  };
  return map[status];
}

const PRIORITIES: JobPriority[] = ["low", "normal", "high", "urgent"];
const INVOICE: InvoiceStatus[] = ["none", "draft", "sent", "paid", "void"];
const PAYMENT: PaymentStatus[] = ["unpaid", "partial", "paid", "na"];

export function normalizeJobs(value: unknown): Job[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === "object")
    .map((row) => normalizeJobRecord(row));
}

export function normalizeJobRecord(row: Record<string, unknown>): Job {
  const amount = asAmount(row.amount ?? row.estimated_revenue);
  const durationRaw = row.estimatedDurationMinutes ?? row.estimated_duration_minutes;
  const duration =
    typeof durationRaw === "number" && Number.isFinite(durationRaw)
      ? Math.max(15, durationRaw)
      : 120;
  const startTime =
    asString(row.startTime || row.start_time) || "09:00";
  const endTime =
    asString(row.endTime || row.end_time) ||
    addMinutesToTime(startTime, duration);
  const service =
    asString(row.service || row.service_type).trim() || "Exterior cleaning";

  return {
    id: asString(row.id) || uid("job"),
    customerId: row.customerId || row.customer_id
      ? asString(row.customerId || row.customer_id)
      : null,
    requestId: row.requestId || row.request_id
      ? asString(row.requestId || row.request_id)
      : null,
    prospectId: row.prospectId || row.prospect_id
      ? asString(row.prospectId || row.prospect_id)
      : null,
    quoteId: row.quoteId || row.quote_id
      ? asString(row.quoteId || row.quote_id)
      : null,
    customerName:
      asString(row.customerName || row.customer_name).trim() || "Customer",
    companyName: asString(row.companyName || row.company_name),
    contactName: asString(row.contactName || row.contact_name),
    phone: asString(row.phone),
    email: asString(row.email),
    address: asString(row.address || row.service_address),
    service,
    title: asString(row.title).trim() || service,
    description: asString(row.description),
    scheduledDate: asString(row.scheduledDate || row.scheduled_date),
    startTime,
    endTime,
    estimatedDurationMinutes: duration,
    amount,
    assignedTo: asString(row.assignedTo || row.assigned_to || row.assigned_user_id),
    status: coerceJobStatus(row.status),
    priority: pick(row.priority, PRIORITIES, "normal"),
    notes: asString(row.notes || row.internal_notes),
    customerNotes: asString(row.customerNotes || row.customer_notes),
    equipmentNeeded: asString(row.equipmentNeeded || row.equipment_needed),
    invoiceStatus: pick(row.invoiceStatus || row.invoice_status, INVOICE, "none"),
    paymentStatus: pick(row.paymentStatus || row.payment_status, PAYMENT, "na"),
    recurringRule: asString(row.recurringRule || row.recurring_rule),
    createdAt: asString(row.createdAt || row.created_at) || new Date().toISOString(),
    updatedAt: asString(row.updatedAt || row.updated_at) || new Date().toISOString(),
  };
}

export function jobToRow(job: Job): Record<string, unknown> {
  return {
    id: job.id,
    // DB columns are NOT NULL with default ''; never send null.
    customer_id: job.customerId || "",
    request_id: job.requestId || "",
    prospect_id: job.prospectId || "",
    quote_id: job.quoteId || "",
    customer_name: job.customerName,
    company_name: job.companyName,
    contact_name: job.contactName,
    phone: job.phone,
    email: job.email,
    service_address: job.address,
    service_type: job.service,
    title: job.title,
    description: job.description,
    scheduled_date: job.scheduledDate || null,
    start_time: job.startTime || null,
    end_time: job.endTime || null,
    estimated_duration_minutes: job.estimatedDurationMinutes,
    estimated_revenue: job.amount ?? 0,
    assigned_to: job.assignedTo,
    status: job.status,
    priority: job.priority,
    internal_notes: job.notes,
    customer_notes: job.customerNotes,
    equipment_needed: job.equipmentNeeded,
    invoice_status: job.invoiceStatus,
    payment_status: job.paymentStatus,
    recurring_rule: job.recurringRule,
    created_at: job.createdAt,
    updated_at: job.updatedAt,
    archived_at: null,
  };
}

export function rowToJob(row: Record<string, unknown>): Job {
  return normalizeJobRecord(row);
}

export function formatTimeLabel(time: string): string {
  const match = /^(\d{1,2}):(\d{2})$/.exec(time.trim());
  if (!match) return time || "—";
  let h = Number(match[1]);
  const m = match[2];
  const suffix = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${h}:${m} ${suffix}`;
}

export function jobsOnDate(jobs: Job[], dateKey: string): Job[] {
  return jobs
    .filter(
      (job) =>
        job.status !== "cancelled" &&
        job.scheduledDate === dateKey,
    )
    .sort((a, b) => (a.startTime || "").localeCompare(b.startTime || ""));
}

export function isJobActiveStatus(status: JobStatus): boolean {
  return status !== "cancelled";
}

export { JOB_STATUSES };
