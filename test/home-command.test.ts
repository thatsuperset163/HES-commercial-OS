import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildClearDayMessage,
  buildHomeGreeting,
  buildTodayAttention,
} from "../lib/home/commandCenter.ts";
import type { Job } from "../lib/jobs/types.ts";
import type { BoardStore } from "../lib/types.ts";
import { createQuote } from "../lib/work/model.ts";

function emptyStore(overrides: Partial<BoardStore> = {}): BoardStore {
  return {
    version: 1,
    days: {},
    jobs: [],
    clients: [],
    requests: [],
    quotes: [],
    invoices: [],
    tasks: [],
    expenses: [],
    ...overrides,
  } as BoardStore;
}

describe("home command center", () => {
  it("greets by time of day", () => {
    const g = buildHomeGreeting("Will");
    assert.match(g, /^Good (morning|afternoon|evening), Will$/);
  });

  it("surfaces overdue tasks ahead of soon items", () => {
    const store = emptyStore({
      tasks: [
        {
          id: "t1",
          title: "Call supplier",
          dueDate: "2000-01-01",
          status: "open",
          notes: "",
          createdAt: "",
          updatedAt: "",
        },
      ],
      quotes: [
        createQuote({
          clientName: "Later Co",
          scope: "Draft later",
          followUpDate: "2099-01-01",
        }),
      ],
    });
    const items = buildTodayAttention(store, [], 5);
    assert.equal(items[0]?.title, "Call supplier");
    assert.equal(items[0]?.urgency, "overdue");
  });

  it("clear-day message looks ahead for the next job", () => {
    const jobs = [
      {
        id: "j1",
        customerName: "Next Client",
        scheduledDate: "2099-06-15",
        startTime: "10:00",
        status: "scheduled",
      } as Job,
    ];
    const msg = buildClearDayMessage(jobs, "2099-06-01");
    assert.match(msg, /clear for today/i);
    assert.match(msg, /10:00/);
  });
});
