import type { BoardStore, ChecklistItem, DayEntry } from "./types";
import { normalizeDayEntry } from "./defaults";
import { dayHasActivity } from "./progress";

export type InsightRow = {
  id: string;
  label: string;
  realm: "work";
  done: number;
  total: number;
  days: number;
  pct: number;
};

function pct(done: number, total: number) {
  if (!total) return 0;
  return Math.round((done / total) * 100);
}

type Agg = {
  label: string;
  realm: "work";
  done: number;
  total: number;
  days: number;
};

function bumpItem(
  map: Map<string, Agg>,
  id: string,
  label: string,
  realm: "work",
  done: boolean
) {
  const cur = map.get(id) ?? {
    label,
    realm,
    done: 0,
    total: 0,
    days: 0,
  };
  cur.label = label;
  cur.total += 1;
  cur.days += 1;
  if (done) cur.done += 1;
  map.set(id, cur);
}

function bumpSection(
  map: Map<string, Agg>,
  id: string,
  label: string,
  realm: "work",
  list: ChecklistItem[]
) {
  if (!list.length) return;
  const done = list.filter((i) => i.done).length;
  const cur = map.get(id) ?? {
    label,
    realm,
    done: 0,
    total: 0,
    days: 0,
  };
  cur.total += list.length;
  cur.done += done;
  cur.days += 1;
  map.set(id, cur);
}

function collectSections(map: Map<string, Agg>, entry: DayEntry) {
  const day = normalizeDayEntry(entry);

  bumpSection(
    map,
    "sec-morning",
    "Morning work",
    "work",
    day.morningWorkChecklist
  );
  bumpSection(
    map,
    "sec-afternoon",
    "Afternoon work",
    "work",
    day.afternoonWorkChecklist
  );
  bumpSection(map, "sec-outreach", "Commercial outreach", "work", day.outreach);
  bumpSection(map, "sec-hunt", "Hunt checklist", "work", day.huntChecklist ?? []);

  const bGoal = day.goals.find((g) => g.category === "business");
  if (bGoal) {
    bumpItem(map, "sec-business-goal", "Work goal", "work", bGoal.done);
  }
}

function collectItems(map: Map<string, Agg>, entry: DayEntry) {
  const day = normalizeDayEntry(entry);

  for (const item of day.morningWorkChecklist) {
    bumpItem(map, `work:am:${item.id}`, item.label, "work", item.done);
  }
  for (const item of day.afternoonWorkChecklist) {
    bumpItem(map, `work:pm:${item.id}`, item.label, "work", item.done);
  }
  for (const item of day.outreach) {
    bumpItem(map, `work:out:${item.id}`, item.label, "work", item.done);
  }
  for (const item of day.huntChecklist ?? []) {
    bumpItem(map, `work:hunt:${item.id}`, item.label, "work", item.done);
  }
}

function toRows(map: Map<string, Agg>, minDays: number): InsightRow[] {
  return [...map.entries()]
    .map(([id, v]) => ({
      id,
      label: v.label,
      realm: v.realm,
      done: v.done,
      total: v.total,
      days: v.days,
      pct: pct(v.done, v.total),
    }))
    .filter((r) => r.days >= minDays && r.total > 0)
    .sort((a, b) => b.pct - a.pct || b.total - a.total);
}

export type CompletionInsights = {
  daysSampled: number;
  strongest: InsightRow[];
  needsWork: InsightRow[];
  weakHabits: InsightRow[];
};

/**
 * Ranks section completion across saved days.
 * Strongest = highest %; needs work = lowest %.
 * weakHabits = specific checkbox lines that lag (when enough history).
 */
export function getCompletionInsights(
  store: BoardStore,
  opts?: { minDays?: number; limit?: number }
): CompletionInsights {
  const minDays = opts?.minDays ?? 2;
  const limit = opts?.limit ?? 3;

  const days = Object.values(store.days)
    .map((d) => normalizeDayEntry(d))
    .filter(dayHasActivity)
    .sort((a, b) => (a.date < b.date ? 1 : -1));

  const sectionMap = new Map<string, Agg>();
  const itemMap = new Map<string, Agg>();

  for (const day of days) {
    collectSections(sectionMap, day);
    collectItems(itemMap, day);
  }

  let ranked = toRows(sectionMap, Math.min(minDays, Math.max(1, days.length)));
  if (ranked.length < 2 && days.length >= 1) {
    ranked = toRows(sectionMap, 1);
  }

  const strongest = ranked.slice(0, limit);
  const strongIds = new Set(strongest.map((r) => r.id));
  const needsWork = [...ranked]
    .reverse()
    .filter((r) => !strongIds.has(r.id))
    .slice(0, limit);

  // Habits that show up often but finish rarely (rotating items need more days)
  const weakHabits = toRows(itemMap, Math.max(3, minDays))
    .filter((r) => r.pct < 60)
    .reverse()
    .slice(0, limit);

  return {
    daysSampled: days.length,
    strongest,
    needsWork,
    weakHabits,
  };
}
