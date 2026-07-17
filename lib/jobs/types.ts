export type JobStatus = "scheduled" | "done" | "invoiced" | "cancelled";

export type Job = {
  id: string;
  customerName: string;
  address: string;
  service: string;
  scheduledDate: string; // YYYY-MM-DD
  amount: number | null;
  status: JobStatus;
  notes: string;
  createdAt: string;
  updatedAt: string;
};

export type JobInput = {
  customerName: string;
  address?: string;
  service?: string;
  scheduledDate: string;
  amount?: number | null;
  notes?: string;
};

export const JOB_STATUSES: { id: JobStatus; label: string }[] = [
  { id: "scheduled", label: "Scheduled" },
  { id: "done", label: "Done" },
  { id: "invoiced", label: "Invoiced" },
  { id: "cancelled", label: "Cancelled" },
];

export function jobStatusLabel(status: JobStatus) {
  return JOB_STATUSES.find((row) => row.id === status)?.label ?? status;
}
