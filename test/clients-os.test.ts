import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildClientNextAction } from "../lib/clients/nextAction.ts";
import type { ClientRelated, ClientSummary } from "../lib/clients/related.ts";
import { buildWeekJobValue } from "../lib/clients/weekValue.ts";
import type { Job } from "../lib/jobs/types.ts";
import type { InvoiceDoc } from "../lib/work/types.ts";

function job(partial: Partial<Job> & { id: string }): Job {
  return {
    id: partial.id,
    customerId: partial.customerId ?? null,
    requestId: partial.requestId ?? null,
    prospectId: partial.prospectId ?? null,
    quoteId: partial.quoteId ?? null,
    customerName: partial.customerName ?? "Client",
    companyName: partial.companyName ?? "",
    contactName: partial.contactName ?? "",
    phone: partial.phone ?? "",
    email: partial.email ?? "",
    address: partial.address ?? "",
    service: partial.service ?? "Wash",
    title: partial.title ?? "Job",
    description: partial.description ?? "",
    scheduledDate: partial.scheduledDate ?? "",
    startTime: partial.startTime ?? "",
    endTime: partial.endTime ?? "",
    estimatedDurationMinutes: partial.estimatedDurationMinutes ?? 60,
    amount: partial.amount ?? 0,
    assignedTo: partial.assignedTo ?? "",
    status: partial.status ?? "scheduled",
    priority: partial.priority ?? "normal",
    notes: partial.notes ?? "",
    customerNotes: partial.customerNotes ?? "",
    equipmentNeeded: partial.equipmentNeeded ?? "",
    invoiceStatus: partial.invoiceStatus ?? "none",
    paymentStatus: partial.paymentStatus ?? "unpaid",
    recurringRule: partial.recurringRule ?? "",
    createdAt: partial.createdAt ?? "",
    updatedAt: partial.updatedAt ?? "",
  };
}

function invoice(partial: Partial<InvoiceDoc> & { id: string }): InvoiceDoc {
  return {
    id: partial.id,
    number: partial.number ?? `INV-${partial.id}`,
    clientName: partial.clientName ?? "Client",
    companyName: partial.companyName ?? "",
    clientId: partial.clientId ?? "",
    billingAddress: partial.billingAddress ?? "",
    serviceAddress: partial.serviceAddress ?? "",
    jobLabel: partial.jobLabel ?? "Roof clean",
    jobId: partial.jobId ?? "",
    quoteId: partial.quoteId ?? "",
    requestId: partial.requestId ?? "",
    lineItems: partial.lineItems ?? [],
    amount: partial.amount ?? 200,
    discount: partial.discount ?? 0,
    taxRate: partial.taxRate ?? 0,
    payments: partial.payments ?? [],
    status: partial.status ?? "overdue",
    issueDate: partial.issueDate ?? "2026-06-01",
    dueDate: partial.dueDate ?? "2026-07-01",
    paymentTerms: partial.paymentTerms ?? "",
    notes: partial.notes ?? "",
    createdAt: partial.createdAt ?? "",
    updatedAt: partial.updatedAt ?? "",
  };
}

describe("week job value KPI", () => {
  it("sums scheduled amounts for the week and ignores cancelled", () => {
    // Week of 2026-07-20 is Mon 2026-07-20 … Sun 2026-07-26
    const jobs = [
      job({
        id: "1",
        amount: 1000,
        scheduledDate: "2026-07-21",
        status: "scheduled",
      }),
      job({
        id: "2",
        amount: 500,
        scheduledDate: "2026-07-22",
        status: "completed",
      }),
      job({
        id: "3",
        amount: 999,
        scheduledDate: "2026-07-22",
        status: "cancelled",
      }),
      job({
        id: "4",
        amount: 200,
        scheduledDate: "2026-07-10",
        status: "scheduled",
      }),
    ];
    const v = buildWeekJobValue(jobs, "2026-07-20");
    assert.equal(v.scheduledValue, 1500);
    assert.equal(v.scheduledCount, 2);
    assert.equal(v.completedValue, 500);
    assert.equal(v.averageJobValue, 750);
  });

  it("computes percent change vs prior week", () => {
    const jobs = [
      job({ id: "a", amount: 1000, scheduledDate: "2026-07-21" }),
      job({ id: "b", amount: 500, scheduledDate: "2026-07-14" }),
    ];
    const v = buildWeekJobValue(jobs, "2026-07-20");
    assert.equal(v.priorScheduledValue, 500);
    assert.equal(v.scheduledChangePct, 100);
  });
});

describe("client next action", () => {
  const emptyRelated: ClientRelated = {
    requests: [],
    quotes: [],
    jobs: [],
    invoices: [],
    tasks: [],
    expenses: [],
    legacy: {
      requests: [],
      quotes: [],
      jobs: [],
      invoices: [],
      tasks: [],
    },
  };
  const emptySummary: ClientSummary = {
    nextActivity: null,
    openQuoteValue: 0,
    outstandingBalance: 0,
    completedJobs: 0,
    lifetimeRevenue: 0,
  };

  it("prioritizes overdue invoices", () => {
    const action = buildClientNextAction(
      {
        ...emptyRelated,
        invoices: [invoice({ id: "i1", status: "overdue" })],
      },
      emptySummary,
      "2026-07-20",
    );
    assert.equal(action.title, "Collect unpaid invoice");
    assert.equal(action.urgency, "overdue");
  });

  it("falls back to clear when nothing is pending", () => {
    const action = buildClientNextAction(emptyRelated, emptySummary);
    assert.equal(action.title, "No action needed");
    assert.equal(action.urgency, "clear");
  });
});
