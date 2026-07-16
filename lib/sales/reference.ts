import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

export class ReferenceRepository {
  constructor(private readonly db: SupabaseClient) {}

  async all() {
    const [users, leadSources, stages, services, tags] = await Promise.all([
      this.db.from("sales_users").select("id,display_name,email,role").eq("is_active", true).is("archived_at", null).order("display_name"),
      this.db.from("lead_sources").select("*").eq("is_active", true).is("archived_at", null).order("sort_order"),
      this.db.from("opportunity_stages").select("*").is("archived_at", null).order("sort_order"),
      this.db.from("services").select("*").eq("is_active", true).is("archived_at", null).order("sort_order"),
      this.db.from("tags").select("*").is("archived_at", null).order("name"),
    ]);
    for (const result of [users, leadSources, stages, services, tags]) {
      if (result.error) throw result.error;
    }
    return {
      users: users.data,
      leadSources: leadSources.data,
      opportunityStages: stages.data,
      services: services.data,
      tags: tags.data,
    };
  }
}
