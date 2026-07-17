import type { BoardStore, DayEntry } from "./types";
import {
  createDayEntry,
  needsMorningRebuild,
  normalizeDayEntry,
} from "./defaults";

const STORAGE_KEY = "hes-blackboard-v1";
const CLOUD_ENDPOINT = "/api/blackboard/state";
const CLOUD_SAVE_DELAY_MS = 500;

let hydrationPromise: Promise<BoardStore> | null = null;
let cloudEnabled = false;
let cloudSaveTimer: number | null = null;

function emptyStore(): BoardStore {
  return { days: {} };
}

function isBoardStore(value: unknown): value is BoardStore {
  if (!value || typeof value !== "object") return false;
  const days = (value as { days?: unknown }).days;
  return Boolean(days && typeof days === "object" && !Array.isArray(days));
}

function saveLocalStore(store: BoardStore): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

async function putCloudStore(store: BoardStore): Promise<boolean> {
  try {
    const response = await fetch(CLOUD_ENDPOINT, {
      method: "PUT",
      credentials: "same-origin",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(store),
    });
    return response.ok;
  } catch {
    return false;
  }
}

function scheduleCloudSave(store: BoardStore): void {
  if (!cloudEnabled || typeof window === "undefined") return;
  if (cloudSaveTimer) window.clearTimeout(cloudSaveTimer);
  cloudSaveTimer = window.setTimeout(() => {
    void putCloudStore(store);
  }, CLOUD_SAVE_DELAY_MS);
}

export function loadStore(): BoardStore {
  if (typeof window === "undefined") return emptyStore();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyStore();
    const parsed = JSON.parse(raw) as unknown;
    if (!isBoardStore(parsed)) return emptyStore();
    return parsed;
  } catch {
    return emptyStore();
  }
}

export function saveStore(store: BoardStore): void {
  saveLocalStore(store);
  scheduleCloudSave(store);
}

/**
 * Hydrate the shared HQ / Personal / Work store from Supabase once per page load.
 * Browser storage remains the fallback and is uploaded when the cloud is empty.
 */
export function hydrateStoreFromCloud(): Promise<BoardStore> {
  if (typeof window === "undefined") return Promise.resolve(emptyStore());
  if (hydrationPromise) return hydrationPromise;

  hydrationPromise = (async () => {
    const local = loadStore();

    try {
      const response = await fetch(CLOUD_ENDPOINT, {
        method: "GET",
        credentials: "same-origin",
        headers: { Accept: "application/json" },
      });

      if (!response.ok) return local;

      const body = (await response.json()) as { state?: unknown };
      if (!isBoardStore(body.state)) return local;

      cloudEnabled = true;
      const cloud = body.state;
      const cloudIsEmpty = Object.keys(cloud.days).length === 0;
      const localHasData = Object.keys(local.days).length > 0;

      if (cloudIsEmpty && localHasData) {
        await putCloudStore(local);
        return local;
      }

      saveLocalStore(cloud);
      return cloud;
    } catch {
      return local;
    }
  })();

  return hydrationPromise;
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
  return (
    !ids.has("train") ||
    !ids.has("golf") ||
    !ids.has("no-porn") ||
    !ids.has("no-weed") ||
    !ids.has("faith") ||
    !ids.has("people")
  );
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
