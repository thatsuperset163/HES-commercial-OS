import { addDays, parseDateKey, toDateKey, todayKey } from "../dates.ts";
import type { Job } from "./types.ts";
import { jobsOnDate } from "./model.ts";
import { daySummary } from "./statusStyles.ts";

export type MonthCell = {
  dateKey: string;
  inMonth: boolean;
  isToday: boolean;
  jobs: Job[];
};

/** Sunday-start month grid (6 weeks) matching common calendar UIs. */
export function buildMonthGrid(anchorKey: string, jobs: Job[]): MonthCell[] {
  const anchor = parseDateKey(anchorKey);
  const year = anchor.getFullYear();
  const month = anchor.getMonth();
  const first = new Date(year, month, 1);
  const start = new Date(first);
  start.setDate(1 - first.getDay());
  const today = todayKey();
  const cells: MonthCell[] = [];
  for (let i = 0; i < 42; i += 1) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const dateKey = toDateKey(d);
    cells.push({
      dateKey,
      inMonth: d.getMonth() === month,
      isToday: dateKey === today,
      jobs: jobsOnDate(jobs, dateKey),
    });
  }
  return cells;
}

export function monthLabel(anchorKey: string) {
  return parseDateKey(anchorKey).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });
}

export function shiftMonth(anchorKey: string, delta: number): string {
  const d = parseDateKey(anchorKey);
  d.setMonth(d.getMonth() + delta);
  d.setDate(1);
  return toDateKey(d);
}

export function shiftWeek(anchorKey: string, delta: number): string {
  return addDays(anchorKey, delta * 7);
}

export function weekRangeLabel(keys: string[]) {
  if (!keys.length) return "";
  const a = parseDateKey(keys[0]).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
  const b = parseDateKey(keys[keys.length - 1]).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  return `${a} – ${b}`;
}

/** Hour slots for week/day time grid (6am–8pm). */
export const DAY_START_HOUR = 6;
export const DAY_END_HOUR = 20;

export function hourSlots(): number[] {
  return Array.from(
    { length: DAY_END_HOUR - DAY_START_HOUR },
    (_, i) => DAY_START_HOUR + i,
  );
}

export function timeToMinutes(time: string): number {
  const match = /^(\d{1,2}):(\d{2})$/.exec(time.trim());
  if (!match) return DAY_START_HOUR * 60;
  return Number(match[1]) * 60 + Number(match[2]);
}

export function minutesToTime(total: number): string {
  const clamped = Math.max(0, Math.min(23 * 60 + 45, total));
  const h = Math.floor(clamped / 60);
  const m = Math.round(clamped / 15) * 15 % 60;
  const hh = m === 60 ? h + 1 : h;
  const mm = m === 60 ? 0 : m;
  return `${String(hh % 24).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

export function jobBlockStyle(job: Job): { top: string; height: string } {
  const start = timeToMinutes(job.startTime || "09:00");
  const end = Math.max(
    start + 30,
    timeToMinutes(job.endTime || "") ||
      start + (job.estimatedDurationMinutes || 60),
  );
  const gridStart = DAY_START_HOUR * 60;
  const gridEnd = DAY_END_HOUR * 60;
  const topMin = Math.max(gridStart, Math.min(gridEnd, start)) - gridStart;
  const endMin = Math.max(gridStart, Math.min(gridEnd, end)) - gridStart;
  const heightMin = Math.max(28, endMin - topMin);
  const total = gridEnd - gridStart;
  return {
    top: `${(topMin / total) * 100}%`,
    height: `${(heightMin / total) * 100}%`,
  };
}

export type ScheduleFilterState = {
  status: Job["status"] | "all";
  assignee: string;
  query: string;
  includeUnscheduled: boolean;
};

export const DEFAULT_FILTERS: ScheduleFilterState = {
  status: "all",
  assignee: "",
  query: "",
  includeUnscheduled: true,
};

export function filterJobs(jobs: Job[], filters: ScheduleFilterState): Job[] {
  const q = filters.query.trim().toLowerCase();
  return jobs.filter((job) => {
    if (filters.status !== "all" && job.status !== filters.status) return false;
    if (
      filters.assignee &&
      !job.assignedTo.toLowerCase().includes(filters.assignee.toLowerCase())
    ) {
      return false;
    }
    if (!filters.includeUnscheduled && job.status === "unscheduled") return false;
    if (!q) return true;
    const hay = [
      job.customerName,
      job.companyName,
      job.title,
      job.service,
      job.address,
      job.phone,
    ]
      .join(" ")
      .toLowerCase();
    return hay.includes(q);
  });
}

export type WeekGlanceDay = {
  dateKey: string;
  label: string;
  isToday: boolean;
  count: number;
  revenue: number;
  hours: number;
  names: string[];
  more: number;
};

export function buildWeekGlance(jobs: Job[], fromKey = todayKey()): WeekGlanceDay[] {
  const today = todayKey();
  return Array.from({ length: 7 }, (_, i) => {
    const dateKey = addDays(fromKey, i);
    const dayJobs = jobsOnDate(jobs, dateKey);
    const summary = daySummary(dayJobs);
    const names = dayJobs
      .slice(0, 3)
      .map((j) => j.companyName || j.customerName);
    return {
      dateKey,
      label: parseDateKey(dateKey).toLocaleDateString(undefined, {
        weekday: "short",
        month: "numeric",
        day: "numeric",
      }),
      isToday: dateKey === today,
      count: summary.count,
      revenue: summary.revenue,
      hours: summary.hours,
      names,
      more: Math.max(0, dayJobs.length - 3),
    };
  });
}

export function unscheduledJobs(jobs: Job[]): Job[] {
  return jobs
    .filter((j) => j.status === "unscheduled" || !j.scheduledDate)
    .filter((j) => j.status !== "cancelled");
}

export function overdueJobs(jobs: Job[], today = todayKey()): Job[] {
  return jobs.filter(
    (j) =>
      j.status !== "cancelled" &&
      j.status !== "completed" &&
      j.scheduledDate &&
      j.scheduledDate < today,
  );
}
