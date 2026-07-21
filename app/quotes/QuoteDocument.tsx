"use client";

import Image from "next/image";
import type { QuoteDoc } from "@/lib/work/types";
import {
  HES_COMPANY,
  HES_QUOTE_INTRO,
  HES_QUOTE_TERMS,
  formatQuoteDate,
  formatQuoteMoney,
} from "@/lib/quotes/template";

export type QuoteDraftFields = {
  clientName: string;
  address: string;
  scope: string;
  amount: string;
  notes: string;
  followUpDate: string;
};

type Props = {
  quote: QuoteDoc;
  /** Optional quote date override (defaults to createdAt). */
  quoteDate?: string;
  /** When true, fields are editable inline on the document. */
  editable?: boolean;
  draft?: QuoteDraftFields;
  onDraftChange?: (patch: Partial<QuoteDraftFields>) => void;
};

/** Printable HES quote document matching the official Word template. */
export default function QuoteDocument({
  quote,
  quoteDate,
  editable = false,
  draft,
  onDraftChange,
}: Props) {
  const dateLabel = formatQuoteDate(quoteDate || quote.createdAt || "");
  const clientName = editable ? draft?.clientName ?? "" : quote.clientName;
  const address = editable ? draft?.address ?? "" : quote.address;
  const overview = editable
    ? draft?.scope ?? ""
    : quote.scope.trim() || "Exterior cleaning services as discussed.";
  const amountLabel = editable
    ? draft?.amount ?? ""
    : formatQuoteMoney(quote.amount);
  const pricingNotes = editable ? draft?.notes ?? "" : quote.notes.trim();

  return (
    <article className="quote-doc" aria-label="Harris Exterior Solutions quote">
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
            <h1 className="quote-doc-title">Service Quote</h1>
            <p className="quote-doc-id">
              {!quote.number || quote.id === "draft-new" || quote.id.startsWith("draft-")
                ? "New quote"
                : `Quote ${quote.number}`}
            </p>
          </div>
        </div>
      </header>

      <p className="quote-doc-intro">{HES_QUOTE_INTRO}</p>

      <dl className="quote-doc-meta">
        <div>
          <dt>Client name</dt>
          <dd>
            {editable ? (
              <input
                className="quote-doc-input"
                value={clientName}
                onChange={(e) => onDraftChange?.({ clientName: e.target.value })}
                placeholder="Client name"
                aria-label="Client name"
              />
            ) : (
              clientName || "—"
            )}
          </dd>
        </div>
        <div>
          <dt>Property address</dt>
          <dd>
            {editable ? (
              <input
                className="quote-doc-input"
                value={address}
                onChange={(e) => onDraftChange?.({ address: e.target.value })}
                placeholder="Property address"
                aria-label="Property address"
              />
            ) : (
              address || "—"
            )}
          </dd>
        </div>
        <div>
          <dt>Date</dt>
          <dd>{dateLabel}</dd>
        </div>
      </dl>

      <section className="quote-doc-section">
        <h2>Project Overview</h2>
        <p className="quote-doc-lede">This project includes</p>
        {editable ? (
          <textarea
            className="quote-doc-textarea"
            value={overview}
            onChange={(e) => onDraftChange?.({ scope: e.target.value })}
            rows={5}
            placeholder="Pressure washing of driveway, sidewalks, and front walkway…"
            aria-label="Project overview"
          />
        ) : (
          <div className="quote-doc-body">{overview}</div>
        )}
      </section>

      <section className="quote-doc-section">
        <h2>Pricing</h2>
        {editable ? (
          <div className="quote-doc-price-edit">
            <span>$</span>
            <input
              className="quote-doc-input quote-doc-amount"
              type="number"
              min={0}
              step="1"
              value={amountLabel}
              onChange={(e) => onDraftChange?.({ amount: e.target.value })}
              placeholder="0"
              aria-label="Pricing amount"
            />
          </div>
        ) : (
          <p className="quote-doc-price">{amountLabel}</p>
        )}
        {editable ? (
          <textarea
            className="quote-doc-textarea quote-doc-notes"
            value={pricingNotes}
            onChange={(e) => onDraftChange?.({ notes: e.target.value })}
            rows={2}
            placeholder="Optional pricing notes (deposit, materials, travel…)"
            aria-label="Pricing notes"
          />
        ) : pricingNotes ? (
          <p className="quote-doc-price-notes">{pricingNotes}</p>
        ) : null}
      </section>

      <section className="quote-doc-section">
        <h2>Terms &amp; Disclaimers</h2>
        <ul className="quote-doc-terms">
          {HES_QUOTE_TERMS.map((term) => (
            <li key={term}>{term}</li>
          ))}
        </ul>
      </section>

      <section className="quote-doc-signatures" aria-label="Signatures">
        <div className="quote-doc-sign-row">
          <span>Client Signature:</span>
          <span className="quote-doc-line" />
          <span>Date:</span>
          <span className="quote-doc-line short" />
        </div>
        <div className="quote-doc-sign-row">
          <span>Company Representative:</span>
          <span className="quote-doc-line" />
          <span>Date:</span>
          <span className="quote-doc-line short" />
        </div>
      </section>

      <footer className="quote-doc-footer">
        <p>{HES_COMPANY.legalName}</p>
        <p>Fully licensed and insured · Quality exterior cleaning</p>
      </footer>
    </article>
  );
}
