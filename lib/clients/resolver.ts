/**
 * Canonical Work OS client identity resolver.
 *
 * One real-world customer = one WorkClient = one clientId.
 * Display names are snapshots for humans; relationships use clientId only.
 *
 * This module NEVER creates a Client. Only intentional Create Client flows
 * (findOrCreateClient / createClient on explicit user action) may mint records.
 */

import type { Job } from "../jobs/types.ts";
import type {
  ExpenseDoc,
  InvoiceDoc,
  QuoteDoc,
  ServiceRequest,
  WorkClient,
  WorkTask,
} from "../work/types.ts";
import {
  findExistingClient,
  findPossibleClientMatches,
  normalizeClientEmail,
  normalizeClientPhone,
  type ClientIdentityInput,
  type PossibleClientMatch,
} from "./identity.ts";

export {
  normalizeClientEmail as normalizeEmail,
  normalizeClientPhone as normalizePhone,
  normalizeClientName as normalizeName,
  normalizeClientAddress as normalizeAddress,
  findPossibleClientMatches,
} from "./identity.ts";

export type WorkEntityType =
  | "client"
  | "request"
  | "quote"
  | "job"
  | "invoice"
  | "task"
  | "expense"
  | "note"
  | "reminder"
  | "file"
  | "activity";

export type ClientResolveResult =
  | { status: "resolved"; client: WorkClient; reason: string }
  | { status: "ambiguous"; matches: PossibleClientMatch[] }
  | { status: "unmatched" };

export type ClientLinkFlag = {
  id: string;
  entityType: Exclude<WorkEntityType, "client" | "note" | "reminder" | "file" | "activity">;
  entityId: string;
  status: "ambiguous" | "unmatched";
  candidateClientIds: string[];
  updatedAt: string;
};

/** Job.customerId is the Work clientId (historical field name). */
export function jobClientId(job: Pick<Job, "customerId">): string {
  return (job.customerId || "").trim();
}

export function getClientById(
  clients: WorkClient[],
  clientId: string | null | undefined,
): WorkClient | null {
  const id = (clientId || "").trim();
  if (!id) return null;
  return clients.find((c) => c.id === id) ?? null;
}

/**
 * Resolve a Client without creating one.
 * Prefer exact id, then unique identity match, else ambiguous/unmatched.
 */
export function resolveClient(
  clients: WorkClient[],
  input: {
    clientId?: string | null;
    identity?: ClientIdentityInput;
  },
): ClientResolveResult {
  const byId = getClientById(clients, input.clientId);
  if (byId) {
    return { status: "resolved", client: byId, reason: "client_id" };
  }

  const identity = input.identity;
  if (!identity) return { status: "unmatched" };

  const possible = findPossibleClientMatches(clients, identity);
  if (possible.length === 1 && possible[0]) {
    return {
      status: "resolved",
      client: possible[0].client,
      reason: `unique_${possible[0].reason}`,
    };
  }
  if (possible.length > 1) {
    return { status: "ambiguous", matches: possible };
  }

  // Fall back to stricter auto-match used by findOrCreate (still no create).
  const strict = findExistingClient(clients, identity);
  if (strict) {
    return {
      status: "resolved",
      client: strict.client,
      reason: `strict_${strict.reason}`,
    };
  }

  return { status: "unmatched" };
}

/** Attach a verified clientId onto a quote without rewriting snapshot fields. */
export function linkQuoteClient(quote: QuoteDoc, clientId: string): QuoteDoc {
  const id = clientId.trim();
  if (!id || quote.clientId === id) return quote;
  return { ...quote, clientId: id, updatedAt: new Date().toISOString() };
}

export function linkInvoiceClient(
  invoice: InvoiceDoc,
  clientId: string,
): InvoiceDoc {
  const id = clientId.trim();
  if (!id || invoice.clientId === id) return invoice;
  return { ...invoice, clientId: id, updatedAt: new Date().toISOString() };
}

export function linkJobClient(job: Job, clientId: string): Job {
  const id = clientId.trim();
  if (!id || job.customerId === id) return job;
  return {
    ...job,
    customerId: id,
    updatedAt: new Date().toISOString(),
  };
}

export function linkRequestClient(
  request: ServiceRequest,
  clientId: string,
): ServiceRequest {
  const id = clientId.trim();
  if (!id || request.clientId === id) return request;
  return { ...request, clientId: id, updatedAt: new Date().toISOString() };
}

export function linkTaskClient(task: WorkTask, clientId: string): WorkTask {
  const id = clientId.trim();
  if (!id || task.clientId === id) return task;
  return { ...task, clientId: id, updatedAt: new Date().toISOString() };
}

export function linkExpenseClient(
  expense: ExpenseDoc,
  clientId: string,
): ExpenseDoc {
  const id = clientId.trim();
  if (!id || expense.clientId === id) return expense;
  return { ...expense, clientId: id, updatedAt: new Date().toISOString() };
}

export function identityFromQuote(quote: QuoteDoc): ClientIdentityInput {
  return {
    name: quote.clientName,
    companyName: quote.companyName,
    phone: quote.phone,
    email: quote.email,
    address: quote.address,
  };
}

export function identityFromInvoice(invoice: InvoiceDoc): ClientIdentityInput {
  return {
    name: invoice.clientName,
    companyName: invoice.companyName,
    address: invoice.serviceAddress || invoice.billingAddress,
  };
}

export function identityFromJob(job: Job): ClientIdentityInput {
  return {
    name: job.customerName,
    companyName: job.companyName,
    phone: job.phone,
    email: job.email,
    address: job.address,
  };
}

export function identityFromRequest(
  request: ServiceRequest,
): ClientIdentityInput {
  return {
    name: request.clientName,
    phone: request.phone,
  };
}

/** Remap a stored client id through a dedupe survivor map. */
export function remapClientId(
  clientId: string | null | undefined,
  idMap: Record<string, string>,
): string {
  const id = (clientId || "").trim();
  if (!id) return "";
  return idMap[id] || id;
}

export function flagId(
  entityType: ClientLinkFlag["entityType"],
  entityId: string,
  status: ClientLinkFlag["status"],
): string {
  return `clf-${entityType}-${entityId}-${status}`;
}
