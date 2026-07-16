import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

function startOfDay(now: Date) {
  const value = new Date(now);
  value.setHours(0, 0, 0, 0);
  return value;
}

function startOfWeek(now: Date) {
  const value = startOfDay(now);
  const day = value.getDay();
  value.setDate(value.getDate() - (day === 0 ? 6 : day - 1));
  return value;
}

export class DashboardRepository {
  constructor(private readonly db: SupabaseClient) {}

  async summary(now = new Date()) {
    const today = startOfDay(now);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const week = startOfWeek(now);
    const nowIso = now.toISOString();

    const [
      todaysFollowUps,
      overdueFollowUps,
      newProspects,
      openStages,
      wonStage,
      lostStage,
      upcomingTasks,
      recentActivities,
      largestOpportunities,
      newestCompanies,
    ] = await Promise.all([
      this.db.from("opportunities").select("*", { count: "exact", head: true }).is("archived_at", null).gte("next_follow_up_at", today.toISOString()).lt("next_follow_up_at", tomorrow.toISOString()),
      this.db.from("opportunities").select("*", { count: "exact", head: true }).is("archived_at", null).lt("next_follow_up_at", nowIso).not("lead_status", "in", '("converted","lost")'),
      this.db.from("companies").select("*", { count: "exact", head: true }).is("archived_at", null).gte("created_at", week.toISOString()),
      this.db.from("opportunity_stages").select("id").eq("is_closed", false).is("archived_at", null),
      this.db.from("opportunity_stages").select("id").eq("is_won", true).is("archived_at", null),
      this.db.from("opportunity_stages").select("id").eq("is_closed", true).eq("is_won", false).is("archived_at", null),
      this.db.from("sales_tasks").select("*, company:companies(id,name), opportunity:opportunities(id,name)").in("status", ["open", "in_progress"]).is("archived_at", null).gte("due_at", nowIso).order("due_at").limit(10),
      this.db.from("activities").select("*, company:companies(id,name), contact:contacts(id,full_name), opportunity:opportunities(id,name)").is("archived_at", null).order("occurred_at", { ascending: false }).limit(10),
      this.db.from("opportunities").select("*, company:companies(id,name), stage:opportunity_stages(id,name,is_closed,is_won)").is("archived_at", null).order("estimated_job_value", { ascending: false, nullsFirst: false }).limit(10),
      this.db.from("companies").select("*").is("archived_at", null).order("created_at", { ascending: false }).limit(10),
    ]);
    const initial = [todaysFollowUps, overdueFollowUps, newProspects, openStages, wonStage, lostStage, upcomingTasks, recentActivities, largestOpportunities, newestCompanies];
    for (const result of initial) if (result.error) throw result.error;

    const openIds = openStages.data?.map((stage) => stage.id) ?? [];
    const wonIds = wonStage.data?.map((stage) => stage.id) ?? [];
    const lostIds = lostStage.data?.map((stage) => stage.id) ?? [];
    const [openPipeline, won, lost] = await Promise.all([
      openIds.length
        ? this.db.from("opportunities").select("estimated_job_value,estimated_annual_value").in("stage_id", openIds).is("archived_at", null)
        : Promise.resolve({ data: [], error: null }),
      wonIds.length
        ? this.db.from("opportunities").select("*", { count: "exact", head: true }).in("stage_id", wonIds).is("archived_at", null)
        : Promise.resolve({ count: 0, error: null }),
      lostIds.length
        ? this.db.from("opportunities").select("*", { count: "exact", head: true }).in("stage_id", lostIds).is("archived_at", null)
        : Promise.resolve({ count: 0, error: null }),
    ]);
    for (const result of [openPipeline, won, lost]) if (result.error) throw result.error;
    const pipeline = openPipeline.data ?? [];

    return {
      metrics: {
        todaysFollowUps: todaysFollowUps.count ?? 0,
        overdueFollowUps: overdueFollowUps.count ?? 0,
        newProspectsThisWeek: newProspects.count ?? 0,
        openPipelineJobValue: pipeline.reduce((sum, row) => sum + Number(row.estimated_job_value ?? 0), 0),
        openPipelineAnnualValue: pipeline.reduce((sum, row) => sum + Number(row.estimated_annual_value ?? 0), 0),
        wonCount: won.count ?? 0,
        lostCount: lost.count ?? 0,
      },
      upcomingTasks: upcomingTasks.data,
      recentActivities: recentActivities.data,
      largestOpportunities: largestOpportunities.data,
      newestCompanies: newestCompanies.data,
      generatedAt: nowIso,
    };
  }
}
