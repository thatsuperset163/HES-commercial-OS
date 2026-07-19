import assert from "node:assert/strict";
import test from "node:test";
import {
  CREATE_NEW_OPTIONS,
  getCreateNewOption,
} from "../lib/createNew/catalog.ts";
import {
  blockedTimeDefaults,
  quoteVisitDefaults,
  tasksToOverlays,
} from "../lib/createNew/scheduleOverlays.ts";

test("Create New menu lists schedule and record options", () => {
  const ids = CREATE_NEW_OPTIONS.map((o) => o.id);
  assert.deepEqual(
    ids,
    [
      "job",
      "request",
      "quote_visit",
      "task",
      "blocked_time",
      "client",
      "quote",
      "invoice",
      "expense",
    ],
  );
  assert.equal(getCreateNewOption("job").onCalendar, true);
  assert.equal(getCreateNewOption("client").onCalendar, false);
  assert.equal(getCreateNewOption("invoice").onCalendar, false);
});

test("quote visit and blocked time presets are dated", () => {
  const visit = quoteVisitDefaults("2026-07-22", "10:00");
  assert.equal(visit.scheduledDate, "2026-07-22");
  assert.equal(visit.service, "Quote Visit");
  const block = blockedTimeDefaults("2026-07-22", "13:00");
  assert.equal(block.customerName, "Blocked time");
  assert.equal(block.service, "Blocked Time");
});

test("open tasks with due dates become calendar overlays", () => {
  const overlays = tasksToOverlays([
    {
      id: "t1",
      title: "Call plumber supplier",
      dueDate: "2026-07-22",
      status: "open",
      notes: "",
      createdAt: "",
      updatedAt: "",
    },
    {
      id: "t2",
      title: "Done already",
      dueDate: "2026-07-22",
      status: "done",
      notes: "",
      createdAt: "",
      updatedAt: "",
    },
  ]);
  assert.equal(overlays.length, 1);
  assert.equal(overlays[0]?.title, "Call plumber supplier");
});
