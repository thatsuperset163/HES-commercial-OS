import type { Job, JobInput, JobStatus } from "./types.ts";

export function uid(prefix = "job"): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

export function createJob(input: JobInput): Job {
  const now = new Date().toISOString();
  return {
    id: uid("job"),
    customerName: input.customerName.trim() || "Customer",
    address: (input.address ?? "").trim(),
    service: (input.service ?? "").trim() || "Exterior cleaning",
    scheduledDate: input.scheduledDate,
    amount:
      input.amount === undefined || input.amount === null || Number.isNaN(input.amount)
        ? null
        : Math.max(0, Number(input.amount)),
    status: "scheduled",
    notes: (input.notes ?? "").trim(),
    createdAt: now,
    updatedAt: now,
  };
}

export function patchJob(job: Job, patch: Partial<Job>): Job {
  return {
    ...job,
    ...patch,
    customerName: (patch.customerName ?? job.customerName).trim() || job.customerName,
    address: (patch.address ?? job.address).trim(),
    service: (patch.service ?? job.service).trim() || job.service,
    notes: (patch.notes ?? job.notes).trim(),
    updatedAt: new Date().toISOString(),
  };
}

export function advanceJobStatus(job: Job): Job {
  const next: Record<JobStatus, JobStatus | null> = {
    scheduled: "done",
    done: "invoiced",
    invoiced: null,
    cancelled: null,
  };
  const status = next[job.status];
  if (!status) return job;
  return patchJob(job, { status });
}

export function normalizeJobs(value: unknown): Job[] {
  if (!Array.isArray(value)) return [];
  const allowed: JobStatus[] = ["scheduled", "done", "invoiced", "cancelled"];
  return value
    .filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === "object")
    .map((row) => {
      const status = allowed.includes(row.status as JobStatus)
        ? (row.status as JobStatus)
        : "scheduled";
      const amountRaw = row.amount;
      const amount =
        typeof amountRaw === "number" && Number.isFinite(amountRaw)
          ? amountRaw
          : null;
      return {
        id: typeof row.id === "string" && row.id ? row.id : uid("job"),
        customerName:
          typeof row.customerName === "string" && row.customerName.trim()
            ? row.customerName.trim()
            : "Customer",
        address: typeof row.address === "string" ? row.address : "",
        service:
          typeof row.service === "string" && row.service.trim()
            ? row.service.trim()
            : "Exterior cleaning",
        scheduledDate:
          typeof row.scheduledDate === "string" && row.scheduledDate
            ? row.scheduledDate
            : new Date().toISOString().slice(0, 10),
        amount,
        status,
        notes: typeof row.notes === "string" ? row.notes : "",
        createdAt:
          typeof row.createdAt === "string"
            ? row.createdAt
            : new Date().toISOString(),
        updatedAt:
          typeof row.updatedAt === "string"
            ? row.updatedAt
            : new Date().toISOString(),
      } satisfies Job;
    });
}
