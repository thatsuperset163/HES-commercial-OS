import assert from "node:assert/strict";
import test from "node:test";
import {
  PERSONAL_PILLAR_IDS,
  PERSONAL_PILLARS,
} from "../lib/personalPillars.ts";

test("personal pillars are six fixed personal-only items", () => {
  assert.equal(PERSONAL_PILLARS.length, 6);
  assert.deepEqual([...PERSONAL_PILLAR_IDS], [
    "train",
    "golf",
    "no-porn",
    "no-weed",
    "faith",
    "people",
  ]);
  assert.ok(PERSONAL_PILLARS.every((item) => item.label.trim().length > 0));
  assert.ok(!PERSONAL_PILLAR_IDS.includes("business" as never));
});
