import assert from "node:assert/strict";
import test from "node:test";
import { createJob } from "../lib/jobs/model.ts";
import {
  applyJobAutomation,
  applyQuoteAutomation,
  ensureInvoiceForCompletedJob,
} from "../lib/work/automations.ts";
import { createQuote } from "../lib/work/model.ts";
import type { BoardStore } from "../lib/types.ts";

function empty(): BoardStore {
  return {
    days: {},
    jobs: [],
    clients: [],
    requests: [],
    tasks: [],
    quotes: [],
    invoices: [],
    expenses: [],
  };
}

test("job marked done auto-creates invoice draft + send task", () => {
  const job = createJob({
    customerName: "Amy",
    service: "House wash",
    scheduledDate: "2026-07-18",
    amount: 300,
  });
  job.status = "done";
  const next = ensureInvoiceForCompletedJob(empty(), job);
  assert.equal(next.invoices.length, 1);
  assert.equal(next.invoices[0]?.status, "draft");
  assert.equal(next.invoices[0]?.amount, 300);
  assert.match(next.invoices[0]?.notes ?? "", /job:/);
  assert.ok(next.tasks.some((task) => task.title.includes("Send invoice")));
});

test("job automation is idempotent for invoices", () => {
  const job = createJob({
    customerName: "Amy",
    service: "House wash",
    scheduledDate: "2026-07-18",
  });
  const scheduled = { ...job, status: "scheduled" as const };
  const done = { ...job, status: "done" as const };
  const once = applyJobAutomation(empty(), scheduled, done);
  const twice = applyJobAutomation(once, done, done);
  assert.equal(twice.invoices.length, 1);
});

test("won quote auto-creates a job", () => {
  const quote = createQuote({
    clientName: "Plaza LLC",
    scope: "Storefront",
    amount: 900,
    followUpDate: "2026-07-20",
  });
  quote.status = "won";
  const draft = { ...quote, status: "sent" as const };
  const next = applyQuoteAutomation(empty(), draft, quote);
  assert.equal(next.jobs.length, 1);
  assert.equal(next.jobs[0]?.customerName, "Plaza LLC");
  assert.match(next.jobs[0]?.notes ?? "", /quote:/);
});
