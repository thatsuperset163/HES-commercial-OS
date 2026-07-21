"use client";

import type { QuoteDoc } from "@/lib/work/types";
import {
  HES_COMPANY,
  HES_QUOTE_INTRO,
  HES_QUOTE_TERMS,
  formatQuoteDate,
  formatQuoteMoney,
} from "@/lib/quotes/template";

type Props = {
  quote: QuoteDoc;
  /** Optional quote date override (defaults to createdAt). */
  quoteDate?: string;
};

/** Printable HES quote document matching the official Word template. */
export default function QuoteDocument({ quote, quoteDate }: Props) {
  const dateLabel = formatQuoteDate(quoteDate || quote.createdAt || "");
  const overview = quote.scope.trim() || "Exterior cleaning services as discussed.";
  const pricingNotes = quote.notes.trim();

  return (
    <article className="quote-doc" aria-label="Harris Exterior Solutions quote">
      <header className="quote-doc-brand">
        <p className="quote-doc-eyebrow">{HES_COMPANY.brandName}</p>
        <h1 className="quote-doc-title">Service Quote</h1>
        <p className="quote-doc-id">Quote {quote.id}</p>
      </header>

      <p className="quote-doc-intro">{HES_QUOTE_INTRO}</p>

      <dl className="quote-doc-meta">
        <div>
          <dt>Client name</dt>
          <dd>{quote.clientName || "—"}</dd>
        </div>
        <div>
          <dt>Property address</dt>
          <dd>{quote.address || "—"}</dd>
        </div>
        <div>
          <dt>Date</dt>
          <dd>{dateLabel}</dd>
        </div>
      </dl>

      <section className="quote-doc-section">
        <h2>Project Overview</h2>
        <p className="quote-doc-lede">This project includes</p>
        <div className="quote-doc-body">{overview}</div>
      </section>

      <section className="quote-doc-section">
        <h2>Pricing</h2>
        <p className="quote-doc-price">{formatQuoteMoney(quote.amount)}</p>
        {pricingNotes ? (
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
