/**
 * Safe historical clientId backfill for Work OS blackboard records.
 *
 * Never creates Clients. Never guesses among multiple matches.
 * Unique identity matches are linked; ambiguous/unmatched are flagged.
 */

import type { BoardStore } from "../types.ts";
import type {
  ExpenseDoc,
  InvoiceDoc,
  QuoteDoc,
  ServiceRequest,
  WorkTask,
} from "../work/types.ts";
import type { Job } from "../jobs/types.ts";
import {
  flagId,
  identityFromInvoice,
  identityFromJob,
  identityFromQuote,
  identityFromRequest,
  jobClientId,
  linkInvoiceClient,
  linkJobClient,
  linkQuoteClient,
  linkRequestClient,
  resolveClient,
  type ClientLinkFlag,
} from "./resolver.ts";

export type ClientBackfillResult = {
  store: BoardStore;
  linked: number;
  flags: ClientLinkFlag[];
};

function upsertFlag(
  flags: Map<string, ClientLinkFlag>,
  flag: Omit<ClientLinkFlag, "id" | "updatedAt"> & { id?: string },
): void {
  const id =
    flag.id ||
    flagId(flag.entityType, flag.entityId, flag.status);
  flags.set(id, {
    id,
    entityType: flag.entityType,
    entityId: flag.entityId,
    status: flag.status,
    candidateClientIds: flag.candidateClientIds,
    updatedAt: new Date().toISOString(),
  });
}

/**
 * Link orphan Work records to Clients when there is exactly one safe match.
 * Records with multiple candidates are flagged ambiguous (not linked).
 * Records with no match are flagged unmatched (not linked).
 */
export function backfillClientLinks(store: BoardStore): ClientBackfillResult {
  const clients = store.clients;
  const flags = new Map<string, ClientLinkFlag>();
  let linked = 0;

  const quotes: QuoteDoc[] = store.quotes.map((quote) => {
    if (quote.clientId.trim()) return quote;
    const result = resolveClient(clients, {
      identity: identityFromQuote(quote),
    });
    if (result.status === "resolved") {
      linked += 1;
      return linkQuoteClient(quote, result.client.id);
    }
    if (result.status === "ambiguous") {
      upsertFlag(flags, {
        entityType: "quote",
        entityId: quote.id,
        status: "ambiguous",
        candidateClientIds: result.matches.map((m) => m.client.id),
      });
    } else {
      upsertFlag(flags, {
        entityType: "quote",
        entityId: quote.id,
        status: "unmatched",
        candidateClientIds: [],
      });
    }
    return quote;
  });

  const invoices: InvoiceDoc[] = store.invoices.map((invoice) => {
    if (invoice.clientId.trim()) return invoice;
    const result = resolveClient(clients, {
      identity: identityFromInvoice(invoice),
    });
    if (result.status === "resolved") {
      linked += 1;
      return linkInvoiceClient(invoice, result.client.id);
    }
    if (result.status === "ambiguous") {
      upsertFlag(flags, {
        entityType: "invoice",
        entityId: invoice.id,
        status: "ambiguous",
        candidateClientIds: result.matches.map((m) => m.client.id),
      });
    } else {
      upsertFlag(flags, {
        entityType: "invoice",
        entityId: invoice.id,
        status: "unmatched",
        candidateClientIds: [],
      });
    }
    return invoice;
  });

  const jobs: Job[] = store.jobs.map((job) => {
    if (jobClientId(job)) return job;
    const result = resolveClient(clients, {
      identity: identityFromJob(job),
    });
    if (result.status === "resolved") {
      linked += 1;
      return linkJobClient(job, result.client.id);
    }
    if (result.status === "ambiguous") {
      upsertFlag(flags, {
        entityType: "job",
        entityId: job.id,
        status: "ambiguous",
        candidateClientIds: result.matches.map((m) => m.client.id),
      });
    } else if (
      job.customerName.trim() ||
      job.email.trim() ||
      job.phone.trim()
    ) {
      upsertFlag(flags, {
        entityType: "job",
        entityId: job.id,
        status: "unmatched",
        candidateClientIds: [],
      });
    }
    return job;
  });

  const requests: ServiceRequest[] = store.requests.map((request) => {
    if ((request.clientId || "").trim()) return request;
    const result = resolveClient(clients, {
      identity: identityFromRequest(request),
    });
    if (result.status === "resolved") {
      linked += 1;
      return linkRequestClient(request, result.client.id);
    }
    if (result.status === "ambiguous") {
      upsertFlag(flags, {
        entityType: "request",
        entityId: request.id,
        status: "ambiguous",
        candidateClientIds: result.matches.map((m) => m.client.id),
      });
    } else if (request.clientName.trim() || request.phone.trim()) {
      upsertFlag(flags, {
        entityType: "request",
        entityId: request.id,
        status: "unmatched",
        candidateClientIds: [],
      });
    }
    return request;
  });

  const tasks: WorkTask[] = store.tasks.map((task) => {
    if ((task.clientId || "").trim()) return task;
    return task;
  });

  const expenses: ExpenseDoc[] = store.expenses.map((expense) => {
    if ((expense.clientId || "").trim()) return expense;
    return expense;
  });

  // Drop stale flags for entities that are now linked.
  const linkedQuoteIds = new Set(
    quotes.filter((q) => q.clientId.trim()).map((q) => q.id),
  );
  const linkedInvoiceIds = new Set(
    invoices.filter((i) => i.clientId.trim()).map((i) => i.id),
  );
  const linkedJobIds = new Set(
    jobs.filter((j) => jobClientId(j)).map((j) => j.id),
  );
  const linkedRequestIds = new Set(
    requests.filter((r) => (r.clientId || "").trim()).map((r) => r.id),
  );

  const prior = Array.isArray(store.clientLinkFlags)
    ? store.clientLinkFlags
    : [];
  for (const flag of prior) {
    if (flag.entityType === "quote" && linkedQuoteIds.has(flag.entityId)) continue;
    if (flag.entityType === "invoice" && linkedInvoiceIds.has(flag.entityId)) {
      continue;
    }
    if (flag.entityType === "job" && linkedJobIds.has(flag.entityId)) continue;
    if (flag.entityType === "request" && linkedRequestIds.has(flag.entityId)) {
      continue;
    }
    if (!flags.has(flag.id)) flags.set(flag.id, flag);
  }

  return {
    store: {
      ...store,
      quotes,
      invoices,
      jobs,
      requests,
      tasks,
      expenses,
      clientLinkFlags: [...flags.values()],
    },
    linked,
    flags: [...flags.values()],
  };
}

