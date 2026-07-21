import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { backfillClientLinks, remapStoreClientIds } from "../lib/clients/backfill.ts";
import { gatherClientRelated } from "../lib/clients/related.ts";
import {
  createClientNote,
  createClientReminder,
} from "../lib/clients/linked.ts";
import {
  getClientById,
  jobClientId,
  resolveClient,
} from "../lib/clients/resolver.ts";
import { createClient, createInvoice, createQuote } from "../lib/work/model.ts";
import type { BoardStore } from "../lib/types.ts";
import type { WorkClient } from "../lib/work/types.ts";
import type { Job } from "../lib/jobs/types.ts";

function client(partial: Partial<WorkClient> & { name: string; id: string }): WorkClient {
  return {
    ...createClient({ name: partial.name }),
    ...partial,
    id: partial.id,
    name: partial.name,
  };
}

function emptyStore(overrides: Partial<BoardStore> = {}): BoardStore {
  return {
    days: {},
    jobs: [],
    clients: [],
    requests: [],
    tasks: [],
    quotes: [],
    invoices: [],
    expenses: [],
    clientLinkFlags: [],
    ideaLot: "",
    ...overrides,
  };
}

describe("canonical client resolver", () => {
  it("resolves by clientId without creating", () => {
    const clients = [client({ id: "c1", name: "Amy", email: "amy@hes.com" })];
    const hit = resolveClient(clients, { clientId: "c1" });
    assert.equal(hit.status, "resolved");
    if (hit.status === "resolved") assert.equal(hit.client.id, "c1");
    assert.equal(getClientById(clients, "missing"), null);
  });

  it("returns ambiguous when multiple email matches exist", () => {
    // findPossibleClientMatches returns unique by id; two different emails won't collide.
    // Use same phone across two clients to force ambiguity.
    const clients = [
      client({ id: "a", name: "A", phone: "3365550100", address: "1 Main" }),
      client({ id: "b", name: "B", phone: "3365550100", address: "2 Oak" }),
    ];
    const hit = resolveClient(clients, {
      identity: { phone: "(336) 555-0100" },
    });
    assert.equal(hit.status, "ambiguous");
  });

  it("backfill links unique quote match and flags unmatched", () => {
    const clients = [
      client({ id: "c1", name: "Amy Stone", email: "amy@hes.com" }),
    ];
    const quote = createQuote({
      clientName: "Amy Stone",
      email: "amy@hes.com",
      scope: "Wash",
    });
    assert.equal(quote.clientId, "");
    const orphan = createQuote({
      clientName: "Nobody",
      email: "nobody@example.com",
      scope: "Wash",
    });
    const result = backfillClientLinks(
      emptyStore({ clients, quotes: [quote, orphan] }),
    );
    assert.equal(result.linked, 1);
    assert.equal(result.store.quotes[0]?.clientId, "c1");
    assert.equal(result.store.quotes[1]?.clientId, "");
    assert.ok(
      result.flags.some(
        (f) => f.entityType === "quote" && f.status === "unmatched",
      ),
    );
  });

  it("remapStoreClientIds updates quotes invoices jobs requests", () => {
    const store = emptyStore({
      quotes: [
        createQuote({
          clientName: "A",
          clientId: "old",
        }),
      ],
      invoices: [
        createInvoice({
          clientName: "A",
          clientId: "old",
        }),
      ],
      jobs: [
        {
          id: "j1",
          customerId: "old",
          requestId: null,
          prospectId: null,
          quoteId: null,
          customerName: "A",
          companyName: "",
          contactName: "",
          phone: "",
          email: "",
          address: "",
          service: "Wash",
          title: "Wash",
          description: "",
          scheduledDate: "",
          startTime: "",
          endTime: "",
          estimatedDurationMinutes: 60,
          amount: null,
          assignedTo: "",
          status: "unscheduled",
          priority: "normal",
          notes: "",
          customerNotes: "",
          equipmentNeeded: "",
          invoiceStatus: "none",
          paymentStatus: "na",
          recurringRule: "",
          createdAt: "",
          updatedAt: "",
        } satisfies Job,
      ],
      requests: [
        {
          id: "r1",
          clientId: "old",
          clientName: "A",
          summary: "Lead",
          phone: "",
          status: "new",
          notes: "",
          createdAt: "",
          updatedAt: "",
        },
      ],
    });
    const remapped = remapStoreClientIds(store, { old: "survivor" });
    assert.equal(remapped.quotes[0]?.clientId, "survivor");
    assert.equal(remapped.invoices[0]?.clientId, "survivor");
    assert.equal(jobClientId(remapped.jobs[0]!), "survivor");
    assert.equal(remapped.requests[0]?.clientId, "survivor");
  });

  it("gatherClientRelated prefers clientId and isolates legacy name matches", () => {
    const c = client({ id: "c1", name: "Amy" });
    const related = gatherClientRelated(c, {
      requests: [
        {
          id: "r1",
          clientId: "c1",
          clientName: "Amy",
          summary: "Linked",
          phone: "",
          status: "new",
          notes: "",
          createdAt: "2026-01-01",
          updatedAt: "2026-01-01",
        },
        {
          id: "r2",
          clientId: "",
          clientName: "Amy",
          summary: "Legacy",
          phone: "",
          status: "new",
          notes: "",
          createdAt: "2026-01-01",
          updatedAt: "2026-01-01",
        },
      ],
      quotes: [
        createQuote({ clientName: "Amy", clientId: "c1", scope: "Id quote" }),
        createQuote({ clientName: "Amy", scope: "Name quote" }),
      ],
      jobs: [],
      invoices: [],
      tasks: [],
    });
    assert.equal(related.requests.length, 1);
    assert.equal(related.legacy.requests.length, 1);
    assert.equal(related.quotes.length, 1);
    assert.equal(related.legacy.quotes.length, 1);
  });

  it("rename safety: related rows stay linked by id after name change", () => {
    const before = client({ id: "c1", name: "Old Name", email: "a@hes.com" });
    const quote = createQuote({
      clientName: "Old Name",
      clientId: "c1",
      scope: "Wash",
    });
    const after = { ...before, name: "New Name" };
    const related = gatherClientRelated(after, {
      requests: [],
      quotes: [quote],
      jobs: [],
      invoices: [],
      tasks: [],
    });
    assert.equal(related.quotes.length, 1);
    assert.equal(related.legacy.quotes.length, 0);
  });

  it("linked helpers require clientId", () => {
    assert.throws(() => createClientNote({ clientId: "", body: "hi" }));
    const note = createClientNote({ clientId: "c1", body: "hi" });
    assert.equal(note.clientId, "c1");
    const rem = createClientReminder({
      clientId: "c1",
      title: "Call",
      dueDate: "2026-07-22",
    });
    assert.equal(rem.clientId, "c1");
  });
});
