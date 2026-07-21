import { addDays, todayKey } from "../dates.ts";
import type { IntakeRequest, IntakeStatus } from "../requestsCenter/types.ts";
import type { QuoteDoc, QuoteKind, QuoteStatus } from "../work/types.ts";

export type QuoteLifecycleEvent =
  | "created"
  | "saved"
  | "sent"
  | "won"
  | "lost"
  | "job_created";

/** Human-readable quote number, separate from stable quoteId. */
export function nextQuoteNumber(existing: QuoteDoc[], now = new Date()): string {
  const year = now.getFullYear();
  const prefix = `Q-${year}-`;
  let max = 0;
  for (const row of existing) {
    const number = (row.number || "").trim();
    if (!number.startsWith(prefix)) continue;
    const n = Number(number.slice(prefix.length));
    if (Number.isFinite(n) && n > max) max = n;
  }
  return `${prefix}${String(max + 1).padStart(4, "0")}`;
}

export function quotesForRequest(
  quotes: QuoteDoc[],
  requestId: string,
): QuoteDoc[] {
  const id = requestId.trim();
  if (!id) return [];
  return quotes
    .filter((q) => q.requestId === id)
    .sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));
}

export function primaryQuoteForRequest(
  quotes: QuoteDoc[],
  requestId: string,
  convertedQuoteId?: string | null,
): QuoteDoc | null {
  const id = (convertedQuoteId || "").trim();
  if (id) {
    const hit = quotes.find((q) => q.id === id);
    if (hit) return hit;
  }
  const linked = quotesForRequest(quotes, requestId);
  return linked[0] ?? null;
}

export function quoteFollowUpDate(from = todayKey(), days = 3): string {
  return addDays(from, days);
}

/**
 * Map quote lifecycle onto existing intake statuses (no new enum values).
 * - Drafted → needs_response (if still early) — "quote drafted, still yours to send"
 * - Sent → waiting_on_customer + quote follow-up
 * - Won → keep waiting / ready-for-job signal via waitingReason (approved only when Job created)
 * - Lost → does not auto-decline the request
 */
export function requestStatusForQuoteEvent(
  event: QuoteLifecycleEvent,
  current: IntakeStatus,
): IntakeStatus | null {
  if (current === "declined" || current === "approved") return null;

  if (event === "created" || event === "saved") {
    if (current === "new" || current === "needs_response") return "needs_response";
    return null;
  }
  if (event === "sent") return "waiting_on_customer";
  if (event === "won") return "waiting_on_customer";
  if (event === "job_created") return "approved";
  return null;
}

export type RequestQuoteSyncPatch = Partial<
  Pick<
    IntakeRequest,
    | "status"
    | "convertedQuoteId"
    | "linkedClientId"
    | "waitingReason"
    | "followUpDate"
    | "followUpType"
    | "followUpNotes"
  >
> & {
  activityType: string;
  activityBody: string;
  activityMeta?: Record<string, unknown>;
};

/** Build a PATCH payload for intake when a quote transition happens. */
export function buildRequestQuoteSync(input: {
  event: QuoteLifecycleEvent;
  request: Pick<
    IntakeRequest,
    | "id"
    | "status"
    | "convertedQuoteId"
    | "linkedClientId"
    | "convertedJobId"
    | "waitingReason"
    | "followUpDate"
  >;
  quote: Pick<
    QuoteDoc,
    "id" | "number" | "clientId" | "status" | "followUpDate" | "jobId"
  >;
  today?: string;
}): RequestQuoteSyncPatch | null {
  const { event, request, quote } = input;
  const today = input.today ?? todayKey();

  if (event === "created" || event === "saved") {
    // Idempotent: same quote already linked → skip activity noise on re-save.
    if (request.convertedQuoteId === quote.id && event === "saved") {
      return null;
    }
    const status = requestStatusForQuoteEvent(event, request.status);
    return {
      ...(status ? { status } : {}),
      convertedQuoteId: quote.id,
      ...(quote.clientId
        ? { linkedClientId: quote.clientId }
        : {}),
      activityType: event === "created" ? "quote_created" : "quote_saved",
      activityBody:
        event === "created"
          ? `Quote ${quote.number || quote.id} created from request`
          : `Quote ${quote.number || quote.id} saved`,
      activityMeta: {
        quoteId: quote.id,
        clientId: quote.clientId || null,
        requestId: request.id,
      },
    };
  }

  if (event === "sent") {
    const status = requestStatusForQuoteEvent("sent", request.status);
    return {
      ...(status ? { status } : {}),
      convertedQuoteId: quote.id,
      ...(quote.clientId ? { linkedClientId: quote.clientId } : {}),
      waitingReason: "Waiting for approval",
      followUpDate: quote.followUpDate || quoteFollowUpDate(today, 3),
      followUpType: "quote_reminder",
      followUpNotes: `Follow up on quote ${quote.number || quote.id}`,
      activityType: "quote_sent",
      activityBody: `Quote ${quote.number || quote.id} marked sent`,
      activityMeta: {
        quoteId: quote.id,
        clientId: quote.clientId || null,
        requestId: request.id,
        followUpDate: quote.followUpDate || quoteFollowUpDate(today, 3),
      },
    };
  }

  if (event === "won") {
    const status = requestStatusForQuoteEvent("won", request.status);
    return {
      ...(status ? { status } : {}),
      convertedQuoteId: quote.id,
      ...(quote.clientId ? { linkedClientId: quote.clientId } : {}),
      waitingReason: "Quote approved — ready for job",
      activityType: "quote_approved",
      activityBody: `Quote ${quote.number || quote.id} approved — ready to create job`,
      activityMeta: {
        quoteId: quote.id,
        clientId: quote.clientId || null,
        requestId: request.id,
      },
    };
  }

  if (event === "lost") {
    return {
      convertedQuoteId: quote.id,
      activityType: "quote_declined",
      activityBody: `Quote ${quote.number || quote.id} declined (request kept for outcome)`,
      activityMeta: {
        quoteId: quote.id,
        clientId: quote.clientId || null,
        requestId: request.id,
      },
    };
  }

  if (event === "job_created") {
    if (request.convertedJobId && request.convertedJobId === quote.jobId) {
      return null;
    }
    const status = requestStatusForQuoteEvent("job_created", request.status);
    return {
      ...(status ? { status } : {}),
      convertedQuoteId: quote.id,
      ...(quote.clientId ? { linkedClientId: quote.clientId } : {}),
      activityType: "job_from_quote",
      activityBody: `Job created from quote ${quote.number || quote.id}`,
      activityMeta: {
        quoteId: quote.id,
        jobId: quote.jobId || null,
        clientId: quote.clientId || null,
        requestId: request.id,
      },
    };
  }

  return null;
}

export function quoteKindLabel(kind: QuoteKind | string): string {
  switch (kind) {
    case "revised":
      return "Revised Quote";
    case "alternate":
      return "Alternate Quote";
    case "additional":
      return "Additional Quote";
    default:
      return "Quote";
  }
}

export function formatQuoteStatus(status: QuoteStatus): string {
  switch (status) {
    case "draft":
      return "Draft";
    case "sent":
      return "Sent";
    case "won":
      return "Approved";
    case "lost":
      return "Declined";
    default:
      return status;
  }
}
