import { todayKey } from "../dates.ts";
import type { Job } from "../jobs/types.ts";
import type { BoardStore } from "../types.ts";
import { createInvoice, createTask } from "./model.ts";
import type { InvoiceDoc, QuoteDoc, WorkTask } from "./types.ts";
import { createJob } from "../jobs/model.ts";

function hasAutoMarker(notes: string, marker: string): boolean {
  return notes.includes(marker);
}

function findInvoiceForJob(invoices: InvoiceDoc[], job: Job): InvoiceDoc | undefined {
  const marker = `job:${job.id}`;
  return invoices.find(
    (inv) =>
      hasAutoMarker(inv.notes, marker) ||
      (inv.clientName === job.customerName &&
        inv.jobLabel === job.service &&
        inv.status !== "paid"),
  );
}

function findOpenTask(tasks: WorkTask[], marker: string): WorkTask | undefined {
  return tasks.find(
    (task) => task.status === "open" && hasAutoMarker(task.notes, marker),
  );
}

/** When a job becomes done, draft an invoice + send-invoice task. */
export function ensureInvoiceForCompletedJob(
  store: BoardStore,
  job: Job,
): BoardStore {
  if (job.status !== "done") return store;
  const invoices = store.invoices ?? [];
  if (findInvoiceForJob(invoices, job)) return store;

  const marker = `job:${job.id}`;
  const invoice = createInvoice({
    clientName: job.customerName,
    jobLabel: job.service,
    amount: job.amount,
    dueDate: todayKey(),
    notes: `Auto-created when job marked done · ${marker}`,
  });

  let tasks = store.tasks ?? [];
  const taskMarker = `auto:send-invoice:${job.id}`;
  if (!findOpenTask(tasks, taskMarker)) {
    const task = createTask({
      title: `Send invoice · ${job.customerName}`,
      dueDate: todayKey(),
      notes: `${taskMarker} · Invoice ${invoice.id}`,
    });
    tasks = [task, ...tasks];
  }

  return {
    ...store,
    invoices: [invoice, ...invoices],
    tasks,
  };
}

/** When a job is marked invoiced, push matching draft invoice to sent. */
export function markInvoiceSentForJob(store: BoardStore, job: Job): BoardStore {
  if (job.status !== "invoiced") return store;
  const invoices = store.invoices ?? [];
  const match = findInvoiceForJob(invoices, job);
  if (!match || match.status === "paid" || match.status === "sent") return store;
  return {
    ...store,
    invoices: invoices.map((inv) =>
      inv.id === match.id
        ? { ...inv, status: "sent", updatedAt: new Date().toISOString() }
        : inv,
    ),
  };
}

/** Won quote → scheduled job + follow-up task (once). */
export function ensureJobForWonQuote(
  store: BoardStore,
  quote: QuoteDoc,
): BoardStore {
  if (quote.status !== "won") return store;
  const marker = `quote:${quote.id}`;
  const jobs = store.jobs ?? [];
  if (jobs.some((job) => hasAutoMarker(job.notes, marker))) return store;

  const job = createJob({
    customerName: quote.clientName,
    address: quote.address,
    service: quote.scope,
    scheduledDate: quote.followUpDate || todayKey(),
    amount: quote.amount,
    notes: `Auto from won quote · ${marker}`,
  });

  let tasks = store.tasks ?? [];
  const taskMarker = `auto:quote-won:${quote.id}`;
  if (!findOpenTask(tasks, taskMarker)) {
    tasks = [
      createTask({
        title: `Schedule / run job · ${quote.clientName}`,
        dueDate: job.scheduledDate,
        notes: `${taskMarker} · Job ${job.id}`,
      }),
      ...tasks,
    ];
  }

  return {
    ...store,
    jobs: [job, ...jobs],
    tasks,
  };
}

/** Nag tasks for stuck money / overdue scheduled work. */
export function ensurePipelineNagTasks(store: BoardStore): BoardStore {
  const today = todayKey();
  let tasks = [...(store.tasks ?? [])];
  let changed = false;

  const addOnce = (marker: string, title: string, dueDate: string) => {
    if (findOpenTask(tasks, marker)) return;
    tasks = [
      createTask({
        title,
        dueDate,
        notes: marker,
      }),
      ...tasks,
    ];
    changed = true;
  };

  for (const job of store.jobs ?? []) {
    if (job.status === "done") {
      addOnce(
        `auto:nag-bill:${job.id}`,
        `Bill ${job.customerName}`,
        today,
      );
    } else if (job.status === "scheduled" && job.scheduledDate < today) {
      addOnce(
        `auto:nag-job:${job.id}`,
        `Overdue job · ${job.customerName}`,
        today,
      );
    }
  }

  for (const inv of store.invoices ?? []) {
    if (inv.status === "draft") {
      addOnce(
        `auto:nag-send-inv:${inv.id}`,
        `Send invoice · ${inv.clientName}`,
        today,
      );
    } else if (
      (inv.status === "sent" || inv.status === "overdue") &&
      inv.dueDate < today
    ) {
      addOnce(
        `auto:nag-collect:${inv.id}`,
        `Collect payment · ${inv.clientName}`,
        today,
      );
    }
  }

  for (const quote of store.quotes ?? []) {
    if (quote.status === "sent" && quote.followUpDate < today) {
      addOnce(
        `auto:nag-quote:${quote.id}`,
        `Follow up quote · ${quote.clientName}`,
        today,
      );
    }
  }

  return changed ? { ...store, tasks } : store;
}

export function applyJobAutomation(
  store: BoardStore,
  previous: Job | null | undefined,
  job: Job,
): BoardStore {
  let next = store;
  if (job.status === "done" && previous?.status !== "done") {
    next = ensureInvoiceForCompletedJob(next, job);
  }
  if (job.status === "invoiced" && previous?.status !== "invoiced") {
    next = markInvoiceSentForJob(next, job);
  }
  return ensurePipelineNagTasks(next);
}

export function applyQuoteAutomation(
  store: BoardStore,
  previous: QuoteDoc | null | undefined,
  quote: QuoteDoc,
): BoardStore {
  let next = store;
  if (quote.status === "won" && previous?.status !== "won") {
    next = ensureJobForWonQuote(next, quote);
  }
  return ensurePipelineNagTasks(next);
}
