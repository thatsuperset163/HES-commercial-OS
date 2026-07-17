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

export type BlackboardCloudStatus =
  | "loading"
  | "synced"
  | "saving"
  | "local"
  | "offline"
  | "error";

let hydrationPromise: Promise<BoardStore> | null = null;
let cloudEnabled = false;
let cloudSaveTimer: number | null = null;
let cloudStatus: BlackboardCloudStatus = "loading";
let localOnlyAlerted = false;
let saveErrorAlerted = false;
const statusListeners = new Set<(status: BlackboardCloudStatus) => void>();

function emptyStore(): BoardStore {
  return { days: {}, jobs: [], ideaLot: "" };
}

function setCloudStatus(next: BlackboardCloudStatus): void {
  if (cloudStatus === next) return;
  cloudStatus = next;
  statusListeners.forEach((listener) => listener(next));
}

export function getBlackboardCloudStatus(): BlackboardCloudStatus {
  return cloudStatus;
}

export function subscribeBlackboardCloudStatus(
  listener: (status: BlackboardCloudStatus) => void,
): () => void {
  statusListeners.add(listener);
  listener(cloudStatus);
  return () => {
    statusListeners.delete(listener);
  };
}

export function blackboardCloudStatusLabel(
  status: BlackboardCloudStatus,
): string {
  switch (status) {
    case "loading":
      return "Checking cloud…";
    case "synced":
      return "Cloud synced";
    case "saving":
      return "Saving…";
    case "local":
      return "Local only";
    case "offline":
      return "Cloud offline";
    case "error":
      return "Save error";
  }
}

function normalizeStore(value: unknown): BoardStore | null {
  if (!value || typeof value !== "object") return null;
  const days = (value as { days?: unknown }).days;
  if (!days || typeof days !== "object" || Array.isArray(days)) return null;
  const jobs = normalizeJobs((value as { jobs?: unknown }).jobs);
  const ideaLotRaw = (value as { ideaLot?: unknown }).ideaLot;
  const ideaLot = typeof ideaLotRaw === "string" ? ideaLotRaw : "";
  return { days: days as BoardStore["days"], jobs, ideaLot };
}

function storeHasData(store: BoardStore): boolean {
  return Object.keys(store.days).length > 0 || store.jobs.length > 0;
}

function newerIso(a: string | undefined, b: string | undefined): boolean {
  return (a ?? "") >= (b ?? "");
}

function mergeDays(
  local: BoardStore["days"],
  cloud: BoardStore["days"],
): BoardStore["days"] {
  const keys = new Set([...Object.keys(local), ...Object.keys(cloud)]);
  const out: BoardStore["days"] = {};
  for (const key of keys) {
    const left = local[key];
    const right = cloud[key];
    if (!left) out[key] = right;
    else if (!right) out[key] = left;
    else out[key] = newerIso(right.updatedAt, left.updatedAt) ? right : left;
  }
  return out;
}

function mergeJobs(local: Job[], cloud: Job[]): Job[] {
  const map = new Map<string, Job>();
  for (const job of local) map.set(job.id, job);
  for (const job of cloud) {
    const existing = map.get(job.id);
    if (!existing || newerIso(job.updatedAt, existing.updatedAt)) {
      map.set(job.id, job);
    }
  }
  return [...map.values()].sort((a, b) =>
    newerIso(b.updatedAt, a.updatedAt) ? 1 : -1,
  );
}

function mergeStores(local: BoardStore, cloud: BoardStore): BoardStore {
  const localIdea = local.ideaLot?.trim() ?? "";
  const cloudIdea = cloud.ideaLot?.trim() ?? "";
  return {
    days: mergeDays(local.days, cloud.days),
    jobs: mergeJobs(local.jobs, cloud.jobs),
    ideaLot: localIdea || cloudIdea,
  };
}

function storesEqual(a: BoardStore, b: BoardStore): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function saveLocalStore(store: BoardStore): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

