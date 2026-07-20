import { addDays, todayKey } from "../dates.ts";
import { jobsOnDate } from "../jobs/model.ts";
import type { Job } from "../jobs/types.ts";
import type { BoardStore } from "../types.ts";
import {
  buildPipelineCounts,
  buildPipelineNextActions,
  type PipelineAction,
  type PipelineCount,
} from "../work/pipeline.ts";

export type TodayItem = {
  id: string;
  title: string;
  detail: string;
  href: string;
  urgency: PipelineAction["urgency"];
  timeLabel?: string;
  actionLabel: string;
};

export type ModulePulse = {
  id: string;
  label: string;
  href: string;
  lines: string[];
  attention: boolean;
};

function hourGreeting(now = new Date()): string {
  const h = now.getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

/** Personalized daily header — keep the name short and human. */
export function buildHomeGreeting(name = "Will"): string {
  return `${hourGreeting()}, ${name}`;
}

function actionLabel(urgency: PipelineAction["urgency"], deskId: string): string {
  if (urgency === "overdue") return "Handle now";
  if (urgency === "money") return "Open money";
  if (deskId === "requests") return "Respond";
  if (deskId === "jobs") return "Open schedule";
  if (deskId === "quotes") return "Open quote";
  if (deskId === "invoices") return "Open invoice";
  if (deskId === "tasks") return "Open task";
  return "Open";
}

function formatTime(startTime?: string): string | undefined {
  if (!startTime || !/^\d{2}:\d{2}/.test(startTime)) return undefined;
  const [hRaw, m] = startTime.split(":");
  let h = Number(hRaw);
  const suffix = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${h}:${m} ${suffix}`;
}

/**
 * Top attention items for home — pipeline next actions plus today's
 * scheduled jobs (with times) when they aren't already covered.
 */
export function buildTodayAttention(
  store: BoardStore,
  scheduleJobs: Job[],
  limit = 5,
): TodayItem[] {
  const today = todayKey();
  const pipeline = buildPipelineNextActions(store);
  const items: TodayItem[] = pipeline.map((row) => ({
    id: row.id,
    title: row.title,
    detail: row.reason,
    href: row.href,
    urgency: row.urgency,
    actionLabel: actionLabel(row.urgency, row.deskId),
  }));

  const covered = new Set(
    items
      .filter((i) => i.id.startsWith("job-"))
      .map((i) => i.id.replace(/^job-(today|overdue)-/, "")),
  );

  for (const job of jobsOnDate(scheduleJobs, today)) {
    if (job.status === "cancelled" || job.status === "completed") continue;
    if (covered.has(job.id)) continue;
    items.push({
      id: `sched-${job.id}`,
      title: job.companyName || job.customerName || job.title || "Job",
      detail: job.service || job.title || "On today’s schedule",
      href: `/work/jobs?view=day&date=${encodeURIComponent(today)}`,
      urgency: "today",
      timeLabel: formatTime(job.startTime),
      actionLabel: "Open day",
    });
  }

  const rank = { overdue: 0, money: 1, today: 2, soon: 3 } as const;
  return items
    .sort((a, b) => {
      const ur = rank[a.urgency] - rank[b.urgency];
      if (ur !== 0) return ur;
      return (a.timeLabel || "99").localeCompare(b.timeLabel || "99");
    })
    .slice(0, limit);
}

export function buildClearDayMessage(
  scheduleJobs: Job[],
  fromKey = todayKey(),
): string {
  for (let i = 1; i <= 14; i += 1) {
    const key = addDays(fromKey, i);
    const jobs = jobsOnDate(scheduleJobs, key).filter(
      (j) => j.status !== "cancelled",
    );
    if (!jobs.length) continue;
    const first = [...jobs].sort((a, b) =>
      (a.startTime || "").localeCompare(b.startTime || ""),
    )[0];
    const when =
      i === 1
        ? "tomorrow"
        : new Date(key + "T12:00:00").toLocaleDateString(undefined, {
            weekday: "long",
            month: "short",
            day: "numeric",
          });
    const time = formatTime(first.startTime);
    return time
      ? `You’re clear for today. Next up is ${when} at ${time}.`
      : `You’re clear for today. Next up is ${when}.`;
  }
  return "You’re clear for today. Nothing else is queued yet.";
}

function pulseLines(
  desk: PipelineCount,
  store: BoardStore,
  scheduleJobs: Job[],
): string[] {
  const today = todayKey();
  const lines: string[] = [];

  if (desk.id === "jobs") {
    const todayCount = jobsOnDate(scheduleJobs, today).filter(
      (j) => j.status !== "cancelled",
    ).length;
    const weekCount = scheduleJobs.filter((j) => {
      if (j.status === "cancelled" || !j.scheduledDate) return false;
      return j.scheduledDate >= today && j.scheduledDate <= addDays(today, 6);
    }).length;
    if (todayCount) lines.push(`${todayCount} on today’s schedule`);
    lines.push(
      weekCount
        ? `${weekCount} job${weekCount === 1 ? "" : "s"} this week`
        : "No jobs this week",
    );
    if (desk.attention) lines.push(`${desk.attention} need attention`);
    return lines.slice(0, 3);
  }

  if (desk.id === "requests") {
    const waiting = (store.requests ?? []).filter(
      (r) => r.status === "new" || r.status === "contacted",
    ).length;
    lines.push(
      waiting
        ? `${waiting} awaiting response`
        : "No requests waiting",
    );
    if (desk.count) lines.push(`${desk.count} total`);
    return lines;
  }

  if (desk.id === "invoices") {
    const open = (store.invoices ?? []).filter(
      (i) =>
        i.status === "draft" || i.status === "sent" || i.status === "overdue",
    );
    const overdue = open.filter(
      (i) => i.status === "overdue" || i.dueDate < today,
    );
    const amount = open.reduce((sum, i) => sum + (Number(i.amount) || 0), 0);
    if (amount > 0) {
      lines.push(
        `$${amount.toLocaleString(undefined, { maximumFractionDigits: 0 })} open`,
      );
    }
    if (overdue.length) lines.push(`${overdue.length} overdue`);
    else if (open.length) lines.push(`${open.length} need follow-up`);
    else lines.push("No open invoices");
    return lines.slice(0, 3);
  }

  if (desk.id === "tasks") {
    const open = (store.tasks ?? []).filter((t) => t.status === "open");
    const overdue = open.filter((t) => t.dueDate < today);
    const dueSoon = open.filter(
      (t) => t.dueDate >= today && t.dueDate <= addDays(today, 7),
    );
    if (overdue.length) lines.push(`${overdue.length} overdue`);
    if (dueSoon.length) lines.push(`${dueSoon.length} due this week`);
    if (!overdue.length && !dueSoon.length) {
      lines.push(open.length ? `${open.length} open` : "Caught up");
    }
    return lines.slice(0, 3);
  }

  if (desk.id === "quotes") {
    const live = (store.quotes ?? []).filter(
      (q) => q.status === "draft" || q.status === "sent",
    );
    const follow = live.filter(
      (q) => q.status === "sent" && q.followUpDate <= today,
    );
    lines.push(
      live.length
        ? `${live.length} open quote${live.length === 1 ? "" : "s"}`
        : "No open quotes",
    );
    if (follow.length) lines.push(`${follow.length} need follow-up`);
    return lines;
  }

  if (desk.attention) lines.push(`${desk.attention} need you`);
  else lines.push(desk.count ? `${desk.count} on file` : "Nothing here yet");
  return lines;
}

/** Live desk pulses for home modules — only real store data. */
export function buildHomeModules(
  store: BoardStore,
  scheduleJobs: Job[],
): ModulePulse[] {
  const counts = buildPipelineCounts(store);
  const order = [
    "jobs",
    "requests",
    "sales",
    "quotes",
    "invoices",
    "tasks",
  ] as const;

  const byId = Object.fromEntries(counts.map((c) => [c.id, c]));
  const modules: ModulePulse[] = [];

  for (const id of order) {
    if (id === "sales") {
      modules.push({
        id: "sales",
        label: "Sales OS",
        href: "/work/sales/",
        lines: ["Commercial pipeline"],
        attention: false,
      });
      continue;
    }
    const desk = byId[id];
    if (!desk) continue;
    const label =
      id === "jobs"
        ? "Schedule"
        : id === "requests"
          ? "Requests"
          : desk.label;
    modules.push({
      id,
      label,
      href: id === "jobs" ? "/work/jobs" : desk.href,
      lines: pulseLines(desk, store, scheduleJobs),
      attention: desk.attention > 0,
    });
  }

  return modules;
}
