import assert from "node:assert/strict";
import test from "node:test";
import { generateIntakeAi } from "../lib/requestsCenter/ai.ts";
import {
  buildDashboard,
  createIntakeRequest,
  findRecentDuplicate,
  intakeToRow,
  rowToIntake,
} from "../lib/requestsCenter/model.ts";
import { buildRequestNextAction } from "../lib/requestsCenter/nextAction.ts";
import { INTAKE_STATUSES } from "../lib/requestsCenter/types.ts";
import {
  buildOpsMetrics,
  matchesRequestQuery,
  matchesSavedView,
} from "../lib/requestsCenter/views.ts";

test("intake statuses cover the Requests Center pipeline", () => {
  assert.deepEqual([...INTAKE_STATUSES], [
    "new",
    "needs_response",
    "estimate_scheduled",
    "waiting_on_customer",
    "approved",
    "declined",
  ]);
});

test("create + row round-trip preserves core and OS fields", () => {
  const created = createIntakeRequest({
    customerName: "Amy Stone",
    company: "Stone Co",
    phone: "555-0100",
    serviceRequested: "Pressure washing",
    requestSource: "website",
    priority: "high",
    followUpDate: "2026-07-22",
    potentialValue: 1500,
    propertyType: "residential",
  });
  const row = intakeToRow(created);
  const back = rowToIntake(row);
  assert.equal(back.customerName, "Amy Stone");
  assert.equal(back.company, "Stone Co");
  assert.equal(back.priority, "high");
  assert.equal(back.requestSource, "website");
  assert.equal(back.followUpDate, "2026-07-22");
  assert.equal(back.potentialValue, 1500);
  assert.equal(back.propertyType, "residential");
});

test("AI assist returns usable triage copy", () => {
  const req = createIntakeRequest({
    customerName: "Bob",
    serviceRequested: "Commercial plaza wash",
    requestSource: "phone",
    priority: "urgent",
  });
  const ai = generateIntakeAi(req);
  assert.match(ai.aiSummary, /Bob|Commercial/i);
  assert.match(ai.aiSuggestedReply, /Harris Exterior/i);
  assert.match(ai.aiPriceEstimate, /\$/);
  assert.ok(ai.aiUpsellSuggestions.length > 10);
});

test("dashboard counts by status", () => {
  const rows = [
    createIntakeRequest({ customerName: "A", status: "new" }),
    createIntakeRequest({ customerName: "B", status: "new" }),
    createIntakeRequest({ customerName: "C", status: "approved" }),
  ];
  const dash = buildDashboard(rows);
  assert.equal(dash.new, 2);
  assert.equal(dash.approved, 1);
  assert.equal(dash.declined, 0);
});

test("next action prioritizes overdue follow-up", () => {
  const req = createIntakeRequest({
    customerName: "Amy",
    status: "needs_response",
    followUpDate: "2026-07-01",
  });
  const next = buildRequestNextAction(req, "2026-07-21");
  assert.equal(next.title, "Overdue follow-up");
  assert.equal(next.urgency, "overdue");
});

test("findRecentDuplicate matches phone within window", () => {
  const existing = [
    createIntakeRequest({
      customerName: "Amy",
      phone: "(336) 555-0100",
      createdAt: new Date().toISOString(),
    }),
  ];
  const hit = findRecentDuplicate(existing, { phone: "3365550100" });
  assert.equal(hit?.id, existing[0]?.id);
});

test("saved views and search filter requests", () => {
  const rows = [
    createIntakeRequest({
      customerName: "Amy",
      status: "new",
      dateReceived: "2026-07-21",
      potentialValue: 2000,
    }),
    createIntakeRequest({
      customerName: "Bob",
      status: "declined",
      declineReason: "Price",
    }),
  ];
  assert.equal(matchesSavedView(rows[0]!, "new_today", "2026-07-21"), true);
  assert.equal(matchesSavedView(rows[1]!, "lost", "2026-07-21"), true);
  assert.equal(matchesRequestQuery(rows[0]!, "amy"), true);
  const metrics = buildOpsMetrics(rows, "2026-07-21");
  assert.equal(metrics.newCount, 1);
  assert.ok(metrics.potentialValue >= 2000);
});
