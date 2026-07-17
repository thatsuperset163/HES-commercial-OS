import type { BoardStore, DayEntry, Job } from "./types";
import {
  createDayEntry,
  needsMorningRebuild,
  normalizeDayEntry,
} from "./defaults";
import { normalizeJobs } from "./jobs/model";

const STORAGE_KEY = "hes-blackboard-v1";
const CLOUD_ENDPOINT = "/api/blackboard/state";
const CLOUD_SAVE_DELAY_MS = 500;

let hydrationPromise: Promise<BoardStore> | null = null;
let cloudEnabled = false;
let cloudSaveTimer: number | null = null;

function emptyStore(): BoardStore {
  return { days: {}, jobs: [] };
}

function normalizeStore(value: unknown): BoardStore | null {
  if (!value || typeof value !== "object") return null;
  const days = (value as { days?: unknown }).days;
  if (!days || typeof days !== "object" || Array.isArray(days)) return null;
  const jobs = normalizeJobs((value as { jobs?: unknown }).jobs);
  return { days: days as BoardStore["days"], jobs };
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
    return normalizeStore(JSON.parse(raw) as unknown) ?? emptyStore();
  } catch {
    return emptyStore();
  }
}

export function saveStore(store: BoardStore): void {
  const normalized = {
    days: store.days,
    jobs: normalizeJobs(store.jobs),
  };
  saveLocalStore(normalized);
  scheduleCloudSave(normalized);
}

/**
 * Hydrate the shared HQ / Work store from Supabase once per page load.
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
      const cloud = normalizeStore(body.state);
      if (!cloud) return local;

      cloudEnabled = true;
      const cloudIsEmpty =
        Object.keys(cloud.days).length === 0 && cloud.jobs.length === 0;
      const localHasData =
        Object.keys(local.days).length > 0 || local.jobs.length > 0;

      if (cloudIsEmpty && localHasData) {
        await putCloudStore(local);
        return local;
      }

      // Prefer cloud days; merge jobs if cloud has none but local does.
      const merged: BoardStore = {
        days: cloud.days,
        jobs: cloud.jobs.length ? cloud.jobs : local.jobs,
      };
      saveLocalStore(merged);
      return merged;
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
  const current = loadStore();
  const next: BoardStore = {
    days: {
      ...current.days,
      ...store.days,
      [entry.date]: {
        ...entry,
        updatedAt: new Date().toISOString(),
      },
    },
    jobs: normalizeJobs(store.jobs ?? current.jobs),
  };
  saveStore(next);
  return next;
}

export function listJobs(store?: BoardStore): Job[] {
  return normalizeJobs((store ?? loadStore()).jobs);
}

export function saveJobs(jobs: Job[], store?: BoardStore): BoardStore {
  const current = store ?? loadStore();
  const next: BoardStore = {
    days: current.days,
    jobs: normalizeJobs(jobs),
  };
  saveStore(next);
  return next;
}

export function upsertJob(job: Job, store?: BoardStore): BoardStore {
  const current = store ?? loadStore();
  const jobs = listJobs(current);
  const index = jobs.findIndex((row) => row.id === job.id);
  const nextJobs =
    index >= 0
      ? jobs.map((row) => (row.id === job.id ? job : row))
      : [job, ...jobs];
  return saveJobs(nextJobs, current);
}

export function removeJob(jobId: string, store?: BoardStore): BoardStore {
  const current = store ?? loadStore();
  return saveJobs(
    listJobs(current).filter((job) => job.id !== jobId),
    current,
  );
}

export function exportStoreJson(store: BoardStore): string {
  return JSON.stringify(store, null, 2);
}

export function importStoreJson(raw: string): BoardStore {
  const parsed = normalizeStore(JSON.parse(raw) as unknown);
  if (!parsed) throw new Error("Invalid blackboard file");
  saveStore(parsed);
  return parsed;
}
