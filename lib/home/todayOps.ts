/**
 * HQ Today / Exceptions — operational command center helpers.
 *
 * Live sources:
 * - Intake requests (Supabase intake_requests) via Requests OS next-action
 * - Field jobs (Jobs API / scheduleJobs)
 * - Blackboard quotes (follow-ups)
 *
 * Intentionally does NOT use legacy blackboard ServiceRequest as live HQ data.
 * Loading these helpers must never mutate business records.
 */

import { todayKey, addDays, getWeekKeys } from "../dates.ts";
import { jobClientId } from "../clients/resolver.ts";
import type { ClientLinkFlag } from "../clients/resolver.ts";
import { jobsOnDate } from "../jobs/model.ts";
import type { Job } from "../jobs/types.ts";
import {
  buildRequestNextAction,
  type RequestNextAction,
} from "../requestsCenter/nextAction.ts";
import type { IntakeRequest } from "../requestsCenter/types.ts";
import type { QuoteDoc } from "../work/types.ts";

export type HqUrgency =
  | "critical"
  | "overdue"
  | "today"
  | "new"
  | "now"
  | "later"
  | "soon";

export type HqTodayKind = "request" | "job" | "quote";

export type HqTodayItem = {
  id: string;
  kind: HqTodayKind;
  urgency: HqUrgency;
  urgencyLabel: string;
  title: string;
  detail: string;
  meta: string;
  href: string;
  timeLabel?: string;
  valueLabel?: string;
  actionLabel: string;
  /** Stable entity id for tests / dedupe */
  entityId: string;
};

export type HqException = {
  id: string;
  title: string;
  detail: string;
  href: string;
  severity: "critical" | "warn";
};

