import { todayKey } from "../dates.ts";
import type { Job } from "../jobs/types.ts";
import type {
  InvoiceDoc,
  QuoteDoc,
  ServiceRequest,
  WorkClient,
  WorkTask,
} from "../work/types.ts";

export type ClientRelated = {
  requests: ServiceRequest[];
  quotes: QuoteDoc[];
  jobs: Job[];
  invoices: InvoiceDoc[];
  tasks: WorkTask[];
};

export type ClientSummary = {
  nextActivity: string | null;
  openQuoteValue: number;
  outstandingBalance: number;
  completedJobs: number;
  lifetimeRevenue: number;
};

export type ClientActivityItem = {
  id: string;
  label: string;
  detail: string;
  at: string;
  href: string;
};

function nameMatch(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

function mentions(text: string, name: string): boolean {
  const n = name.trim().toLowerCase();
  if (!n || n.length < 2) return false;
  return text.toLowerCase().includes(n);
}

/** Gather related records using id (jobs) or clientName string match. */
export function gatherClientRelated(
  client: WorkClient,
  input: {
    requests: ServiceRequest[];
    quotes: QuoteDoc[];
    jobs: Job[];
    invoices: InvoiceDoc[];
    tasks: WorkTask[];
  },
): ClientRelated {
  const name = client.name;
  return {
    requests: input.requests.filter((r) => nameMatch(r.clientName, name)),
    quotes: input.quotes.filter((q) => {
      if (q.clientId && q.clientId === client.id) return true;
      // Legacy fallback — name only when no clientId is stored.
      if (!q.clientId) return nameMatch(q.clientName, name);
      return false;
    }),
    jobs: input.jobs.filter(
      (j) =>
        j.customerId === client.id ||
        nameMatch(j.customerName, name) ||
        nameMatch(j.companyName || "", name),
    ),
    invoices: input.invoices.filter((i) => {
      if (i.clientId && i.clientId === client.id) return true;
      if (!i.clientId) return nameMatch(i.clientName, name);
      return false;
    }),
    tasks: input.tasks.filter(
      (t) => mentions(t.title, name) || mentions(t.notes, name),
    ),
  };
}

export function buildClientSummary(
  related: ClientRelated,
  today = todayKey(),
): ClientSummary {
  const openQuotes = related.quotes.filter(
    (q) => q.status === "draft" || q.status === "sent",
  );
  const openInvoices = related.invoices.filter(
    (i) => i.status === "draft" || i.status === "sent" || i.status === "overdue",
  );
  const completed = related.jobs.filter((j) => j.status === "completed");
  const paid = related.invoices.filter((i) => i.status === "paid");

  const upcomingJobs = related.jobs
    .filter(
      (j) =>
        j.scheduledDate &&
        j.scheduledDate >= today &&
        j.status !== "cancelled" &&
        j.status !== "completed",
    )
    .sort((a, b) =>
      `${a.scheduledDate}${a.startTime}`.localeCompare(
        `${b.scheduledDate}${b.startTime}`,
      ),
    );

  let nextActivity: string | null = null;
  if (upcomingJobs[0]) {
    const j = upcomingJobs[0];
    nextActivity = `${j.scheduledDate}${j.startTime ? ` · ${j.startTime}` : ""} · ${j.service || j.title || "Job"}`;
  } else {
    const follow = openQuotes
      .filter((q) => q.followUpDate)
      .sort((a, b) => a.followUpDate.localeCompare(b.followUpDate))[0];
    if (follow) nextActivity = `Quote follow-up ${follow.followUpDate}`;
  }

  return {
    nextActivity,
    openQuoteValue: openQuotes.reduce((s, q) => s + (q.amount ?? 0), 0),
    outstandingBalance: openInvoices.reduce((s, i) => s + (i.amount ?? 0), 0),
    completedJobs: completed.length,
    lifetimeRevenue: paid.reduce((s, i) => s + (i.amount ?? 0), 0),
  };
}

export function buildClientActivity(
  related: ClientRelated,
  limit = 12,
): ClientActivityItem[] {
  const items: ClientActivityItem[] = [];

  for (const r of related.requests) {
    items.push({
      id: `req-${r.id}`,
      label: "Request",
      detail: r.summary || r.status,
      at: r.createdAt || r.updatedAt,
      href: "/work/requests",
    });
  }
  for (const q of related.quotes) {
    items.push({
      id: `quote-${q.id}`,
      label: q.status === "sent" ? "Quote sent" : "Quote",
      detail: q.scope || q.status,
      at: q.updatedAt || q.createdAt,
      href: "/work/quotes",
    });
  }
  for (const j of related.jobs) {
    items.push({
      id: `job-${j.id}`,
      label:
        j.status === "completed"
          ? "Job completed"
          : j.scheduledDate
            ? "Job scheduled"
            : "Job",
      detail: j.service || j.title || j.status,
      at: j.updatedAt || j.createdAt || `${j.scheduledDate || ""}T12:00:00`,
      href: j.scheduledDate
        ? `/work/jobs?view=day&date=${encodeURIComponent(j.scheduledDate)}`
        : "/work/jobs",
    });
  }
  for (const i of related.invoices) {
    items.push({
      id: `inv-${i.id}`,
      label:
        i.status === "paid"
          ? "Payment recorded"
          : i.status === "sent" || i.status === "overdue"
            ? "Invoice sent"
            : "Invoice",
      detail: [
        i.jobLabel,
        i.amount != null ? `$${Math.round(i.amount).toLocaleString()}` : null,
      ]
        .filter(Boolean)
        .join(" · "),
      at: i.updatedAt || i.createdAt,
      href: "/work/invoices",
    });
  }
  for (const t of related.tasks) {
    items.push({
      id: `task-${t.id}`,
      label: "Task",
      detail: t.title,
      at: t.updatedAt || t.createdAt,
      href: "/work/tasks",
    });
  }

  return items
    .filter((i) => i.at)
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, limit);
}

export type ClientRowSignals = {
  upcoming: boolean;
  unpaid: boolean;
  followUp: boolean;
};

export function buildClientRowSignals(
  related: ClientRelated,
  today = todayKey(),
): ClientRowSignals {
  return {
    upcoming: related.jobs.some(
      (j) =>
        j.scheduledDate &&
        j.scheduledDate >= today &&
        j.status !== "cancelled" &&
        j.status !== "completed",
    ),
    unpaid: related.invoices.some(
      (i) =>
        i.status === "overdue" ||
        i.status === "sent" ||
        (i.status === "draft" && (i.amount ?? 0) > 0),
    ),
    followUp: related.quotes.some(
      (q) => q.status === "sent" && q.followUpDate <= today,
    ),
  };
}

export function moneyLabel(value: number): string {
  if (!value) return "$0";
  return `$${Math.round(value).toLocaleString("en-US")}`;
}
