import assert from "node:assert/strict";
import test from "node:test";

import { opportunityPayload, taskPayload } from "../lib/sales/payloads.ts";
import { optionalQueryNumber, pageRange, parsePage } from "../lib/sales/query.ts";

test("pagination is bounded and deterministic", () => {
  const page = parsePage(
    new URLSearchParams("page=3&pageSize=20&sort=name&direction=asc"),
    ["name", "created_at"],
  );
  assert.deepEqual(page, { page: 3, pageSize: 20, sort: "name", direction: "asc" });
  assert.deepEqual(pageRange(page), [40, 59]);
  assert.throws(
    () => parsePage(new URLSearchParams("pageSize=101"), ["created_at"]),
    /pageSize/,
  );
  assert.throws(
    () => parsePage(new URLSearchParams("sort=archived_at"), ["created_at"]),
    /sort/,
  );
});

test("numeric filters reject invalid and negative values", () => {
  assert.equal(optionalQueryNumber(new URLSearchParams("minJobValue=125.50"), "minJobValue"), 125.5);
  assert.throws(
    () => optionalQueryNumber(new URLSearchParams("minJobValue=-1"), "minJobValue"),
    /non-negative/,
  );
});

test("opportunity payload whitelists fields and normalizes dates", () => {
  const payload = opportunityPayload({
    company_id: " company-1 ",
    stage_id: "prospecting",
    name: " Exterior cleaning ",
    estimated_job_value: 1250,
    next_follow_up_at: "2026-07-20",
    archived_at: "malicious",
  });
  assert.equal(payload.company_id, "company-1");
  assert.equal(payload.name, "Exterior cleaning");
  assert.equal(payload.estimated_job_value, 1250);
  assert.equal(payload.next_follow_up_at, "2026-07-20T00:00:00.000Z");
  assert.equal("archived_at" in payload, false);
});

test("task validation requires an owning sales entity", () => {
  assert.throws(() => taskPayload({ title: "Call customer" }), /must reference/);
  assert.deepEqual(taskPayload({ title: "Call customer", company_id: "company-1" }), {
    company_id: "company-1",
    title: "Call customer",
  });
});
