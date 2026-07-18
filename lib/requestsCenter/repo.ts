import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { generateIntakeAi } from "./ai";
import {
  createIntakeRequest,
  intakeToRow,
  intakeUid,
  rowToActivity,
  rowToIntake,
} from "./model";
import type { IntakeActivity, IntakeRequest, IntakeStatus } from "./types";

export class IntakeRepo {
  constructor(private readonly db: SupabaseClient) {}

  async list(): Promise<IntakeRequest[]> {
    const { data, error } = await this.db
      .from("intake_requests")
      .select("*")
      .is("archived_at", null)
      .order("updated_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).map((row) => rowToIntake(row as Record<string, unknown>));
  }

  async get(id: string): Promise<{ request: IntakeRequest; activities: IntakeActivity[] }> {
    const { data, error } = await this.db
      .from("intake_requests")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    if (!data) throw Object.assign(new Error("not_found"), { code: "PGRST116" });

    const { data: acts, error: actError } = await this.db
      .from("intake_request_activities")
      .select("*")
      .eq("request_id", id)
      .order("created_at", { ascending: false });
    if (actError) throw actError;

    return {
      request: rowToIntake(data as Record<string, unknown>),
      activities: (acts ?? []).map((row) =>
        rowToActivity(row as Record<string, unknown>),
      ),
    };
  }

  async create(
    input: Parameters<typeof createIntakeRequest>[0],
  ): Promise<IntakeRequest> {
    const base = createIntakeRequest(input);
    const ai = generateIntakeAi(base);
    const request = { ...base, ...ai, updatedAt: new Date().toISOString() };
    const { error } = await this.db.from("intake_requests").insert(intakeToRow(request));
    if (error) throw error;
    await this.addActivity(request.id, "created", "Request created", {
      status: request.status,
      source: request.requestSource,
    });
    return request;
  }

  async update(
    id: string,
    patch: Partial<IntakeRequest>,
  ): Promise<IntakeRequest> {
    const current = await this.get(id);
    const next: IntakeRequest = {
      ...current.request,
      ...patch,
      id,
      updatedAt: new Date().toISOString(),
    };
    const { error } = await this.db
      .from("intake_requests")
      .update(intakeToRow(next))
      .eq("id", id);
    if (error) throw error;
    if (patch.status && patch.status !== current.request.status) {
      await this.addActivity(
        id,
        "status_change",
        `Status → ${patch.status}`,
        { from: current.request.status, to: patch.status },
      );
    }
    return next;
  }

  async setStatus(id: string, status: IntakeStatus): Promise<IntakeRequest> {
    return this.update(id, { status });
  }

  async addActivity(
    requestId: string,
    activityType: string,
    body: string,
    meta: Record<string, unknown> = {},
  ): Promise<IntakeActivity> {
    const activity: IntakeActivity = {
      id: intakeUid("act"),
      requestId,
      activityType,
      body,
      meta,
      createdAt: new Date().toISOString(),
    };
    const { error } = await this.db.from("intake_request_activities").insert({
      id: activity.id,
      request_id: activity.requestId,
      activity_type: activity.activityType,
      body: activity.body,
      meta: activity.meta,
      created_at: activity.createdAt,
    });
    if (error) throw error;
    return activity;
  }

  async refreshAi(id: string): Promise<IntakeRequest> {
    const { request } = await this.get(id);
    const ai = generateIntakeAi(request);
    const next = await this.update(id, ai);
    await this.addActivity(id, "ai_refresh", "AI fields regenerated");
    return next;
  }

  async archive(id: string): Promise<void> {
    const { error } = await this.db
      .from("intake_requests")
      .update({ archived_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw error;
  }
}