function alertLocalOnly(): void {
  if (localOnlyAlerted || typeof window === "undefined") return;
  localOnlyAlerted = true;
  window.setTimeout(() => {
    window.alert(
      "HQ / Jobs cloud is not available on this deployment. " +
        "Personal days and jobs will only save in this browser and can disappear. " +
        "Add NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, and " +
        "SUPABASE_SERVICE_ROLE_KEY on Vercel, then redeploy.",
    );
  }, 600);
}

function alertSaveFailed(): void {
  if (saveErrorAlerted || typeof window === "undefined") return;
  saveErrorAlerted = true;
  window.alert(
    "Cloud save failed. Your latest HQ / Jobs edits may only be on this device. " +
      "Check the sync status in the sidebar and confirm Supabase env vars on Vercel.",
  );
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
  setCloudStatus("saving");
  cloudSaveTimer = window.setTimeout(() => {
    void putCloudStore(store).then((ok) => {
      if (ok) {
        saveErrorAlerted = false;
        setCloudStatus("synced");
        return;
      }
      setCloudStatus("error");
      alertSaveFailed();
    });
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
    ideaLot: store.ideaLot ?? "",
  };
  saveLocalStore(normalized);
  scheduleCloudSave(normalized);
}

/**
 * Hydrate the shared HQ / Work store from Supabase once per page load.
 * Browser storage remains the fallback. Never replace local data with an
 * empty or weaker cloud payload — merge by updatedAt and warn when local-only.
 */
export function hydrateStoreFromCloud(): Promise<BoardStore> {
  if (typeof window === "undefined") return Promise.resolve(emptyStore());
  if (hydrationPromise) return hydrationPromise;

  setCloudStatus("loading");
  hydrationPromise = (async () => {
    const local = loadStore();

    try {
      const response = await fetch(CLOUD_ENDPOINT, {
        method: "GET",
        credentials: "same-origin",
        headers: { Accept: "application/json" },
      });

      if (response.status === 503) {
        cloudEnabled = false;
        setCloudStatus("local");
        alertLocalOnly();
        return local;
      }

      if (!response.ok) {
        cloudEnabled = false;
        setCloudStatus("offline");
        return local;
      }

      const body = (await response.json()) as {
        ok?: boolean;
        state?: unknown;
        reason?: string;
      };

      if (body.ok === false) {
        cloudEnabled = false;
        if (body.reason === "supabase_not_configured") {
          setCloudStatus("local");
          alertLocalOnly();
        } else {
          setCloudStatus("offline");
        }
        return local;
      }

      const cloud = normalizeStore(body.state) ?? emptyStore();
      cloudEnabled = true;

      const cloudEmpty = !storeHasData(cloud);
      const localHasData = storeHasData(local);

      if (cloudEmpty && localHasData) {
        const pushed = await putCloudStore(local);
        setCloudStatus(pushed ? "synced" : "error");
        if (!pushed) alertSaveFailed();
        return local;
      }

      if (cloudEmpty) {
        setCloudStatus("synced");
        return local;
      }

      const merged = mergeStores(local, cloud);
      saveLocalStore(merged);

      if (!storesEqual(merged, cloud)) {
        const pushed = await putCloudStore(merged);
        setCloudStatus(pushed ? "synced" : "error");
        if (!pushed) alertSaveFailed();
      } else {
        setCloudStatus("synced");
      }

      return merged;
    } catch {
      cloudEnabled = false;
      setCloudStatus("offline");
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
    ideaLot: store.ideaLot ?? current.ideaLot ?? "",
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
    ideaLot: current.ideaLot ?? "",
  };
  saveStore(next);
  return next;
}

export function saveIdeaLot(text: string, store?: BoardStore): BoardStore {
  const current = store ?? loadStore();
  const next: BoardStore = {
    days: current.days,
    jobs: current.jobs,
    ideaLot: text,
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
