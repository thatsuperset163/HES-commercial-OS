import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { assertData, id } from "./http";
import { optionalQueryDate, optionalQueryNumber, pageRange, pageResult, parsePage } from "./query";
import type { OpportunityInput } from "./types";

const SELECT = "*, company:companies(id,name,industry,city,state), primary_contact:contacts(id,full_name,email,phone), stage:opportunity_stages(id,name,probability,is_closed,is_won), lead_source:lead_sources(id,name)";

export class OpportunitiesRepository {
  constructor(private readonly db: SupabaseClient) {}

  async list(params: URLSearchParams) {
    const page = parsePage(params, ["name", "priority", "estimated_job_value", "estimated_annual_value", "next_follow_up_at", "expected_close_at", "created_at", "updated_at"], "created_at");
    let query = this.db.from("opportunities").select(SELECT, { count: "exact" }).is("archived_at", null);
    const exact: Record<string, string | null> = {
      stage_id: params.get("stage"),
      lead_status: params.get("leadStatus"),
      priority: params.get("priority"),
      assigned_user_id: params.get("assignedUser"),
      lead_source_id: params.get("leadSource"),
      company_id: params.get("companyId"),
    };
    for (const [field, value] of Object.entries(exact)) if (value) query = query.eq(field, value);
    const minJob = optionalQueryNumber(params, "minJobValue");
    const maxJob = optionalQueryNumber(params, "maxJobValue");
    const minAnnual = optionalQueryNumber(params, "minAnnualValue");
    const maxAnnual = optionalQueryNumber(params, "maxAnnualValue");
    const followUpFrom = optionalQueryDate(params, "followUpFrom");
    const followUpTo = optionalQueryDate(params, "followUpTo");
    if (minJob !== undefined) query = query.gte("estimated_job_value", minJob);
    if (maxJob !== undefined) query = query.lte("estimated_job_value", maxJob);
    if (minAnnual !== undefined) query = query.gte("estimated_annual_value", minAnnual);
    if (maxAnnual !== undefined) query = query.lte("estimated_annual_value", maxAnnual);
    if (followUpFrom) query = query.gte("next_follow_up_at", followUpFrom);
    if (followUpTo) query = query.lte("next_follow_up_at", followUpTo);
    const search = params.get("search")?.replaceAll(",", "");
    if (search) query = query.ilike("name", `%${search}%`);
    const [from, to] = pageRange(page);
    const result = await query
      .order(page.sort, { ascending: page.direction === "asc" })
      .order("id", { ascending: true })
      .range(from, to);
    if (result.error) throw result.error;
    return pageResult(result.data, result.count, page);
  }

  async get(opportunityId: string) {
    return assertData(
      await this.db.from("opportunities").select(`${SELECT}, opportunity_services(*, service:services(*)), opportunity_tags(tag:tags(*))`).eq("id", opportunityId).is("archived_at", null).maybeSingle(),
      true,
    );
  }

  create(input: OpportunityInput) {
    return this.mutate({ id: id("opportunity"), ...input }, false);
  }

  update(opportunityId: string, input: Partial<OpportunityInput>) {
    return this.mutate({ ...input, updated_at: new Date().toISOString() }, true, opportunityId);
  }

  archive(opportunityId: string) {
    const now = new Date().toISOString();
    return this.mutate({ archived_at: now, updated_at: now }, true, opportunityId);
  }

  private async mutate(values: Record<string, unknown>, update: boolean, opportunityId?: string) {
    const query = update
      ? this.db.from("opportunities").update(values).eq("id", opportunityId!).is("archived_at", null)
      : this.db.from("opportunities").insert(values);
    return assertData(await query.select(SELECT).single());
  }
}