/** Apply idMap from client dedupe across all Work relationship fields. */
export function remapStoreClientIds(
  store: BoardStore,
  idMap: Record<string, string>,
): BoardStore {
  if (!Object.keys(idMap).length) return store;

  const mapId = (id: string | null | undefined) => {
    const raw = (id || "").trim();
    if (!raw) return raw;
    return idMap[raw] || raw;
  };

  return {
    ...store,
    jobs: store.jobs.map((job) => {
      const next = mapId(job.customerId);
      if (!next || next === job.customerId) return job;
      return { ...job, customerId: next };
    }),
    quotes: store.quotes.map((quote) => {
      const next = mapId(quote.clientId);
      if (!next || next === quote.clientId) return quote;
      return { ...quote, clientId: next };
    }),
    invoices: store.invoices.map((invoice) => {
      const next = mapId(invoice.clientId);
      if (!next || next === invoice.clientId) return invoice;
      return { ...invoice, clientId: next };
    }),
    requests: store.requests.map((request) => {
      const next = mapId(request.clientId);
      if (!next || next === request.clientId) return request;
      return { ...request, clientId: next };
    }),
    tasks: store.tasks.map((task) => {
      const next = mapId(task.clientId);
      if (!next || next === task.clientId) return task;
      return { ...task, clientId: next };
    }),
    expenses: store.expenses.map((expense) => {
      const next = mapId(expense.clientId);
      if (!next || next === expense.clientId) return expense;
      return { ...expense, clientId: next };
    }),
    clientLinkFlags: (store.clientLinkFlags || []).map((flag) => ({
      ...flag,
      candidateClientIds: flag.candidateClientIds.map(
        (id) => idMap[id] || id,
      ),
    })),
  };
}
