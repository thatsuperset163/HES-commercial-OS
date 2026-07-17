import assert from "node:assert/strict";
import test from "node:test";
import { advanceJobStatus, createJob } from "../lib/jobs/model.ts";
import { buildJobNextActions } from "../lib/jobs/nextActions.ts";

test("createJob defaults service and scheduled status", () => {
  const job = createJob({
    customerName: "Oak Street Church",
    scheduledDate: "2026-07-17",
    amount: 1200,
  });
  assert.equal(job.status, "scheduled");
  assert.equal(job.service, "Exterior cleaning");
  assert.equal(job.amount, 1200);
});

test("advanceJobStatus moves scheduled → done → invoiced", () => {
  const job = createJob({
    customerName: "Plaza",
    scheduledDate: "2026-07-17",
  });
  const done = advanceJobStatus(job);
  assert.equal(done.status, "done");
  const invoiced = advanceJobStatus(done);
  assert.equal(invoiced.status, "invoiced");
  assert.equal(advanceJobStatus(invoiced).status, "invoiced");
});

test("buildJobNextActions ranks overdue and unbilled ahead of soon", () => {
  const now = new Date("2026-07-17T15:00:00");
  const actions = buildJobNextActions(
    [
      createJob({
        customerName: "Soon Co",
        scheduledDate: "2026-07-18",
        amount: 5000,
      }),
      {
        ...createJob({
          customerName: "Done Co",
          scheduledDate: "2026-07-16",
          amount: 800,
        }),
        status: "done",
      },
      createJob({
        customerName: "Late Co",
        scheduledDate: "2026-07-15",
        amount: 300,
      }),
    ],
    now,
  );
  assert.equal(actions[0]?.customerName, "Late Co");
  assert.equal(actions[0]?.urgency, "overdue");
  assert.equal(actions[1]?.customerName, "Done Co");
  assert.equal(actions[1]?.urgency, "money");
});
