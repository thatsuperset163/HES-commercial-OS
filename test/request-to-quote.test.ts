import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  findPossibleClientMatches,
} from "../lib/clients/identity.ts";
import {
  buildQuoteComposeUrl,
  buildQuoteNotesFromRequest,
} from "../lib/quotes/fromRequest.ts";
import {
  buildRequestQuoteSync,
  nextQuoteNumber,
  primaryQuoteForRequest,
  quoteFollowUpDate,
  requestStatusForQuoteEvent,
} from "../lib/quotes/model.ts";
import { createIntakeRequest } from "../lib/requestsCenter/model.ts";
import { createQuote, normalizeQuotes } from "../lib/work/model.ts";
import type { QuoteDoc } from "../lib/work/types.ts";
import type { WorkClient } from "../lib/work/types.ts";

function client(partial: Partial<WorkClient> & { name: string; id: string }): WorkClient {
  return {
    id: partial.id,
    name: partial.name,
    companyName: partial.companyName ?? "",
    phone: partial.phone ?? "",
    email: partial.email ?? "",
    address: partial.address ?? "",
    billingAddress: partial.billingAddress ?? "",
    properties: partial.properties ?? [],
    city: partial.city ?? "",
    clientType: partial.clientType ?? "residential",
    preferredContact: partial.preferredContact ?? "",
    tags: partial.tags ?? [],
    favorite: partial.favorite ?? false,
    notes: partial.notes ?? "",
    status: partial.status ?? "active",
    createdAt: partial.createdAt ?? "2026-01-01T00:00:00.000Z",
    updatedAt: partial.updatedAt ?? "2026-01-01T00:00:00.000Z",
  };
}

describe("request → quote workflow", () => {
  it("normalizes legacy quotes without relationship fields", () => {
    const rows = normalizeQuotes([
      {
        id: "quote-old",
        clientName: "Legacy Co",
        address: "1 Main",
        scope: "Wash",
        amount: 100,
        status: "sent",
        followUpDate: "2026-07-01",
        notes: "",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-02T00:00:00.000Z",
      },
    ]);
    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.clientId, "");
    assert.equal(rows[0]?.requestId, "");
    assert.equal(rows[0]?.number.startsWith("Q-") || rows[0]?.number.includes("OLD"), true);
    assert.equal(rows[0]?.clientName, "Legacy Co");
  });

  it("createQuote stores stable relationship ids and a human number", () => {
    const row = createQuote({
      id: "quote-stable-1",
      number: "Q-2026-0001",
      clientName: "Amy",
      clientId: "client-1",
      requestId: "req-1",
      address: "9 Oak",
      scope: "House wash",
    });
    assert.equal(row.id, "quote-stable-1");
    assert.equal(row.number, "Q-2026-0001");
    assert.equal(row.clientId, "client-1");
    assert.equal(row.requestId, "req-1");
    assert.equal(row.status, "draft");
  });

  it("nextQuoteNumber increments within the year", () => {
    const existing: QuoteDoc[] = [
      createQuote({ clientName: "A", number: "Q-2026-0003" }),
      createQuote({ clientName: "B", number: "Q-2025-0099" }),
    ];
    assert.equal(nextQuoteNumber(existing, new Date("2026-07-21")), "Q-2026-0004");
  });

  it("maps quote lifecycle onto existing intake statuses", () => {
    assert.equal(requestStatusForQuoteEvent("created", "new"), "needs_response");
    assert.equal(requestStatusForQuoteEvent("sent", "needs_response"), "waiting_on_customer");
    assert.equal(requestStatusForQuoteEvent("won", "waiting_on_customer"), "waiting_on_customer");
    assert.equal(requestStatusForQuoteEvent("job_created", "waiting_on_customer"), "approved");
    assert.equal(requestStatusForQuoteEvent("sent", "declined"), null);
  });

  it("buildRequestQuoteSync is idempotent on repeated saves", () => {
    const request = createIntakeRequest({
      customerName: "Amy",
      status: "needs_response",
    });
    request.convertedQuoteId = "quote-1";
    const quote = createQuote({
      id: "quote-1",
      number: "Q-2026-0001",
      clientName: "Amy",
      clientId: "client-1",
      requestId: request.id,
    });
    const again = buildRequestQuoteSync({
      event: "saved",
      request,
      quote,
    });
    assert.equal(again, null);
  });

  it("sent sync sets follow-up and waiting status", () => {
    const request = createIntakeRequest({
      customerName: "Amy",
      status: "needs_response",
    });
    const quote = createQuote({
      id: "quote-1",
      number: "Q-2026-0001",
      clientName: "Amy",
      clientId: "client-1",
      requestId: request.id,
      followUpDate: quoteFollowUpDate("2026-07-21", 3),
    });
    const patch = buildRequestQuoteSync({
      event: "sent",
      request,
      quote,
      today: "2026-07-21",
    });
    assert.ok(patch);
    assert.equal(patch?.status, "waiting_on_customer");
    assert.equal(patch?.followUpType, "quote_reminder");
    assert.equal(patch?.followUpDate, "2026-07-24");
    assert.equal(patch?.convertedQuoteId, "quote-1");
    assert.equal(patch?.linkedClientId, "client-1");
  });

  it("findPossibleClientMatches uses email, phone, company+address, name+address", () => {
    const clients = [
      client({ id: "e", name: "Other", email: "amy@hes.com" }),
      client({ id: "p", name: "Phone Only", phone: "3365550100" }),
      client({
        id: "c",
        name: "Corp Contact",
        companyName: "Stone Co",
        address: "1 Main St",
      }),
      client({ id: "n", name: "Amy Stone", address: "9 Oak Ave" }),
    ];
    const byEmail = findPossibleClientMatches(clients, {
      email: "AMY@hes.com",
    });
    assert.equal(byEmail[0]?.client.id, "e");

    const byPhone = findPossibleClientMatches(clients, {
      phone: "(336) 555-0100",
    });
    assert.equal(byPhone[0]?.client.id, "p");

    const byCompany = findPossibleClientMatches(clients, {
      companyName: "Stone Co",
      address: "1 Main St",
    });
    assert.equal(byCompany[0]?.client.id, "c");

    const byName = findPossibleClientMatches(clients, {
      name: "Amy Stone",
      address: "9 Oak Ave",
    });
    assert.equal(byName[0]?.client.id, "n");
  });

  it("compose URL preserves requestId and does not invent pricing when absent", () => {
    const request = createIntakeRequest({
      customerName: "Amy Stone",
      company: "Stone Co",
      phone: "555-0100",
      email: "amy@example.com",
      address: "9 Oak",
      serviceRequested: "House wash",
      notes: "Soft wash preferred",
    });
    const url = buildQuoteComposeUrl({
      request,
      clientId: "client-1",
      quoteKind: "primary",
    });
    assert.match(url, /requestId=/);
    assert.match(url, /clientId=client-1/);
    assert.match(url, /scope=House/);
    assert.doesNotMatch(url, /amount=/);
    const notes = buildQuoteNotesFromRequest(request);
    assert.match(notes, /Soft wash/);
  });

  it("primaryQuoteForRequest prefers convertedQuoteId", () => {
    const quotes = [
      createQuote({
        id: "q1",
        clientName: "A",
        requestId: "r1",
        quoteKind: "primary",
      }),
      createQuote({
        id: "q2",
        clientName: "A",
        requestId: "r1",
        quoteKind: "additional",
      }),
    ];
    const hit = primaryQuoteForRequest(quotes, "r1", "q2");
    assert.equal(hit?.id, "q2");
  });
});