function formatTime(startTime?: string): string | undefined {
  if (!startTime || !/^\d{1,2}:\d{2}/.test(startTime)) return undefined;
  const [hRaw, m] = startTime.split(":");
  let h = Number(hRaw);
  const suffix = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${h}:${m} ${suffix}`;
}

function timeToMinutes(time: string): number {
  const match = /^(\d{1,2}):(\d{2})$/.exec(time.trim());
  if (!match) return 9 * 60;
  return Number(match[1]) * 60 + Number(match[2]);
}

function money(value: number | null | undefined): string | undefined {
  if (value == null || !Number.isFinite(value) || value <= 0) return undefined;
  return `$${Math.round(value).toLocaleString("en-US")}`;
}

function daysBetween(fromKey: string, toKey: string): number {
  const a = new Date(`${fromKey}T12:00:00`).getTime();
  const b = new Date(`${toKey}T12:00:00`).getTime();
  return Math.round((b - a) / 86400000);
}

function urgencyRank(u: HqUrgency): number {
  const order: Record<HqUrgency, number> = {
    critical: 0,
    overdue: 1,
    today: 2,
    new: 3,
    now: 4,
    later: 5,
    soon: 6,
  };
  return order[u];
}

function mapRequestUrgency(
  next: RequestNextAction,
  request: IntakeRequest,
): HqUrgency | null {
  if (next.urgency === "lost" || next.urgency === "done") return null;
  if (next.urgency === "waiting") {
    // Only surface waiting items when a follow-up date has passed.
    if (request.followUpDate && request.followUpDate < todayKey()) {
      return "overdue";
    }
    return null;
  }
  if (next.urgency === "overdue") return "overdue";
  if (next.urgency === "today") {
    return request.status === "new" ? "new" : "today";
  }
  // soon — only keep actionable inbound / visit / quote-prep work
  if (
    request.status === "new" ||
    request.status === "needs_response" ||
    request.status === "estimate_scheduled" ||
    (request.convertedQuoteId && !request.convertedJobId)
  ) {
    return request.status === "new" ? "new" : "soon";
  }
  return null;
}

/** Requests that need human action — live intake only. */
export function buildHqRequestItems(
  requests: IntakeRequest[],
  today = todayKey(),
): HqTodayItem[] {
  const items: HqTodayItem[] = [];
  for (const request of requests) {
    const next = buildRequestNextAction(request, today);
    const urgency = mapRequestUrgency(next, request);
    if (!urgency) continue;

    const ageDays = daysBetween(request.dateReceived || request.createdAt.slice(0, 10), today);
    const ageLabel =
      ageDays <= 0 ? "Today" : ageDays === 1 ? "1 day old" : `${ageDays} days old`;

    items.push({
      id: `req-${request.id}`,
      kind: "request",
      entityId: request.id,
      urgency,
      urgencyLabel:
        urgency === "overdue"
          ? "Overdue"
          : urgency === "new"
            ? "New"
            : urgency === "today"
              ? "Due today"
              : "Needs action",
      title: request.company.trim() || request.customerName,
      detail: next.title,
      meta: [
        request.serviceRequested,
        next.reason,
        ageLabel,
        money(request.potentialValue),
        request.assignedPerson ? `Assigned ${request.assignedPerson}` : "",
      ]
        .filter(Boolean)
        .join(" · "),
      href: `/work/requests?id=${encodeURIComponent(request.id)}`,
      valueLabel: money(request.potentialValue),
      actionLabel: "Open request",
    });
  }
  return items;
}

/** Jobs scheduled for the local calendar day (not cancelled). */
export function buildHqJobItems(
  jobs: Job[],
  today = todayKey(),
): HqTodayItem[] {
  const nowMinutes = (() => {
    const d = new Date();
    return d.getHours() * 60 + d.getMinutes();
  })();

  return jobsOnDate(jobs, today)
    .filter((j) => j.status !== "cancelled")
    .map((job) => {
      const start = job.startTime || "";
      const match = /^(\d{1,2}):(\d{2})$/.exec(start);
      const startMin = match
        ? Number(match[1]) * 60 + Number(match[2])
        : null;
      let urgency: HqUrgency = "later";
      let urgencyLabel = "Later today";
      if (job.status === "completed") {
        urgency = "soon";
        urgencyLabel = "Completed";
      } else if (startMin != null && startMin <= nowMinutes && startMin >= nowMinutes - 90) {
        urgency = "now";
        urgencyLabel = "Happening now";
      } else if (startMin != null && startMin < nowMinutes - 90) {
        urgency = "overdue";
        urgencyLabel = "Overdue";
      } else if (startMin != null && startMin <= nowMinutes + 60) {
        urgency = "today";
        urgencyLabel = "Due today";
      }

      const flags: string[] = [];
      if (!job.address.trim()) flags.push("Missing address");
      if (!jobClientId(job)) flags.push("Missing client link");
      if (job.status === "scheduled") flags.push("Unconfirmed");
      if (job.amount == null || job.amount <= 0) flags.push("No value");
      if (job.status === "completed" && job.invoiceStatus === "none") {
        flags.push("Needs invoice");
      }

      return {
        id: `job-${job.id}`,
        kind: "job" as const,
        entityId: job.id,
        urgency,
        urgencyLabel,
        title: job.companyName || job.customerName || job.title || "Job",
        detail: job.service || job.title || "Scheduled job",
        meta: [
          job.address || "No address",
          job.assignedTo ? `Assigned ${job.assignedTo}` : "",
          job.status,
          ...flags,
        ]
          .filter(Boolean)
          .join(" · "),
        href: `/work/jobs?view=day&date=${encodeURIComponent(today)}`,
        timeLabel: formatTime(job.startTime),
        valueLabel: money(job.amount),
        actionLabel:
          job.status === "completed" && job.invoiceStatus === "none"
            ? "Create invoice"
            : "Open job",
      };
    })
    .sort((a, b) => (a.timeLabel || "99").localeCompare(b.timeLabel || "99"));
}

/** Sent quotes with follow-up due today / overdue; drafts only if follow-up dated ≤ today. */
export function buildHqQuoteItems(
  quotes: QuoteDoc[],
  today = todayKey(),
): HqTodayItem[] {
  const items: HqTodayItem[] = [];
  const DEFAULT_FOLLOW_DAYS = 3;

  for (const quote of quotes) {
    if (quote.status === "won" || quote.status === "lost") continue;

    let due = (quote.followUpDate || "").trim();
    if (!due && quote.status === "sent") {
      const sentDay = (quote.sentAt || quote.createdAt || "").slice(0, 10);
      if (sentDay) {
        due = addDays(sentDay, DEFAULT_FOLLOW_DAYS);
      }
    }
    if (!due) continue;
    if (due > today) continue;

    // Drafts only when an explicit follow-up due date exists and is due.
    if (quote.status === "draft" && !(quote.followUpDate || "").trim()) continue;
    if (quote.status !== "sent" && quote.status !== "draft") continue;

    const overdue = due < today;
    const sentDay = (quote.sentAt || quote.createdAt || "").slice(0, 10);
    const waiting = sentDay ? Math.max(0, daysBetween(sentDay, today)) : 0;

    items.push({
      id: `quote-${quote.id}`,
      kind: "quote",
      entityId: quote.id,
      urgency: overdue ? "overdue" : "today",
      urgencyLabel: overdue ? "Overdue" : "Due today",
      title: quote.clientName,
      detail:
        quote.status === "draft"
          ? "Finish and send quote"
          : "Quote follow-up due",
      meta: [
        quote.number || quote.id,
        money(quote.amount),
        due ? `Follow up ${due}` : "",
        waiting ? `${waiting}d waiting` : "",
        quote.requestId ? "From request" : "",
      ]
        .filter(Boolean)
        .join(" · "),
      href: `/work/quotes?id=${encodeURIComponent(quote.id)}`,
      valueLabel: money(quote.amount),
      actionLabel: "Open quote",
    });
  }
  return items;
}

/** Deterministic HQ Today ordering. */
export function prioritizeHqToday(items: HqTodayItem[]): HqTodayItem[] {
  return [...items].sort((a, b) => {
    const ur = urgencyRank(a.urgency) - urgencyRank(b.urgency);
    if (ur !== 0) return ur;
    const time = (a.timeLabel || "99:99").localeCompare(b.timeLabel || "99:99");
    if (time !== 0) return time;
    const av = a.valueLabel || "";
    const bv = b.valueLabel || "";
    if (av !== bv) return bv.localeCompare(av);
    return a.id.localeCompare(b.id);
  });
}

export function buildHqTodaySections(input: {
  requests: IntakeRequest[];
  jobs: Job[];
  quotes: QuoteDoc[];
  today?: string;
}): {
  requests: HqTodayItem[];
  jobs: HqTodayItem[];
  quotes: HqTodayItem[];
  combined: HqTodayItem[];
} {
  const today = input.today ?? todayKey();
  const requests = prioritizeHqToday(buildHqRequestItems(input.requests, today));
  const jobs = buildHqJobItems(input.jobs, today);
  const quotes = prioritizeHqToday(buildHqQuoteItems(input.quotes, today));
  return {
    requests,
    jobs,
    quotes,
    combined: prioritizeHqToday([...requests, ...jobs, ...quotes]),
  };
}

/** Thin exception band — integrity + overdue only. */
export function buildHqExceptions(input: {
  jobs: Job[];
  quotes: QuoteDoc[];
  requests: IntakeRequest[];
  linkFlags?: ClientLinkFlag[];
  cloudStatus?: string;
  today?: string;
}): HqException[] {
  const today = input.today ?? todayKey();
  const out: HqException[] = [];

  for (const job of input.jobs) {
    if (job.status === "cancelled") continue;
    if (
      job.scheduledDate &&
      job.scheduledDate < today &&
      job.status !== "completed"
    ) {
      out.push({
        id: `ex-job-overdue-${job.id}`,
        title: "Overdue job",
        detail: `${job.customerName} · ${job.scheduledDate}`,
        href: `/work/jobs?view=day&date=${encodeURIComponent(job.scheduledDate)}`,
        severity: "critical",
      });
    }
    if (job.scheduledDate === today && !job.address.trim()) {
      out.push({
        id: `ex-job-addr-${job.id}`,
        title: "Job missing address",
        detail: job.customerName || job.title || job.id,
        href: `/work/jobs?view=day&date=${encodeURIComponent(today)}`,
        severity: "warn",
      });
    }
    if (job.scheduledDate === today && !jobClientId(job)) {
      out.push({
        id: `ex-job-client-${job.id}`,
        title: "Job missing client link",
        detail: job.customerName || job.id,
        href: `/work/jobs?view=day&date=${encodeURIComponent(today)}`,
        severity: "warn",
      });
    }
  }

  // Same-day schedule overlaps (simple start/end minute window).
  const todayJobs = input.jobs.filter(
    (j) =>
      j.scheduledDate === today &&
      j.status !== "cancelled" &&
      j.status !== "completed",
  );
  for (let i = 0; i < todayJobs.length; i += 1) {
    for (let j = i + 1; j < todayJobs.length; j += 1) {
      const a = todayJobs[i]!;
      const b = todayJobs[j]!;
      const aStart = timeToMinutes(a.startTime || "09:00");
      const aEnd =
        timeToMinutes(a.endTime || "") ||
        aStart + (a.estimatedDurationMinutes || 60);
      const bStart = timeToMinutes(b.startTime || "09:00");
      const bEnd =
        timeToMinutes(b.endTime || "") ||
        bStart + (b.estimatedDurationMinutes || 60);
      if (aStart < bEnd && bStart < aEnd) {
        out.push({
          id: `ex-conflict-${a.id}-${b.id}`,
          title: "Schedule conflict",
          detail: `${a.customerName || a.title} overlaps ${b.customerName || b.title}`,
          href: `/work/jobs?view=day&date=${encodeURIComponent(today)}`,
          severity: "critical",
        });
      }
    }
  }

  for (const quote of input.quotes) {
    if (quote.status !== "sent") continue;
    if (quote.followUpDate && quote.followUpDate < today) {
      out.push({
        id: `ex-quote-${quote.id}`,
        title: "Overdue quote follow-up",
        detail: `${quote.clientName} · ${quote.number || quote.id}`,
        href: `/work/quotes?id=${encodeURIComponent(quote.id)}`,
        severity: "critical",
      });
    }
  }

  for (const request of input.requests) {
    if (
      request.followUpDate &&
      request.followUpDate < today &&
      request.status !== "declined" &&
      request.status !== "approved"
    ) {
      out.push({
        id: `ex-req-${request.id}`,
        title: "Overdue request follow-up",
        detail: request.customerName,
        href: `/work/requests?id=${encodeURIComponent(request.id)}`,
        severity: "critical",
      });
    }
  }

  const ambiguous = (input.linkFlags || []).filter((f) => f.status === "ambiguous");
  if (ambiguous.length) {
    out.push({
      id: "ex-client-ambiguous",
      title: "Ambiguous client links",
      detail: `${ambiguous.length} record${ambiguous.length === 1 ? "" : "s"} need review`,
      href: "/work/clients",
      severity: "warn",
    });
  }

  if (input.cloudStatus === "error" || input.cloudStatus === "offline" || input.cloudStatus === "local") {
    out.push({
      id: "ex-cloud",
      title:
        input.cloudStatus === "offline"
          ? "Offline"
          : input.cloudStatus === "local"
            ? "Cloud unavailable"
            : "Sync error",
      detail: "Local data is preserved — cloud save may be pending",
      href: "/",
      severity: "warn",
    });
  }

  // Dedupe by id, cap
  const seen = new Set<string>();
  return out.filter((row) => {
    if (seen.has(row.id)) return false;
    seen.add(row.id);
    return true;
  }).slice(0, 8);
}

export type HqWeekGlanceDay = {
  dateKey: string;
  label: string;
  isToday: boolean;
  jobCount: number;
  jobValue: number;
  requestFollowUps: number;
  quoteFollowUps: number;
  hasConflict: boolean;
  hasOverdue: boolean;
};

/**
 * Compact Mon–Sun week glance for HQ (aligned with Scheduled Job Value week).
 */
export function buildHqWeekGlance(input: {
  jobs: Job[];
  quotes: QuoteDoc[];
  requests: IntakeRequest[];
  today?: string;
}): HqWeekGlanceDay[] {
  const today = input.today ?? todayKey();
  const keys = getWeekKeys(today);

  return keys.map((dateKey) => {
    const dayJobs = jobsOnDate(input.jobs, dateKey).filter(
      (j) => j.status !== "cancelled",
    );
    const jobValue = dayJobs.reduce(
      (sum, j) => sum + (Number(j.amount) || 0),
      0,
    );

    let hasConflict = false;
    for (let i = 0; i < dayJobs.length && !hasConflict; i += 1) {
      for (let j = i + 1; j < dayJobs.length; j += 1) {
        const a = dayJobs[i]!;
        const b = dayJobs[j]!;
        if (a.status === "completed" || b.status === "completed") continue;
        const aStart = timeToMinutes(a.startTime || "09:00");
        const aEnd =
          timeToMinutes(a.endTime || "") ||
          aStart + (a.estimatedDurationMinutes || 60);
        const bStart = timeToMinutes(b.startTime || "09:00");
        const bEnd =
          timeToMinutes(b.endTime || "") ||
          bStart + (b.estimatedDurationMinutes || 60);
        if (aStart < bEnd && bStart < aEnd) {
          hasConflict = true;
          break;
        }
      }
    }

    const requestFollowUps = input.requests.filter((r) => {
      if (r.status === "declined" || r.status === "approved") return false;
      return r.followUpDate === dateKey;
    }).length;

    const quoteFollowUps = input.quotes.filter((q) => {
      if (q.status === "won" || q.status === "lost") return false;
      if (q.status !== "sent" && q.status !== "draft") return false;
      return (q.followUpDate || "").trim() === dateKey;
    }).length;

    const hasOverdue =
      dateKey < today &&
      (dayJobs.some((j) => j.status !== "completed") ||
        input.quotes.some(
          (q) =>
            q.status === "sent" &&
            q.followUpDate &&
            q.followUpDate === dateKey,
        ) ||
        input.requests.some(
          (r) =>
            r.followUpDate === dateKey &&
            r.status !== "declined" &&
            r.status !== "approved",
        ));

    return {
      dateKey,
      label: new Date(`${dateKey}T12:00:00`).toLocaleDateString(undefined, {
        weekday: "short",
        month: "numeric",
        day: "numeric",
      }),
      isToday: dateKey === today,
      jobCount: dayJobs.length,
      jobValue,
      requestFollowUps,
      quoteFollowUps,
      hasConflict,
      hasOverdue,
    };
  });
}
