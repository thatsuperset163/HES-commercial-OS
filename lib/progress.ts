import type { BoardStore, ChecklistItem, DayEntry, MetricKey, Metrics } from "./types";
import { EMPTY_METRICS } from "./types";
import { normalizeDayEntry } from "./defaults";
import {
  formatShortDate,
  getWeekKeys,
  parseDateKey,
  toDateKey,
  todayKey,
} from "./dates";

export type ProgressRange = "week" | "month" | "quarter" | "all";

export type DateRange = {
  start: string | null; // YYYY-MM-DD inclusive; null = unbounded start
  end: string; // inclusive
  label: string;
};

export function formatRangeLabel(start: string, end: string): string {
  const a = parseDateKey(start);
  const b = parseDateKey(end);
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  const left = a.toLocaleDateString(undefined, opts);
  const right = b.toLocaleDateString(undefined, {
    ...opts,
    year: a.getFullYear() !== b.getFullYear() ? "numeric" : undefined,
  });
  if (start === end) return formatShortDate(start);
  return `${left} – ${right}`;
}

export function getProgressRange(
  kind: ProgressRange,
  anchorKey: string = todayKey()
): DateRange {
  const end = todayKey();
  const anchor = parseDateKey(anchorKey);

  if (kind === "week") {
    const keys = getWeekKeys(anchorKey);
    return {
      start: keys[0],
      end: keys[6],
      label: formatRangeLabel(keys[0], keys[6]),
    };
  }

  if (kind === "month") {
    const start = toDateKey(new Date(anchor.getFullYear(), anchor.getMonth(), 1));
    const last = toDateKey(
      new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0)
    );
    return {
      start,
      end: last < end ? last : end,
      label: formatRangeLabel(start, last < end ? last : end),
    };
  }

  if (kind === "quarter") {
    const q = Math.floor(anchor.getMonth() / 3);
    const start = toDateKey(new Date(anchor.getFullYear(), q * 3, 1));
    const last = toDateKey(new Date(anchor.getFullYear(), q * 3 + 3, 0));
    return {
      start,
      end: last < end ? last : end,
      label: formatRangeLabel(start, last < end ? last : end),
    };
  }

  // all-time — label filled by caller once store keys known
  return { start: null, end, label: "All time" };
}

export function sumMetrics(entries: DayEntry[]): Metrics {
  return entries.reduce(
    (acc, day) => {
      (Object.keys(EMPTY_METRICS) as MetricKey[]).forEach((key) => {
        acc[key] += day.metrics[key] || 0;
      });
      return acc;
    },
    { ...EMPTY_METRICS }
  );
}

function inRange(date: string, range: DateRange): boolean {
  if (range.start && date < range.start) return false;
  if (date > range.end) return false;
  return true;
}

/** Sum metrics from stored days only (no auto-create). */
export function sumMetricsInRange(
  store: BoardStore,
  range: DateRange
): Metrics {
  const entries = Object.values(store.days)
    .map((d) => normalizeDayEntry(d))
    .filter((d) => inRange(d.date, range));
  return sumMetrics(entries);
}

function listDone(lists: ChecklistItem[][]): { done: number; total: number } {
  let done = 0;
  let total = 0;
  for (const list of lists) {
    for (const item of list ?? []) {
      total += 1;
      if (item.done) done += 1;
    }
  }
  return { done, total };
}

export function checklistProgress(entry: DayEntry): { done: number; total: number } {
  const day = normalizeDayEntry(entry);
  return listDone([
    day.dailyChecklist,
    day.morningWorkChecklist,
    day.afternoonWorkChecklist,
    day.outreach,
  ]);
}

export function dayHasActivity(entry: DayEntry): boolean {
  const day = normalizeDayEntry(entry);
  const m = day.metrics;
  if (
    m.doors > 0 ||
    m.conversations > 0 ||
    m.phoneNumbers > 0 ||
    m.quotes > 0 ||
    m.jobsBooked > 0
  ) {
    return true;
  }
  if (day.notes?.trim()) return true;
  const { done } = checklistProgress(day);
  return done > 0;
}

export type HistoryRow = {
  entry: DayEntry;
  checksDone: number;
  checksTotal: number;
  score: number;
};

export function listActiveHistory(
  store: BoardStore,
  limit = 60
): HistoryRow[] {
  return Object.values(store.days)
    .map((raw) => normalizeDayEntry(raw))
    .filter(dayHasActivity)
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
    .slice(0, limit)
    .map((entry) => {
      const { done, total } = checklistProgress(entry);
      const m = entry.metrics;
      return {
        entry,
        checksDone: done,
        checksTotal: total,
        score:
          m.doors +
          m.conversations +
          m.phoneNumbers +
          m.quotes +
          m.jobsBooked,
      };
    });
}

export function allTimeRangeLabel(store: BoardStore): string {
  const keys = Object.keys(store.days).filter((k) =>
    dayHasActivity(store.days[k])
  );
  if (!keys.length) return "No activity yet";
  keys.sort();
  return formatRangeLabel(keys[0], keys[keys.length - 1]);
}

export function dayHasPersonalActivity(entry: DayEntry): boolean {
  const day = normalizeDayEntry(entry);
  if (day.dailyChecklist.some((i) => i.done)) return true;
  if (day.goals.some((g) => g.category === "personal" && g.done)) return true;
  if (day.personalNotes?.trim()) return true;
  return false;
}

export function dayHasWorkActivity(entry: DayEntry): boolean {
  const day = normalizeDayEntry(entry);
  const m = day.metrics;
  if (
    m.doors > 0 ||
    m.conversations > 0 ||
    m.phoneNumbers > 0 ||
    m.quotes > 0 ||
    m.jobsBooked > 0
  ) {
    return true;
  }
  if (day.goals.some((g) => g.category === "business" && g.done)) return true;
  if (
    day.morningWorkChecklist.some((i) => i.done) ||
    day.afternoonWorkChecklist.some((i) => i.done) ||
    day.outreach.some((i) => i.done)
  ) {
    return true;
  }
  if (day.notes?.trim()) return true;
  return false;
}

function countStreak(
  store: BoardStore,
  predicate: (entry: DayEntry) => boolean,
  endKey: string = todayKey()
): number {
  let streak = 0;
  let cursor = endKey;

  // If today has no activity yet, start from yesterday so the streak doesn't reset mid-morning
  const todayEntry = store.days[endKey];
  if (!todayEntry || !predicate(normalizeDayEntry(todayEntry))) {
    cursor = addDaysLocal(endKey, -1);
  }

  for (let i = 0; i < 400; i += 1) {
    const raw = store.days[cursor];
    if (!raw || !predicate(normalizeDayEntry(raw))) break;
    streak += 1;
    cursor = addDaysLocal(cursor, -1);
  }
  return streak;
}

function addDaysLocal(key: string, delta: number): string {
  const d = parseDateKey(key);
  d.setDate(d.getDate() + delta);
  return toDateKey(d);
}

export type RealmStreaks = {
  personal: number;
  work: number;
};

export function getRealmStreaks(
  store: BoardStore,
  endKey: string = todayKey()
): RealmStreaks {
  return {
    personal: countStreak(store, dayHasPersonalActivity, endKey),
    work: countStreak(store, dayHasWorkActivity, endKey),
  };
}
