import assert from "node:assert/strict";
import test from "node:test";
import { WORK_DESKS } from "../lib/work/catalog.ts";
import {
  createClient,
  createQuote,
  createRequest,
  normalizeQuotes,
} from "../lib/work/model.ts";
import { buildPipelineCounts, buildPipelineNextActions } from "../lib/work/pipeline.ts";
import { getHuntActionMeta, getHuntPlanForDate } from "../lib/huntCoach.ts";

test("work desks cover the steady pipeline", () => {
  const ids = WORK_DESKS.map((desk) => desk.id);
  assert.deepEqual(ids, [
    "requests",
    "clients",
    "quotes",
    "jobs",
    "invoices",
    "tasks",
    "expenses",
  ]);
  assert.ok(WORK_DESKS.every((desk) => desk.href.startsWith("/work/")));
});

test("quote create + normalize round-trips", () => {
  const quote = createQuote({
    clientName: "Plaza Manager",
    scope: "Storefront wash",
    amount: 450,
  });
  assert.equal(quote.status, "draft");
  const list = normalizeQuotes([quote]);
  assert.equal(list[0]?.clientName, "Plaza Manager");
  assert.equal(list[0]?.amount, 450);
});

test("pipeline next actions surface new requests and draft quotes", () => {
  const store = {
    days: {},
    jobs: [],
    clients: [createClient({ name: "Amy" })],
    requests: [createRequest({ clientName: "Bob", summary: "House wash" })],
    tasks: [],
    quotes: [createQuote({ clientName: "Bob", scope: "House wash", amount: 300 })],
    invoices: [],
    expenses: [],
  };
  const counts = buildPipelineCounts(store);
  assert.ok((counts.find((c) => c.id === "requests")?.attention ?? 0) >= 1);
  const actions = buildPipelineNextActions(store);
  assert.ok(actions.some((action) => action.deskId === "requests"));
  assert.ok(actions.some((action) => action.href === "/work/quotes"));
});

test("Friday hunt actions deep-link to Quotes", () => {
  const plan = getHuntPlanForDate("2026-07-17");
  assert.match(plan.name, /Friday/i);
  const first = plan.actions[0];
  assert.ok(first);
  assert.equal(first.href, "/work/quotes");
  assert.equal(getHuntActionMeta("2026-07-17", first.id)?.cta, "Go to Quotes");
});
