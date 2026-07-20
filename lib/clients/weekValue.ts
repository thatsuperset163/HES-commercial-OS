import { addDays, getWeekKeys, todayKey } from "../dates.ts";
import type { Job } from "../jobs/types.ts";

export type WeekJobValue = {
  /** Monday key of the week */
  weekStart: string;
  scheduledValue: number;
  scheduledCount: number;
  completedValue: number;
  collectedValue: number;
  averageJobValue: number;
  /** Percent change of scheduled value vs prior week (null if prior was 0). */
  scheduledChangePct: number | null;
  priorScheduledValue: number;
};

function weekBounds(fromKey: string): { start: string; end: string } {
  const keys = getWeekKeys(fromKey);
  return { start: keys[0]!, end: keys[6]! };
}

function sumAmounts(jobs: Job[]): number {
  return jobs.reduce((sum, j) => sum + (Number(j.amount) || 0), 0);
}

function jobsInWeek(jobs: Job[], start: string, end: string): Job[] {
  return jobs.filter((j) => {
    if (j.status === "cancelled" || !j.scheduledDate) return false;
    return j.scheduledDate >= start && j.scheduledDate <= end;
  });
}

/**
 * Job Value This Week — based on scheduled job amounts for the calendar week
 * (Mon–Sun). Completed/collected are secondary breakdowns for clarity.
 */
export function buildWeekJobValue(
  jobs: Job[],
  fromKey = todayKey(),
): WeekJobValue {
  const { start, end } = weekBounds(fromKey);
  const priorStart = addDays(start, -7);
  const priorEnd = addDays(end, -7);

  const thisWeek = jobsInWeek(jobs, start, end);
  const priorWeek = jobsInWeek(jobs, priorStart, priorEnd);

  const scheduledValue = sumAmounts(thisWeek);
  const priorScheduledValue = sumAmounts(priorWeek);
  const completed = thisWeek.filter((j) => j.status === "completed");
  const collected = jobs.filter((j) => {
    if (j.status === "cancelled") return false;
    if (j.paymentStatus !== "paid" && j.invoiceStatus !== "paid") return false;
    const when = j.updatedAt?.slice(0, 10) || j.scheduledDate;
    return when >= start && when <= end;
  });

  const scheduledChangePct =
    priorScheduledValue > 0
      ? Math.round(
          ((scheduledValue - priorScheduledValue) / priorScheduledValue) * 100,
        )
      : scheduledValue > 0
        ? 100
        : null;

  return {
    weekStart: start,
    scheduledValue,
    scheduledCount: thisWeek.length,
    completedValue: sumAmounts(completed),
    collectedValue: sumAmounts(collected),
    averageJobValue:
      thisWeek.length > 0 ? scheduledValue / thisWeek.length : 0,
    scheduledChangePct,
    priorScheduledValue,
  };
}

export function moneyCompact(value: number): string {
  return `$${Math.round(value).toLocaleString("en-US")}`;
}
