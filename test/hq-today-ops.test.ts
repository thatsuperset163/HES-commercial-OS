import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildHqExceptions,
  buildHqQuoteItems,
  buildHqRequestItems,
  buildHqTodaySections,
  buildHqWeekGlance,
  prioritizeHqToday,
} from "../lib/home/todayOps.ts";
import type { Job } from "../lib/jobs/types.ts";
import type { IntakeRequest } from "../lib/requestsCenter/types.ts";
import { createQuote } from "../lib/work/model.ts";

function makeRequest(
  overrides: Partial<IntakeRequest> & Pick<IntakeRequest, "id" | "status">,
): IntakeRequest {
  return {
    customerName: "Acme Client",
    company: "Acme Co",
    phone: "",
    email: "",
    address: "",
    serviceRequested: "Windows",
    requestSource: "phone",
    priority: "normal",
    notes: "",
    dateReceived: "2026-07-20",
    estimateDate: null,
    estimateTime: "",
    assignedPerson: "",
    directions: "",
    estimateNotes: "",
    waitingReason: "",
    declineReason: "",
    declineNotes: "",
    convertedClientId: null,
    convertedJobId: null,
    convertedInvoiceId: null,
    convertedQuoteId: null,
    linkedClientId: null,
    followUpDate: null,
    followUpType: "",
    followUpNotes: "",
    potentialValue: 1200,
    propertyType: "",
    siteVisitOutcome: "",
    aiSummary: "",
    aiSuggestedReply: "",
    aiPriceEstimate: "",
    aiUpsellSuggestions: "",
    internalNotes: "",
    attachments: [],
    photos: [],
    createdAt: "2026-07-20T12:00:00.000Z",
    updatedAt: "2026-07-20T12:00:00.000Z",
    ...overrides,
  };
}

describe("hq today ops", () => {
  it("includes actionable intake requests and skips waiting without overdue date", () => {
    const today = "2026-07-21";
    const items = buildHqRequestItems(
      [
        makeRequest({ id: "r-new", status: "new" }),
        makeRequest({
          id: "r-wait",
          status: "waiting_on_customer",
          followUpDate: "2026-07-25",
        }),
        makeRequest({
          id: "r-over",
          status: "waiting_on_customer",
          followUpDate: "2026-07-18",
        }),
      ],
      today,
    );
    const ids = items.map((i) => i.entityId);
    assert.ok(ids.includes("r-new"));
    assert.ok(ids.includes("r-over"));
    assert.ok(!ids.includes("r-wait"));
  });

  it("prioritizes overdue ahead of new", () => {
    const ranked = prioritizeHqToday([
      {
        id: "a",
        kind: "request",
        entityId: "a",
        urgency: "new",
        urgencyLabel: "New",
        title: "New",
        detail: "",
        meta: "",
        href: "/",
        actionLabel: "Open",
      },
      {
        id: "b",
        kind: "request",
        entityId: "b",
        urgency: "overdue",
        urgencyLabel: "Overdue",
        title: "Over",
        detail: "",
        meta: "",
        href: "/",
        actionLabel: "Open",
      },
    ]);
    assert.equal(ranked[0]?.urgency, "overdue");
  });

  it("surfaces sent quote follow-ups due today and skips won", () => {
    const today = "2026-07-21";
    const due = createQuote({
      clientName: "Due Co",
      followUpDate: today,
      status: "sent",
    });
    const won = createQuote({
      clientName: "Won Co",
      followUpDate: today,
      status: "won",
    });
    const later = createQuote({
      clientName: "Later Co",
      followUpDate: "2026-07-28",
      status: "sent",
    });
    const items = buildHqQuoteItems([due, won, later], today);
    assert.equal(items.length, 1);
    assert.equal(items[0]?.title, "Due Co");
  });

  it("builds today sections from live sources only", () => {
    const today = "2026-07-21";
    const jobs = [
      {
        id: "j1",
        customerName: "Today Job",
        scheduledDate: today,
        startTime: "09:00",
        status: "scheduled",
        address: "1 Main",
        service: "Windows",
        amount: 400,
      } as Job,
      {
        id: "j2",
        customerName: "Tomorrow Job",
        scheduledDate: "2026-07-22",
        startTime: "09:00",
        status: "scheduled",
        address: "2 Main",
        service: "Windows",
        amount: 400,
      } as Job,
    ];
    const sections = buildHqTodaySections({
      requests: [makeRequest({ id: "r1", status: "new" })],
      jobs,
      quotes: [
        createQuote({
          clientName: "Q",
          followUpDate: today,
          status: "sent",
        }),
      ],
      today,
    });
    assert.equal(sections.jobs.length, 1);
    assert.equal(sections.jobs[0]?.entityId, "j1");
    assert.ok(sections.requests.length >= 1);
    assert.equal(sections.quotes.length, 1);
  });

  it("week glance uses Mon–Sun and marks follow-ups", () => {
    // 2026-07-21 is Tuesday → week Mon 20 – Sun 26
    const days = buildHqWeekGlance({
      jobs: [
        {
          id: "j1",
          customerName: "A",
          scheduledDate: "2026-07-20",
          status: "scheduled",
          amount: 500,
        } as Job,
      ],
      quotes: [
        createQuote({
          clientName: "Q",
          followUpDate: "2026-07-22",
          status: "sent",
        }),
      ],
      requests: [
        makeRequest({
          id: "r1",
          status: "needs_response",
          followUpDate: "2026-07-22",
        }),
      ],
      today: "2026-07-21",
    });
    assert.equal(days.length, 7);
    assert.equal(days[0]?.dateKey, "2026-07-20");
    assert.equal(days[0]?.jobCount, 1);
    assert.equal(days[0]?.jobValue, 500);
    const wed = days.find((d) => d.dateKey === "2026-07-22");
    assert.equal(wed?.requestFollowUps, 1);
    assert.equal(wed?.quoteFollowUps, 1);
  });

  it("exceptions include schedule conflicts", () => {
    const today = "2026-07-21";
    const ex = buildHqExceptions({
      jobs: [
        {
          id: "a",
          customerName: "A",
          scheduledDate: today,
          startTime: "09:00",
          endTime: "11:00",
          status: "confirmed",
          address: "1 Main",
        } as Job,
        {
          id: "b",
          customerName: "B",
          scheduledDate: today,
          startTime: "10:00",
          endTime: "12:00",
          status: "confirmed",
          address: "2 Main",
        } as Job,
      ],
      quotes: [],
      requests: [],
      today,
    });
    assert.ok(ex.some((row) => row.title === "Schedule conflict"));
  });
});
