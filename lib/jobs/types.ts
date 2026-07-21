export type JobStatus =
  | "unscheduled"
  | "scheduled"
  | "confirmed"
  | "en_route"
  | "in_progress"
  | "completed"
  | "cancelled";

export type InvoiceStatus = "none" | "draft" | "sent" | "paid" | "void";
export type PaymentStatus = "unpaid" | "partial" | "paid" | "na";
export type JobPriority = "low" | "normal" | "high" | "urgent";
export type CalendarView = "month" | "week" | "day";

export type Job = {
  id: string;
  customerId: string | null;
  requestId: string | null;
  prospectId: string | null;
  /** Originating quote when created from an approved quote. */
  quoteId: string | null;
  customerName: string;
  companyName: string;
  contactName: string;
  phone: string;
  email: string;
  address: string;
  service: string;
  title: string;
  description: string;
  scheduledDate: string; // YYYY-MM-DD or ""
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  estimatedDurationMinutes: number;
  amount: number | null;
  assignedTo: string;
  status: JobStatus;
  priority: JobPriority;
  notes: string;
  customerNotes: string;
  equipmentNeeded: string;
  invoiceStatus: InvoiceStatus;
  paymentStatus: PaymentStatus;
  recurringRule: string;
  /** @deprecated prefer title/service — kept for blackboard compatibility */
  createdAt: string;
  updatedAt: string;
};

export type JobInput = {
  customerName: string;
  companyName?: string;
  contactName?: string;
  phone?: string;
  email?: string;
  address?: string;
  service?: string;
  title?: string;
  description?: string;
  scheduledDate?: string;
  startTime?: string;
  endTime?: string;
  estimatedDurationMinutes?: number;
  amount?: number | null;
  assignedTo?: string;
  status?: JobStatus;
  priority?: JobPriority;
  notes?: string;
  customerNotes?: string;
  equipmentNeeded?: string;
  customerId?: string | null;
  requestId?: string | null;
  prospectId?: string | null;
  quoteId?: string | null;
  invoiceStatus?: InvoiceStatus;
  paymentStatus?: PaymentStatus;
  recurringRule?: string;
};

export const JOB_STATUSES: { id: JobStatus; label: string }[] = [
  { id: "unscheduled", label: "Unscheduled" },
  { id: "scheduled", label: "Scheduled" },
  { id: "confirmed", label: "Confirmed" },
  { id: "en_route", label: "En Route" },
  { id: "in_progress", label: "In Progress" },
  { id: "completed", label: "Completed" },
  { id: "cancelled", label: "Cancelled" },
];

export function jobStatusLabel(status: JobStatus) {
  return JOB_STATUSES.find((row) => row.id === status)?.label ?? status;
}

/** Map legacy blackboard statuses into the scheduling model. */
export function coerceJobStatus(raw: unknown): JobStatus {
  const value = typeof raw === "string" ? raw : "";
  if (value === "done" || value === "invoiced") return "completed";
  if (JOB_STATUSES.some((row) => row.id === value)) return value as JobStatus;
  return "scheduled";
}
