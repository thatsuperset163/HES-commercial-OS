import { todayKey } from "../dates.ts";
import type { Job } from "../jobs/types.ts";
import type {
  ExpenseDoc,
  InvoiceDoc,
  QuoteDoc,
  ServiceRequest,
  WorkClient,
  WorkTask,
} from "../work/types.ts";
import { jobClientId } from "./resolver.ts";

export type ClientRelated = {
  requests: ServiceRequest[];
  quotes: QuoteDoc[];
  jobs: Job[];
  invoices: InvoiceDoc[];
  tasks: WorkTask[];
  expenses: ExpenseDoc[];
  /** Name-only matches for records that still lack clientId (legacy). */
  legacy: {
    requests: ServiceRequest[];
    quotes: QuoteDoc[];
    jobs: Job[];
    invoices: InvoiceDoc[];
    tasks: WorkTask[];
  };
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
  legacy?: boolean;
};

function nameMatch(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

function mentions(text: string, name: string): boolean {
  const n = name.trim().toLowerCase();
  if (!n || n.length < 2) return false;
  return text.toLowerCase().includes(n);
}

/**
 * Gather related Work records by stable clientId.
 * Legacy name matches are returned separately and never mixed into id results.
 */
export function gatherClientRelated(
  client: WorkClient,
  input: {
    requests: ServiceRequest[];
    quotes: QuoteDoc[];
    jobs: Job[];
    invoices: InvoiceDoc[];
    tasks: WorkTask[];
    expenses?: ExpenseDoc[];
  },
): ClientRelated {
  const name = client.name;
  const company = client.companyName;

  const requestsById = input.requests.filter(
    (r) => (r.clientId || "").trim() === client.id,
  );
  const quotesById = input.quotes.filter(
    (q) => (q.clientId || "").trim() === client.id,
  );
  const jobsById = input.jobs.filter((j) => jobClientId(j) === client.id);
  const invoicesById = input.invoices.filter(
    (i) => (i.clientId || "").trim() === client.id,
  );
  const tasksById = input.tasks.filter(
    (t) => (t.clientId || "").trim() === client.id,
  );
  const expensesById = (input.expenses || []).filter(
    (e) => (e.clientId || "").trim() === client.id,
  );

  const requestIds = new Set(requestsById.map((r) => r.id));
  const quoteIds = new Set(quotesById.map((q) => q.id));
  const jobIds = new Set(jobsById.map((j) => j.id));
  const invoiceIds = new Set(invoicesById.map((i) => i.id));
  const taskIds = new Set(tasksById.map((t) => t.id));

  return {
    requests: requestsById,
    quotes: quotesById,
    jobs: jobsById,
    invoices: invoicesById,
    tasks: tasksById,
    expenses: expensesById,
    legacy: {
      requests: input.requests.filter(
        (r) =>
          !requestIds.has(r.id) &&
          !(r.clientId || "").trim() &&
          nameMatch(r.clientName, name),
      ),
      quotes: input.quotes.filter(
        (q) =>
          !quoteIds.has(q.id) &&
          !(q.clientId || "").trim() &&
          nameMatch(q.clientName, name),
      ),
      jobs: input.jobs.filter(
        (j) =>
          !jobIds.has(j.id) &&
          !jobClientId(j) &&
          (nameMatch(j.customerName, name) ||
            (company && nameMatch(j.companyName || "", company))),
      ),
      invoices: input.invoices.filter(
        (i) =>
          !invoiceIds.has(i.id) &&
          !(i.clientId || "").trim() &&
          nameMatch(i.clientName, name),
      ),
      tasks: input.tasks.filter(
        (t) =>
          !taskIds.has(t.id) &&
          !(t.clientId || "").trim() &&
          (mentions(t.title, name) || mentions(t.notes, name)),
      ),
    },
  };
}

/** All related rows for summaries — id-linked first, then legacy. */
export function flattenClientRelated(related: ClientRelated): {
  requests: ServiceRequest[];
  quotes: QuoteDoc[];
  jobs: Job[];
  invoices: InvoiceDoc[];
  tasks: WorkTask[];
  expenses: ExpenseDoc[];
} {
  return {
    requests: [...related.requests, ...related.legacy.requests],
    quotes: [...related.quotes, ...related.legacy.quotes],
    jobs: [...related.jobs, ...related.legacy.jobs],
    invoices: [...related.invoices, ...related.legacy.invoices],
    tasks: [...related.tasks, ...related.legacy.tasks],
    expenses: related.expenses,
  };
}

export function buildClientSummary(
  related: ClientRelated,
  today = todayKey(),
): ClientSummary {
  const flat = flattenClientRelated(related);
  const openQuotes = flat.quotes.filter(
    (q) => q.status === "draft" || q.status === "sent",
  );
  const openInvoices = flat.invoices.filter(
    (i) => i.status === "draft" || i.status === "sent" || i.status === "overdue",
  );
  const completed = flat.jobs.filter((j) => j.status === "completed");
  const paid = flat.invoices.filter((i) => i.status === "paid");

  const upcomingJobs = flat.jobs
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
  for (const r of related.legacy.requests) {
    items.push({
      id: `req-legacy-${r.id}`,
      label: "Request (legacy)",
      detail: r.summary || r.status,
      at: r.createdAt || r.updatedAt,
      href: "/work/requests",
      legacy: true,
    });
  }
  for (const q of related.quotes) {
    items.push({
      id: `quote-${q.id}`,
      label: q.status === "sent" ? "Quote sent" : "Quote",
      detail: q.scope || q.status,
      at: q.updatedAt || q.createdAt,
      href: `/work/quotes?id=${encodeURIComponent(q.id)}`,
    });
  }
  for (const q of related.legacy.quotes) {
    items.push({
      id: `quote-legacy-${q.id}`,
      label: "Quote (legacy)",
      detail: q.scope || q.status,
      at: q.updatedAt || q.createdAt,
      href: `/work/quotes?id=${encodeURIComponent(q.id)}`,
      legacy: true,
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
  for (const j of related.legacy.jobs) {
    items.push({
      id: `job-legacy-${j.id}`,
      label: "Job (legacy)",
      detail: j.service || j.title || j.status,
      at: j.updatedAt || j.createdAt || `${j.scheduledDate || ""}T12:00:00`,
      href: "/work/jobs",
      legacy: true,
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
      href: `/work/invoices?id=${encodeURIComponent(i.id)}`,
    });
  }
  for (const i of related.legacy.invoices) {
    items.push({
      id: `inv-legacy-${i.id}`,
      label: "Invoice (legacy)",
      detail: i.jobLabel || i.status,
      at: i.updatedAt || i.createdAt,
      href: `/work/invoices?id=${encodeURIComponent(i.id)}`,
      legacy: true,
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
  for (const t of related.legacy.tasks) {
    items.push({
      id: `task-legacy-${t.id}`,
      label: "Task (legacy)",
      detail: t.title,
      at: t.updatedAt || t.createdAt,
      href: "/work/tasks",
      legacy: true,
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
  const flat = flattenClientRelated(related);
  return {
    upcoming: flat.jobs.some(
      (j) =>
        j.scheduledDate &&
        j.scheduledDate >= today &&
        j.status !== "cancelled" &&
        j.status !== "completed",
    ),
    unpaid: flat.invoices.some(
      (i) =>
        i.status === "overdue" ||
        i.status === "sent" ||
        (i.status === "draft" && (i.amount ?? 0) > 0),
    ),
    followUp: flat.quotes.some(
      (q) => q.status === "sent" && q.followUpDate <= today,
    ),
  };
}

export function moneyLabel(value: number): string {
  if (!value) return "$0";
  return `$${Math.round(value).toLocaleString("en-US")}`;
}

/** Intake requests that intentionally reference this Work client. */
export function intakeBelongsToClient(
  intake: {
    linkedClientId?: string | null;
    convertedClientId?: string | null;
  },
  clientId: string,
): boolean {
  const id = clientId.trim();
  if (!id) return false;
  return intake.linkedClientId === id || intake.convertedClientId === id;
}
