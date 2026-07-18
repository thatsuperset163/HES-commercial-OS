import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { todayDateKey } from "./model";
import { IntakeRepo } from "./repo";
import type { IntakeRequest } from "./types";
import { createTask, normalizeTasks } from "../work/model";

type BlackboardState = {
  days?: Record<string, unknown>;
  tasks?: unknown[];
  [key: string]: unknown;
};

/** Overdue scheduled estimates → activity + Work task nag. */
export async function runIntakeEstimateNags(
  db: SupabaseClient,
  rows: IntakeRequest[],
): Promise<void> {
  const today = todayDateKey();
  const repo = new IntakeRepo(db);
  const overdue = rows.filter(
    (row) =>
      row.status === "estimate_scheduled" &&
      row.estimateDate &&
      row.estimateDate < today,
  );
  if (!overdue.length) return;

  const { data, error } = await db
    .from("blackboard_workspace")
    .select("state")
    .eq("id", "default")
    .maybeSingle();
  if (error) return;

  const state = (data?.state ?? { days: {} }) as BlackboardState;
  let tasks = normalizeTasks(state.tasks);
  let changed = false;

  for (const row of overdue) {
    const marker = `auto:overdue-estimate:${row.id}`;
    if (!tasks.some((task) => task.notes.includes(marker))) {
      tasks = [
        createTask({
          title: `Overdue estimate · ${row.customerName}`,
          dueDate: today,
          notes: `${marker} · Open /work/requests`,
        }),
        ...tasks,
      ];
      changed = true;
      await repo.addActivity(
        row.id,
        "nag",
        "Estimate date passed — follow up automatically flagged",
      );
    }
  }

  if (!changed) return;
  await db.from("blackboard_workspace").upsert({
    id: "default",
    state: {
      ...state,
      days: state.days && typeof state.days === "object" ? state.days : {},
      tasks,
    },
    updated_at: new Date().toISOString(),
  });
}
