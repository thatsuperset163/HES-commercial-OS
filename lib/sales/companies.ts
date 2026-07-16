import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { assertData, id } from "./http";
import { pageRange, pageResult, parsePage } from "./query";
import type { CompanyInput } from "./types";

export class CompaniesRepository {
  constructor(private readonly db: SupabaseClient) {}

  async list(params: URLSearchParams) {
    const page = parsePage(params, ["name", "industry", "city", "state", "created_at", "updated_at"], "created_at");
    let query = this.db.from("companies").select("*", { count: "exact" }).is("archived_at", null);
    for (const field of ["industry", "city", "state"] as const) {
      const value = params.get(field);
      if (value) query = query.ilike(field, value);
    }
    const assignedUser = params.get("assignedUser");
    if (assignedUser) query = query.eq("assigned_user_id", assignedUser);
    const search = params.get("search");
    if (search) query = query.or(`name.ilike.%${search.replaceAll(",", "")}%,notes.ilike.%${search.replaceAll(",", "")}%`);
    const [from, to] = pageRange(page);
    const result = await query
      .order(page.sort, { ascending: page.direction === "asc" })
      .order("id", { ascending: true })
      .range(from, to);
    if (result.error) throw result.error;
    return pageResult(result.data, result.count, page);
  }

  async get(companyId: string) {
    const company = assertData<Record<string, unknown>>(
      await this.db.from("companies").select("*").eq("id", companyId).is("archived_at", null).maybeSingle(),
      true,
    );
    const [contacts, opportunities, tags] = await Promise.all([
      this.db.from("contacts").select("*").eq("company_id", companyId).is("archived_at", null).order("is_primary", { ascending: false }),
      this.db.from("opportunities").select("*, opportunity_stages(id,name,is_closed,is_won), lead_sources(id,name)").eq("company_id", companyId).is("archived_at", null).order("created_at", { ascending: false }),
      this.db.from("company_tags").select("tag:tags(*)").eq("company_id", companyId),
    ]);
    if (contacts.error) throw contacts.error;
    if (opportunities.error) throw opportunities.error;
    if (tags.error) throw tags.error;
    return { ...company, contacts: contacts.data, opportunities: opportunities.data, tags: tags.data?.map((row) => row.tag) };
  }

  create(input: CompanyInput) {
    return this.mutate({ id: id("company"), ...input }, false);
  }

  update(companyId: string, input: Partial<CompanyInput>) {
    return this.mutate({ ...input, updated_at: new Date().toISOString() }, true, companyId);
  }

  archive(companyId: string) {
    return this.mutate({ archived_at: new Date().toISOString(), updated_at: new Date().toISOString() }, true, companyId);
  }

  private async mutate(values: Record<string, unknown>, update: boolean, companyId?: string) {
    const query = update
      ? this.db.from("companies").update(values).eq("id", companyId!).is("archived_at", null)
      : this.db.from("companies").insert(values);
    return assertData(await query.select("*").single());
  }
}
