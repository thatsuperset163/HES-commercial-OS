import type { BoardStore, DayEntry } from "./types";
import {
  createDayEntry,
  needsMorningRebuild,
  normalizeDayEntry,
} from "./defaults";

const STORAGE_KEY = "hes-blackboard-v1";

export function loadStore(): BoardStore {
  if (typeof window === "undefined") return { days: {} };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { days: {} };
    const parsed = JSON.parse(raw) as BoardStore;
    if (!parsed?.days || typeof parsed.days !== "object") return { days: {} };
    return parsed;
  } catch {
    return { days: {} };
  }
}

export function saveStore(store: BoardStore): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

function looksLikeLegacyOutreach(entry: DayEntry): boolean {
  const outreach = entry.outreach as unknown;
  if (!Array.isArray(outreach) || outreach.length === 0) return true;
  return outreach.some(
    (item) => item && typeof item === "object" && "name" in item
  );
}

function needsDailyRebuild(entry: DayEntry): boolean {
  const list = entry.dailyChecklist;
  if (!list?.length) return true;
  const ids = new Set(list.map((i) => i.id));
  return !ids.has("golf-touch") || !ids.has("no-screens");
}

function needsGoalsRebuild(entry: DayEntry): boolean {
  const goals = entry.goals;
  if (!goals || goals.length !== 2) return true;
  const [a, b] = goals;
  if (a.category !== "personal" || b.category !== "business") return true;
  if (!a.text?.trim() || !b.text?.trim()) return true;
  return false;
}

export function getOrCreateDay(store: BoardStore, date: string): DayEntry {
  const existing = store.days[date];
  if (!existing) return createDayEntry(date);
  const normalized = normalizeDayEntry(existing);
  if (
    looksLikeLegacyOutreach(existing) ||
    needsDailyRebuild(existing) ||
    needsMorningRebuild(
      existing.morningWorkChecklist ?? existing.morningChecklist
    ) ||
    needsGoalsRebuild(existing)
  ) {
    upsertDay(store, normalized);
  }
  return normalized;
}

export function upsertDay(store: BoardStore, entry: DayEntry): BoardStore {
  const next: BoardStore = {
    days: {
      ...store.days,
      [entry.date]: {
        ...entry,
        updatedAt: new Date().toISOString(),
      },
    },
  };
  saveStore(next);
  return next;
}

export function exportStoreJson(store: BoardStore): string {
  return JSON.stringify(store, null, 2);
}

export function importStoreJson(raw: string): BoardStore {
  const parsed = JSON.parse(raw) as BoardStore;
  if (!parsed?.days || typeof parsed.days !== "object") {
    throw new Error("Invalid blackboard file");
  }
  saveStore(parsed);
  return parsed;
}
