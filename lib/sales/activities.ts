import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { assertData, id } from "./http";
import { optionalQueryDate, pageRange, pageResult, parsePage } from "./query";
import type { ActivityInput } from "./types";

const SELECT = "*, company:companies(id,name), contact:contacts(id,full_name), opportunity:opportunities(id,name)";

export class ActivitiesRepository {
  constructor(private readonly db: SupabaseClient) {}

  async list(params: URLSearchParams) {
    const page = parsePage(params, ["occurred_at", "created_at", "activity_type", "subject"], "occurred_at");
    let query = this.db.from("activities").select(SELECT, { count: "exact" }).is("archived_at", null);
    const filters: Record<string, string | null> = {
      activity_type: params.get("activityType"),
      opportunity_id: params.get("opportunityId"),
      company_id: params.get("companyId"),
      contact_id: params.get("contactId"),
      assigned_user_id: params.get("assignedUser"),
    };
    for (const [field, value] of Object.entries(filters)) if (value) query = query.eq(field, value);
    const fromDate = optionalQueryDate(params, "from");
    const toDate = optionalQueryDate(params, "to");
    if (fromDate) query = query.gte("occurred_at", fromDate);
    if (toDate) query = query.lte("occurred_at", toDate);
    const [from, to] = pageRange(page);
    const result = await query
      .order(page.sort, { ascending: page.direction === "asc" })
      .order("id", { ascending: true })
      .range(from, to);
    if (result.error) throw result.error;
    return pageResult(result.data, result.count, page);
  }

  async create(input: ActivityInput) {
    return assertData(
      await this.db.from("activities").insert({ id: id("activity"), ...input }).select(SELECT).single(),
    );
  }
}
