"use client";

import Image from "next/image";
import {
  buildInvoiceTotals,
  deriveInvoiceStatus,
  formatInvoiceMoney,
  HES_INVOICE_TERMS,
  INVOICE_STATUS_LABELS,
  lineItemTotal,
} from "@/lib/invoices/model";
import { HES_COMPANY, formatQuoteDate } from "@/lib/quotes/template";
import type { InvoiceDoc, InvoiceLineItem } from "@/lib/work/types";

export type InvoiceDraftFields = {
  clientName: string;
  companyName: string;
  clientId: string;
  billingAddress: string;
  serviceAddress: string;
  jobLabel: string;
  jobId: string;
  quoteId: string;
  requestId: string;
  lineItems: InvoiceLineItem[];
  discount: string;
  taxRate: string;
  issueDate: string;
  dueDate: string;
  paymentTerms: string;
  notes: string;
  number: string;
};

type Props = {
  invoice: InvoiceDoc;
  editable?: boolean;
  draft?: InvoiceDraftFields;
  onDraftChange?: (patch: Partial<InvoiceDraftFields>) => void;
  onLineChange?: (index: number, patch: Partial<InvoiceLineItem>) => void;
  onAddLine?: () => void;
  onRemoveLine?: (index: number) => void;
};

/** Printable HES invoice document — mirrors Quote document styling. */
export default function InvoiceDocument({
  invoice,
  editable = false,
  draft,
  onDraftChange,
  onLineChange,
  onAddLine,
  onRemoveLine,
}: Props) {
  const live: InvoiceDoc = editable && draft
    ? {
        ...invoice,
        number: draft.number || invoice.number,
        clientName: draft.clientName,
        companyName: draft.companyName,
        clientId: draft.clientId,
        billingAddress: draft.billingAddress,
        serviceAddress: draft.serviceAddress,
        jobLabel: draft.jobLabel,
        jobId: draft.jobId,
        quoteId: draft.quoteId,
        requestId: draft.requestId,
        lineItems: draft.lineItems,
        discount: Number(draft.discount) || 0,
        taxRate: Number(draft.taxRate) || 0,
        issueDate: draft.issueDate,
        dueDate: draft.dueDate,
        paymentTerms: draft.paymentTerms,
        notes: draft.notes,
      }
    : invoice;

  const totals = buildInvoiceTotals(live);
  const status = deriveInvoiceStatus(live);
  const lines =
    live.lineItems.length > 0
      ? live.lineItems
      : [
          {
            id: "legacy",
            description: live.jobLabel || "Completed work",
            quantity: 1,
            rate: live.amount ?? 0,
          },
        ];

  return (
    <article className="quote-doc invoice-doc" aria-label="Harris Exterior Solutions invoice">
      <header className="quote-doc-brand">
        <div className="quote-doc-brand-row">
          <Image
            src="/work/sales/brand/logo-mark.svg"
            alt="Harris Exterior Solutions"
            width={72}
            height={60}
            className="quote-doc-logo"
            priority
            unoptimized
          />
          <div>
            <p className="quote-doc-eyebrow">{HES_COMPANY.brandName}</p>
            <h1 className="quote-doc-title">Invoice</h1>
            <p className="quote-doc-id">
              {live.id.startsWith("draft-")
                ? "New invoice"
                : live.number || `Invoice ${live.id}`}
            </p>
          </div>
        </div>
        <p className="invoice-status-pill no-print">
          {INVOICE_STATUS_LABELS[status]}
        </p>
      </header>

      <dl className="quote-doc-meta invoice-meta-grid">
        <div>
          <dt>Invoice #</dt>
          <dd>
            {editable ? (
              <input
                className="quote-doc-input"
                value={draft?.number ?? ""}
                onChange={(e) => onDraftChange?.({ number: e.target.value })}
                aria-label="Invoice number"
              />
            ) : (
              live.number || "—"
            )}
          </dd>
        </div>
        <div>
          <dt>Issue date</dt>
          <dd>
            {editable ? (
              <input
                className="quote-doc-input"
                type="date"
                value={draft?.issueDate ?? ""}
                onChange={(e) => onDraftChange?.({ issueDate: e.target.value })}
              />
            ) : (
              formatQuoteDate(live.issueDate)
            )}
          </dd>
        </div>
        <div>
          <dt>Due date</dt>
          <dd>
            {editable ? (
              <input
                className="quote-doc-input"
                type="date"
                value={draft?.dueDate ?? ""}
                onChange={(e) => onDraftChange?.({ dueDate: e.target.value })}
              />
            ) : (
              formatQuoteDate(live.dueDate)
            )}
          </dd>
        </div>
        <div>
          <dt>Client name</dt>
          <dd>
            {editable ? (
              <input
                className="quote-doc-input"
                value={draft?.clientName ?? ""}
                onChange={(e) => onDraftChange?.({ clientName: e.target.value })}
                placeholder="Client name"
              />
            ) : (
              live.clientName || "—"
            )}
          </dd>
        </div>
        <div>
          <dt>Company</dt>
          <dd>
            {editable ? (
              <input
                className="quote-doc-input"
                value={draft?.companyName ?? ""}
                onChange={(e) => onDraftChange?.({ companyName: e.target.value })}
                placeholder="Company (optional)"
              />
            ) : (
              live.companyName || "—"
            )}
          </dd>
        </div>
        <div>
          <dt>Related job</dt>
          <dd>
            {editable ? (
              <input
                className="quote-doc-input"
                value={draft?.jobLabel ?? ""}
                onChange={(e) => onDraftChange?.({ jobLabel: e.target.value })}
                placeholder="Job / service label"
              />
            ) : (
              live.jobLabel || "—"
            )}
          </dd>
        </div>
        <div>
          <dt>Billing address</dt>
          <dd>
            {editable ? (
              <input
                className="quote-doc-input"
                value={draft?.billingAddress ?? ""}
                onChange={(e) =>
                  onDraftChange?.({ billingAddress: e.target.value })
                }
              />
            ) : (
              live.billingAddress || "—"
            )}
          </dd>
        </div>
        <div>
          <dt>Service address</dt>
          <dd>
            {editable ? (
              <input
                className="quote-doc-input"
                value={draft?.serviceAddress ?? ""}
                onChange={(e) =>
                  onDraftChange?.({ serviceAddress: e.target.value })
                }
              />
            ) : (
              live.serviceAddress || "—"
            )}
          </dd>
        </div>
      </dl>

      <section className="quote-doc-section">
        <h2>Services</h2>
        <table className="invoice-lines">
          <thead>
            <tr>
              <th>Description</th>
              <th>Qty</th>
              <th>Rate</th>
              <th>Total</th>
              {editable ? <th className="no-print" /> : null}
            </tr>
          </thead>
          <tbody>
            {lines.map((line, index) => (
              <tr key={line.id}>
                <td>
                  {editable && draft ? (
                    <input
                      className="quote-doc-input"
                      value={draft.lineItems[index]?.description ?? line.description}
                      onChange={(e) =>
                        onLineChange?.(index, { description: e.target.value })
                      }
                    />
                  ) : (
                    line.description
                  )}
                </td>
                <td>
                  {editable && draft ? (
                    <input
                      className="quote-doc-input"
                      type="number"
                      min={0}
                      step="0.01"
                      value={draft.lineItems[index]?.quantity ?? line.quantity}
                      onChange={(e) =>
                        onLineChange?.(index, {
                          quantity: Number(e.target.value) || 0,
                        })
                      }
                    />
                  ) : (
                    line.quantity
                  )}
                </td>
                <td>
                  {editable && draft ? (
                    <input
                      className="quote-doc-input"
                      type="number"
                      min={0}
                      step="1"
                      value={draft.lineItems[index]?.rate ?? line.rate}
                      onChange={(e) =>
                        onLineChange?.(index, {
                          rate: Number(e.target.value) || 0,
                        })
                      }
                    />
                  ) : (
                    formatInvoiceMoney(line.rate)
                  )}
                </td>
                <td>
                  {formatInvoiceMoney(
                    editable && draft?.lineItems[index]
                      ? lineItemTotal(draft.lineItems[index]!)
                      : lineItemTotal(line),
                  )}
                </td>
                {editable ? (
                  <td className="no-print">
                    <button
                      type="button"
                      className="btn secondary small"
                      onClick={() => onRemoveLine?.(index)}
                      disabled={(draft?.lineItems.length ?? 0) <= 1}
                    >
                      Remove
                    </button>
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
        {editable ? (
          <button
            type="button"
            className="btn secondary small no-print"
            onClick={onAddLine}
          >
            Add line
          </button>
        ) : null}
      </section>

      <section className="invoice-totals quote-doc-section">
        <div className="invoice-totals-grid">
          <span>Subtotal</span>
          <strong>{formatInvoiceMoney(totals.subtotal)}</strong>
          <span>Discount</span>
          <strong>
            {editable ? (
              <input
                className="quote-doc-input"
                type="number"
                min={0}
                value={draft?.discount ?? "0"}
                onChange={(e) => onDraftChange?.({ discount: e.target.value })}
              />
            ) : (
              formatInvoiceMoney(totals.discount)
            )}
          </strong>
          <span>Tax %</span>
          <strong>
            {editable ? (
              <input
                className="quote-doc-input"
                type="number"
                min={0}
                step="0.01"
                value={draft?.taxRate ?? "0"}
                onChange={(e) => onDraftChange?.({ taxRate: e.target.value })}
              />
            ) : (
              `${live.taxRate || 0}%`
            )}
          </strong>
          <span>Tax</span>
          <strong>{formatInvoiceMoney(totals.tax)}</strong>
          <span>Total</span>
          <strong className="invoice-grand">{formatInvoiceMoney(totals.total)}</strong>
          <span>Amount paid</span>
          <strong>{formatInvoiceMoney(totals.amountPaid)}</strong>
          <span>Balance due</span>
          <strong className="invoice-balance">
            {formatInvoiceMoney(totals.balanceDue)}
          </strong>
        </div>
      </section>

      <section className="quote-doc-section">
        <h2>Payment terms</h2>
        {editable ? (
          <textarea
            className="quote-doc-textarea"
            rows={2}
            value={draft?.paymentTerms ?? ""}
            onChange={(e) => onDraftChange?.({ paymentTerms: e.target.value })}
          />
        ) : (
          <p className="quote-doc-body">{live.paymentTerms || HES_INVOICE_TERMS}</p>
        )}
      </section>

      <section className="quote-doc-section">
        <h2>Notes</h2>
        {editable ? (
          <textarea
            className="quote-doc-textarea"
            rows={3}
            value={draft?.notes ?? ""}
            onChange={(e) => onDraftChange?.({ notes: e.target.value })}
            placeholder="Internal or client-facing notes"
          />
        ) : (
          <p className="quote-doc-body">{live.notes || "—"}</p>
        )}
      </section>

      {!editable && live.payments.length > 0 ? (
        <section className="quote-doc-section">
          <h2>Payments</h2>
          <ul className="invoice-payments">
            {live.payments.map((payment) => (
              <li key={payment.id}>
                {formatQuoteDate(payment.date)} · {payment.method} ·{" "}
                {formatInvoiceMoney(payment.amount)}
                {payment.note ? ` · ${payment.note}` : ""}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="quote-doc-section">
        <h2>Terms</h2>
        <p className="quote-doc-body">{HES_INVOICE_TERMS}</p>
      </section>

      <footer className="quote-doc-footer">
        <p>{HES_COMPANY.legalName}</p>
        <p>Fully licensed and insured · Thank you for your business</p>
        {live.clientId ? (
          <p className="no-print">Client ID: {live.clientId}</p>
        ) : null}
        {live.jobId || live.quoteId ? (
          <p className="no-print">
            {[live.jobId && `Job ${live.jobId}`, live.quoteId && `Quote ${live.quoteId}`]
              .filter(Boolean)
              .join(" · ")}
          </p>
        ) : null}
      </footer>
    </article>
  );
}
