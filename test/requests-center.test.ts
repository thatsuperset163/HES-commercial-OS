import assert from "node:assert/strict";
import test from "node:test";
import { generateIntakeAi } from "../lib/requestsCenter/ai.ts";
import {
  buildDashboard,
  createIntakeRequest,
  intakeToRow,
  rowToIntake,
} from "../lib/requestsCenter/model.ts";
import { INTAKE_STATUSES } from "../lib/requestsCenter/types.ts";

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

test("create + row round-trip preserves core fields", () => {
  const created = createIntakeRequest({
    customerName: "Amy Stone",
    company: "Stone Co",
    phone: "555-0100",
    serviceRequested: "House soft wash",
    requestSource: "website",
    priority: "high",
  });
  const row = intakeToRow(created);
  const back = rowToIntake(row);
  assert.equal(back.customerName, "Amy Stone");
  assert.equal(back.company, "Stone Co");
  assert.equal(back.priority, "high");
  assert.equal(back.requestSource, "website");
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
