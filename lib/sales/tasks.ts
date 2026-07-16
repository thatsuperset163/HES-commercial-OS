import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { assertData, id } from "./http";
import { optionalQueryDate, pageRange, pageResult, parsePage } from "./query";
import type { TaskInput, TaskStatus } from "./types";

const SELECT = "*, company:companies(id,name), contact:contacts(id,full_name), opportunity:opportunities(id,name)";

export class TasksRepository {
  constructor(private readonly db: SupabaseClient) {}

  async list(params: URLSearchParams) {
    const page = parsePage(params, ["due_at", "priority", "status", "task_type", "created_at", "updated_at"], "due_at");
    let query = this.db.from("sales_tasks").select(SELECT, { count: "exact" }).is("archived_at", null);
    const filters: Record<string, string | null> = {
      status: params.get("status"),
      task_type: params.get("taskType"),
      priority: params.get("priority"),
      assigned_user_id: params.get("assignedUser"),
      opportunity_id: params.get("opportunityId"),
      company_id: params.get("companyId"),
    };
    for (const [field, value] of Object.entries(filters)) if (value) query = query.eq(field, value);
    const dueFrom = optionalQueryDate(params, "dueFrom");
    const dueTo = optionalQueryDate(params, "dueTo");
    if (dueFrom) query = query.gte("due_at", dueFrom);
    if (dueTo) query = query.lte("due_at", dueTo);
    const [from, to] = pageRange(page);
    const result = await query
      .order(page.sort, { ascending: page.direction === "asc", nullsFirst: false })
      .order("id", { ascending: true })
      .range(from, to);
    if (result.error) throw result.error;
    return pageResult(result.data, result.count, page);
  }

  create(input: TaskInput) {
    return this.mutate({ id: id("task"), ...input }, false);
  }

  update(taskId: string, input: Partial<TaskInput>) {
    const values: Record<string, unknown> = { ...input, updated_at: new Date().toISOString() };
    this.applyStatusDates(values, input.status);
    return this.mutate(values, true, taskId);
  }

  private applyStatusDates(values: Record<string, unknown>, status?: TaskStatus) {
    if (!status) return;
    if (status === "completed") {
      values.completed_at = new Date().toISOString();
      values.canceled_at = null;
    } else if (status === "cancelled") {
      values.canceled_at = new Date().toISOString();
      values.completed_at = null;
    } else {
      values.completed_at = null;
      values.canceled_at = null;
    }
  }

  private async mutate(values: Record<string, unknown>, update: boolean, taskId?: string) {
    const query = update
      ? this.db.from("sales_tasks").update(values).eq("id", taskId!).is("archived_at", null)
      : this.db.from("sales_tasks").insert(values);
    return assertData(await query.select(SELECT).single());
  }
}
