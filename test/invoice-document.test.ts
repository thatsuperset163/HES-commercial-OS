import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildInvoiceTotals,
  createLineItem,
  createPayment,
  deriveInvoiceStatus,
  nextInvoiceNumber,
} from "../lib/invoices/model.ts";
import { createInvoice, normalizeInvoices } from "../lib/work/model.ts";
import type { InvoiceDoc } from "../lib/work/types.ts";

describe("invoice document model", () => {
  it("preserves legacy invoices through normalize", () => {
    const [row] = normalizeInvoices([
      {
        id: "inv-old",
        clientName: "Amy",
        jobLabel: "Wash",
        amount: 500,
        status: "sent",
        dueDate: "2026-07-01",
        notes: "",
        createdAt: "2026-06-01T00:00:00.000Z",
        updatedAt: "2026-06-01T00:00:00.000Z",
      },
    ]);
    assert.equal(row?.clientName, "Amy");
    assert.equal(row?.amount, 500);
    assert.equal(row?.lineItems.length, 0);
    assert.equal(row?.payments.length, 0);
    assert.ok(row?.number);
  });

  it("totals line items with discount and tax", () => {
    const invoice = createInvoice({
      clientName: "Bob",
      lineItems: [
        createLineItem({ description: "Pressure wash", quantity: 1, rate: 1000 }),
        createLineItem({ description: "Windows", quantity: 2, rate: 100 }),
      ],
      discount: 100,
      taxRate: 10,
    });
    const totals = buildInvoiceTotals(invoice);
    assert.equal(totals.subtotal, 1200);
    assert.equal(totals.discount, 100);
    assert.equal(totals.tax, 110);
    assert.equal(totals.total, 1210);
  });

  it("derives paid and partial from payments", () => {
    const base = createInvoice({
      clientName: "Amy",
      amount: 500,
      status: "sent",
      dueDate: "2026-08-01",
    });
    const partial: InvoiceDoc = {
      ...base,
      payments: [createPayment({ amount: 200, date: "2026-07-21" })],
    };
    assert.equal(deriveInvoiceStatus(partial, "2026-07-21"), "partial");

    const paid: InvoiceDoc = {
      ...base,
      payments: [createPayment({ amount: 500, date: "2026-07-21" })],
    };
    assert.equal(deriveInvoiceStatus(paid, "2026-07-21"), "paid");
  });

  it("marks overdue when past due with balance", () => {
    const invoice = createInvoice({
      clientName: "Amy",
      amount: 500,
      status: "sent",
      dueDate: "2026-07-01",
    });
    assert.equal(deriveInvoiceStatus(invoice, "2026-07-21"), "overdue");
  });

  it("increments human invoice numbers by year", () => {
    const existing = [
      createInvoice({ clientName: "A", number: "INV-2026-0003" }),
      createInvoice({ clientName: "B", number: "INV-2026-0001" }),
    ];
    assert.equal(nextInvoiceNumber(existing, 2026), "INV-2026-0004");
  });
});
