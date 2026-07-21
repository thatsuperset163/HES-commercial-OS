import { todayKey } from "../dates.ts";
import type {
  InvoiceDoc,
  InvoiceLineItem,
  InvoicePayment,
  InvoicePaymentMethod,
  InvoiceStatus,
} from "../work/types.ts";

function uid(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

export const INVOICE_PAYMENT_METHODS: {
  id: InvoicePaymentMethod;
  label: string;
}[] = [
  { id: "cash", label: "Cash" },
  { id: "check", label: "Check" },
  { id: "card", label: "Card" },
  { id: "ach", label: "ACH" },
  { id: "other", label: "Other" },
];

export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  draft: "Draft",
  sent: "Sent",
  partial: "Partially paid",
  paid: "Paid",
  overdue: "Overdue",
  void: "Void",
};

export const HES_INVOICE_TERMS =
  "Payment is due upon completion unless prior arrangements have been made in writing. Harris Exterior Solutions LLC is fully licensed and insured.";

export type InvoiceTotals = {
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  amountPaid: number;
  balanceDue: number;
};

function asAmount(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return Math.max(0, value);
  if (typeof value === "string" && value.trim()) {
    const n = Number(value);
    if (Number.isFinite(n)) return Math.max(0, n);
  }
  return 0;
}

export function lineItemTotal(item: InvoiceLineItem): number {
  return Math.max(0, (item.quantity || 0) * (item.rate || 0));
}

export function buildInvoiceTotals(invoice: InvoiceDoc): InvoiceTotals {
  const subtotal =
    invoice.lineItems.length > 0
      ? invoice.lineItems.reduce((sum, item) => sum + lineItemTotal(item), 0)
      : asAmount(invoice.amount);
  const discount = Math.min(Math.max(0, invoice.discount || 0), subtotal);
  const taxable = Math.max(0, subtotal - discount);
  const tax = taxable * (Math.max(0, invoice.taxRate || 0) / 100);
  const total = Math.round((taxable + tax) * 100) / 100;
  const paymentsSum = invoice.payments.reduce(
    (sum, payment) => sum + asAmount(payment.amount),
    0,
  );
  // Legacy paid invoices with no payment rows count as fully paid.
  const amountPaid =
    paymentsSum > 0
      ? Math.round(paymentsSum * 100) / 100
      : invoice.status === "paid"
        ? total
        : 0;
  const balanceDue =
    invoice.status === "void"
      ? 0
      : Math.max(0, Math.round((total - amountPaid) * 100) / 100);
  return { subtotal, discount, tax, total, amountPaid, balanceDue };
}

/** Derive display/workflow status from payments + due date. Void stays void. */
export function deriveInvoiceStatus(
  invoice: InvoiceDoc,
  today = todayKey(),
): InvoiceStatus {
  if (invoice.status === "void") return "void";
  if (invoice.status === "draft") return "draft";

  const { total, amountPaid, balanceDue } = buildInvoiceTotals(invoice);
  if (total > 0 && amountPaid >= total - 0.009) return "paid";
  if (amountPaid > 0 && balanceDue > 0) {
    if (invoice.dueDate && invoice.dueDate < today) return "overdue";
    return "partial";
  }
  if (
    (invoice.status === "sent" ||
      invoice.status === "overdue" ||
      invoice.status === "partial") &&
    invoice.dueDate &&
    invoice.dueDate < today &&
    balanceDue > 0
  ) {
    return "overdue";
  }
  return invoice.status === "overdue" ? "sent" : invoice.status;
}

export function nextInvoiceNumber(existing: InvoiceDoc[], year?: number): string {
  const y = year ?? new Date().getFullYear();
  const prefix = `INV-${y}-`;
  let max = 0;
  for (const row of existing) {
    const num = row.number || "";
    if (!num.startsWith(prefix)) continue;
    const n = Number(num.slice(prefix.length));
    if (Number.isFinite(n) && n > max) max = n;
  }
  return `${prefix}${String(max + 1).padStart(4, "0")}`;
}

export function createLineItem(
  partial?: Partial<InvoiceLineItem>,
): InvoiceLineItem {
  return {
    id: partial?.id || uid("line"),
    description: (partial?.description ?? "").trim() || "Service",
    quantity:
      partial?.quantity === undefined || Number.isNaN(Number(partial.quantity))
        ? 1
        : Math.max(0, Number(partial.quantity)),
    rate:
      partial?.rate === undefined || Number.isNaN(Number(partial.rate))
        ? 0
        : Math.max(0, Number(partial.rate)),
  };
}

export function createPayment(
  partial: Partial<InvoicePayment> & { amount: number },
): InvoicePayment {
  return {
    id: partial.id || uid("pay"),
    date: partial.date?.trim() || todayKey(),
    amount: Math.max(0, Number(partial.amount) || 0),
    method: partial.method || "cash",
    note: (partial.note ?? "").trim(),
  };
}

export function formatInvoiceMoney(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "$0";
  return `$${Math.round(value).toLocaleString("en-US")}`;
}
