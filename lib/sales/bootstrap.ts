import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { DashboardRepository } from "./dashboard";
import { ReferenceRepository } from "./reference";

export class BootstrapRepository {
  constructor(private readonly db: SupabaseClient) {}

  async load() {
    const [reference, dashboard] = await Promise.all([
      new ReferenceRepository(this.db).all(),
      new DashboardRepository(this.db).summary(),
    ]);
    return { reference, dashboard };
  }
}
