import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  createJob,
  jobToRow,
  normalizeJobRecord,
  patchJob,
  rowToJob,
} from "./model";
import type { Job, JobInput, JobStatus } from "./types";

export class FieldJobsRepo {
  constructor(private readonly db: SupabaseClient) {}

  async list(): Promise<Job[]> {
    const { data, error } = await this.db
      .from("field_jobs")
      .select("*")
      .is("archived_at", null)
      .order("scheduled_date", { ascending: true, nullsFirst: false })
      .order("start_time", { ascending: true, nullsFirst: false });
    if (error) throw error;
    return (data ?? []).map((row) =>
      rowToJob(row as Record<string, unknown>),
    );
  }

  async get(id: string): Promise<Job> {
    const { data, error } = await this.db
      .from("field_jobs")
      .select("*")
      .eq("id", id)
      .is("archived_at", null)
      .maybeSingle();
    if (error) throw error;
    if (!data) throw Object.assign(new Error("not_found"), { code: "PGRST116" });
    return rowToJob(data as Record<string, unknown>);
  }

  async create(input: JobInput): Promise<Job> {
    const job = createJob(input);
    const { error } = await this.db.from("field_jobs").insert(jobToRow(job));
    if (error) throw error;
    return job;
  }

  async upsert(job: Job): Promise<Job> {
    const next = patchJob(job, {});
    const { error } = await this.db
      .from("field_jobs")
      .upsert(jobToRow(next), { onConflict: "id" });
    if (error) throw error;
    return next;
  }

  async update(id: string, patch: Partial<Job>): Promise<Job> {
    const current = await this.get(id);
    const next = patchJob(current, patch);
    const { error } = await this.db
      .from("field_jobs")
      .update(jobToRow(next))
      .eq("id", id);
    if (error) throw error;
    return next;
  }

  async setStatus(id: string, status: JobStatus): Promise<Job> {
    return this.update(id, { status });
  }

  async reschedule(
    id: string,
    scheduledDate: string,
    startTime: string,
    endTime?: string,
  ): Promise<Job> {
    const current = await this.get(id);
    const nextStatus =
      !scheduledDate.trim()
        ? "unscheduled"
        : current.status === "unscheduled"
          ? "scheduled"
          : current.status;
    return this.update(id, {
      scheduledDate,
      startTime,
      ...(endTime !== undefined ? { endTime } : {}),
      status: nextStatus,
    });
  }

  async archive(id: string): Promise<void> {
    const { error } = await this.db
      .from("field_jobs")
      .update({
        archived_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        status: "cancelled",
      })
      .eq("id", id);
    if (error) throw error;
  }

  /** Import blackboard/legacy jobs that are missing from field_jobs. */
  async importMissing(legacy: Job[]): Promise<number> {
    if (!legacy.length) return 0;
    const existing = await this.list();
    const have = new Set(existing.map((j) => j.id));
    const missing = legacy
      .map((row) => normalizeJobRecord(row as unknown as Record<string, unknown>))
      .filter((job) => job.id && !have.has(job.id));
    if (!missing.length) return 0;
    const { error } = await this.db
      .from("field_jobs")
      .upsert(missing.map(jobToRow), { onConflict: "id", ignoreDuplicates: true });
    if (error) throw error;
    return missing.length;
  }
}
