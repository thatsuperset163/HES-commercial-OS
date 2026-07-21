import { todayKey } from "../dates.ts";
import type { Job } from "../jobs/types.ts";
import type { BoardStore } from "../types.ts";
import { WORK_DESKS } from "./catalog.ts";
import type {
  ExpenseDoc,
  InvoiceDoc,
  QuoteDoc,
  ServiceRequest,
  WorkClient,
  WorkDeskId,
  WorkTask,
} from "./types.ts";

export type PipelineCount = {
  id: WorkDeskId;
  label: string;
  href: string;
  count: number;
  attention: number;
};

export type PipelineAction = {
  id: string;
  deskId: WorkDeskId;
  title: string;
  reason: string;
  href: string;
  urgency: "overdue" | "today" | "money" | "soon";
};

function moneyOpen(invoices: InvoiceDoc[]): number {
  return invoices.filter(
    (row) =>
      row.status === "sent" ||
      row.status === "overdue" ||
      row.status === "draft" ||
      row.status === "partial",
  ).length;
}

export function buildPipelineCounts(store: BoardStore): PipelineCount[] {
  const jobs = store.jobs ?? [];
  const clients = store.clients ?? [];
  const requests = store.requests ?? [];
  const quotes = store.quotes ?? [];
  const invoices = store.invoices ?? [];
  const tasks = store.tasks ?? [];
  const expenses = store.expenses ?? [];
  const today = todayKey();

  const attention: Record<WorkDeskId, number> = {
    requests: requests.filter((r) => r.status === "new" || r.status === "contacted").length,
    clients: clients.filter((c) => c.status === "active").length,
    quotes: quotes.filter((q) => q.status === "draft" || q.status === "sent").length,
    jobs: jobs.filter(
      (j) =>
        (j.status === "completed" &&
          j.invoiceStatus !== "sent" &&
          j.invoiceStatus !== "paid") ||
        ((j.status === "scheduled" ||
          j.status === "confirmed" ||
          j.status === "en_route" ||
          j.status === "in_progress") &&
          j.scheduledDate <= today),
    ).length,
    invoices: moneyOpen(invoices),
    tasks: tasks.filter((t) => t.status === "open").length,
    expenses: expenses.filter((e) => e.status === "logged").length,
  };

  const totals: Record<WorkDeskId, number> = {
    requests: requests.length,
    clients: clients.length,
    quotes: quotes.length,
    jobs: jobs.filter((j) => j.status !== "cancelled").length,
    invoices: invoices.length,
    tasks: tasks.length,
    expenses: expenses.length,
  };

  return WORK_DESKS.map((desk) => ({
    id: desk.id,
    label: desk.hqLabel,
    href: desk.href,
    count: totals[desk.id],
    attention: attention[desk.id],
  }));
}

export function buildPipelineNextActions(store: BoardStore): PipelineAction[] {
  const actions: PipelineAction[] = [];
  const today = todayKey();

  for (const row of store.requests ?? []) {
    if (row.status === "new") {
      actions.push({
        id: `req-${row.id}`,
        deskId: "requests",
        title: `Respond to ${row.clientName}`,
        reason: row.summary,
        href: "/work/requests",
        urgency: "today",
      });
    }
  }

  for (const row of store.quotes ?? []) {
    if (row.status === "draft") {
      actions.push({
        id: `quote-draft-${row.id}`,
        deskId: "quotes",
        title: `Finish quote for ${row.clientName}`,
        reason: row.scope,
        href: "/work/quotes",
        urgency: "soon",
      });
    } else if (row.status === "sent" && row.followUpDate <= today) {
      actions.push({
        id: `quote-follow-${row.id}`,
        deskId: "quotes",
        title: `Follow up quote · ${row.clientName}`,
        reason: "Sent quote waiting on an answer",
        href: "/work/quotes",
        urgency: row.followUpDate < today ? "overdue" : "today",
      });
    }
  }

  for (const row of store.jobs ?? []) {
    if (
      row.status === "completed" &&
      row.invoiceStatus !== "sent" &&
      row.invoiceStatus !== "paid"
    ) {
      actions.push({
        id: `job-bill-${row.id}`,
        deskId: "invoices",
        title: `Invoice ${row.customerName}`,
        reason: "Job complete — turn it into an invoice",
        href: "/work/invoices",
        urgency: "money",
      });
    } else if (
      (row.status === "scheduled" ||
        row.status === "confirmed" ||
        row.status === "en_route" ||
        row.status === "in_progress") &&
      row.scheduledDate &&
      row.scheduledDate < today
    ) {
      actions.push({
        id: `job-overdue-${row.id}`,
        deskId: "jobs",
        title: `Overdue job · ${row.customerName}`,
        reason: "Scheduled date passed",
        href: "/work/jobs",
        urgency: "overdue",
      });
    } else if (
      (row.status === "scheduled" || row.status === "confirmed") &&
      row.scheduledDate === today
    ) {
      actions.push({
        id: `job-today-${row.id}`,
        deskId: "jobs",
        title: `Run job · ${row.customerName}`,
        reason: row.service || "On today's schedule",
        href: "/work/jobs",
        urgency: "today",
      });
    }
  }

  for (const row of store.invoices ?? []) {
    if (row.status === "draft") {
      actions.push({
        id: `inv-draft-${row.id}`,
        deskId: "invoices",
        title: `Send invoice · ${row.clientName}`,
        reason: row.jobLabel,
        href: "/work/invoices",
        urgency: "money",
      });
    } else if (row.status === "sent" || row.status === "overdue") {
      actions.push({
        id: `inv-pay-${row.id}`,
        deskId: "invoices",
        title: `Collect payment · ${row.clientName}`,
        reason: row.status === "overdue" ? "Past due" : "Waiting on payment",
        href: "/work/invoices",
        urgency: row.status === "overdue" || row.dueDate < today ? "overdue" : "money",
      });
    }
  }

  for (const row of store.tasks ?? []) {
    if (row.status === "open" && row.dueDate <= today) {
      actions.push({
        id: `task-${row.id}`,
        deskId: "tasks",
        title: row.title,
        reason: row.dueDate < today ? "Overdue task" : "Due today",
        href: "/work/tasks",
        urgency: row.dueDate < today ? "overdue" : "today",
      });
    }
  }

  const rank = { overdue: 0, money: 1, today: 2, soon: 3 } as const;
  return actions.sort((a, b) => rank[a.urgency] - rank[b.urgency]).slice(0, 8);
}

export type DeskLists = {
  clients: WorkClient[];
  requests: ServiceRequest[];
  tasks: WorkTask[];
  quotes: QuoteDoc[];
  jobs: Job[];
  invoices: InvoiceDoc[];
  expenses: ExpenseDoc[];
};
