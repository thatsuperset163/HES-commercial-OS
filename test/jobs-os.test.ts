import assert from "node:assert/strict";
import test from "node:test";
import {
  advanceJobStatus,
  createJob,
  formatTimeLabel,
  jobsOnDate,
} from "../lib/jobs/model.ts";
import { buildJobNextActions } from "../lib/jobs/nextActions.ts";
import { buildMonthGrid, buildWeekGlance, filterJobs } from "../lib/jobs/calendar.ts";

test("createJob defaults service and scheduled status", () => {
  const job = createJob({
    customerName: "Oak Street Church",
    scheduledDate: "2026-07-17",
    amount: 1200,
  });
  assert.equal(job.status, "scheduled");
  assert.equal(job.service, "Exterior cleaning");
  assert.equal(job.amount, 1200);
  assert.ok(job.endTime);
});

test("advanceJobStatus walks the field workflow", () => {
  let job = createJob({
    customerName: "Plaza",
    scheduledDate: "2026-07-17",
  });
  job = advanceJobStatus(job);
  assert.equal(job.status, "confirmed");
  job = advanceJobStatus(job);
  assert.equal(job.status, "en_route");
  job = advanceJobStatus(job);
  assert.equal(job.status, "in_progress");
  job = advanceJobStatus(job);
  assert.equal(job.status, "completed");
  assert.equal(advanceJobStatus(job).status, "completed");
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
        status: "completed",
        invoiceStatus: "none",
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

test("month grid and week glance share scheduled jobs", () => {
  const jobs = [
    createJob({
      customerName: "Johnson House",
      scheduledDate: "2026-07-19",
      startTime: "09:00",
      service: "Pressure Washing",
      amount: 450,
    }),
    createJob({
      customerName: "Spring House",
      scheduledDate: "2026-07-19",
      startTime: "13:30",
      service: "Window Cleaning",
      amount: 300,
    }),
  ];
  const cells = buildMonthGrid("2026-07-19", jobs);
  const day = cells.find((c) => c.dateKey === "2026-07-19");
  assert.equal(day?.jobs.length, 2);
  assert.equal(jobsOnDate(jobs, "2026-07-19").length, 2);
  assert.equal(formatTimeLabel("09:00"), "9:00 AM");

  const glance = buildWeekGlance(jobs, "2026-07-19");
  assert.equal(glance[0]?.count, 2);
  assert.equal(glance[0]?.revenue, 750);
});

test("filters exclude cancelled unless explicitly requested", () => {
  const jobs = [
    createJob({ customerName: "A", scheduledDate: "2026-07-19" }),
    {
      ...createJob({ customerName: "B", scheduledDate: "2026-07-19" }),
      status: "cancelled" as const,
    },
  ];
  const filtered = filterJobs(jobs, {
    status: "all",
    assignee: "",
    query: "",
    includeUnscheduled: true,
  });
  assert.equal(filtered.length, 2);
  assert.equal(
    filterJobs(jobs, {
      status: "scheduled",
      assignee: "",
      query: "",
      includeUnscheduled: true,
    }).length,
    1,
  );
});
