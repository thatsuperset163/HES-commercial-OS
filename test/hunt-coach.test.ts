import assert from "node:assert/strict";
import test from "node:test";
import {
  buildHuntChecklist,
  getHuntPlanForDate,
  getNextHuntAction,
  HUNT_WEEK,
  normalizeHuntChecklist,
} from "../lib/huntCoach.ts";

test("hunt week covers every weekday once", () => {
  const days = HUNT_WEEK.map((plan) => plan.weekday).sort();
  assert.deepEqual(days, [0, 1, 2, 3, 4, 5, 6]);
  assert.ok(HUNT_WEEK.every((plan) => plan.actions.length === 5));
});

test("Friday plan is convert / close day", () => {
  // 2026-07-17 is a Friday
  const plan = getHuntPlanForDate("2026-07-17");
  assert.equal(plan.weekday, 5);
  assert.match(plan.name, /Friday/i);
  assert.match(plan.mission, /quote|decision|referral/i);
});

test("next hunt action is the first incomplete item", () => {
  const list = buildHuntChecklist("2026-07-17");
  assert.equal(getNextHuntAction(list)?.id, list[0]?.id);
  list[0].done = true;
  assert.equal(getNextHuntAction(list)?.id, list[1]?.id);
  for (const item of list) item.done = true;
  assert.equal(getNextHuntAction(list), null);
});

test("normalizeHuntChecklist preserves done flags by id", () => {
  const seeded = buildHuntChecklist("2026-07-17").map((item, index) => ({
    ...item,
    done: index === 0,
  }));
  const next = normalizeHuntChecklist("2026-07-17", seeded);
  assert.equal(next[0]?.done, true);
  assert.equal(next[1]?.done, false);
});
