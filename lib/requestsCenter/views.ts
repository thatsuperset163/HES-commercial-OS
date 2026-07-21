import { addDays, todayKey } from "../dates.ts";
import type { IntakeRequest, IntakeStatus } from "./types.ts";
import { buildRequestNextAction } from "./nextAction.ts";

export type SavedViewId =
  | "all"
  | "new_today"
  | "needs_response"
  | "follow_ups_due"
  | "site_visits"
  | "waiting"
  | "stale"
  | "converted_week"
  | "lost"
  | "high_value";

export type SavedView = {
  id: SavedViewId;
  label: string;
};

export const SAVED_VIEWS: SavedView[] = [
  { id: "all", label: "All requests" },
  { id: "new_today", label: "New today" },
  { id: "needs_response", label: "Needs response" },
  { id: "follow_ups_due", label: "Follow-ups due" },
  { id: "site_visits", label: "Site visits" },
  { id: "waiting", label: "Waiting on client" },
  { id: "stale", label: "Stale" },
  { id: "converted_week", label: "Converted this week" },
  { id: "lost", label: "Lost" },
  { id: "high_value", label: "High value" },
];

const VIEWS_KEY = "hes-requests-os-view-v1";

export function readSavedView(): {
  view: SavedViewId;
  query: string;
  status: IntakeStatus | "all";
} {
  if (typeof window === "undefined") {
    return { view: "all", query: "", status: "all" };
  }
  try {
    const raw = localStorage.getItem(VIEWS_KEY);
    if (!raw) return { view: "all", query: "", status: "all" };
    const parsed = JSON.parse(raw) as {
      view?: SavedViewId;
      query?: string;
      status?: IntakeStatus | "all";
    };
    return {
      view: parsed.view || "all",
      query: parsed.query || "",
      status: parsed.status || "all",
    };
  } catch {
    return { view: "all", query: "", status: "all" };
  }
}

export function writeSavedView(state: {
  view: SavedViewId;
  query: string;
  status: IntakeStatus | "all";
}): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(VIEWS_KEY, JSON.stringify(state));
}

function isStale(row: IntakeRequest, today: string): boolean {
  if (row.status === "approved" || row.status === "declined") return false;
  const updated = (row.updatedAt || row.createdAt || "").slice(0, 10);
  if (!updated) return false;
  return updated <= addDays(today, -7);
}

function convertedThisWeek(row: IntakeRequest, today: string): boolean {
  if (row.status !== "approved" && !row.convertedJobId) return false;
  const when = (row.updatedAt || "").slice(0, 10);
  if (!when) return false;
  const weekStart = addDays(today, -((new Date(today + "T12:00:00").getDay() + 6) % 7));
  return when >= weekStart && when <= today;
}

export function matchesSavedView(
  row: IntakeRequest,
  view: SavedViewId,
  today = todayKey(),
): boolean {
  switch (view) {
    case "all":
      return true;
    case "new_today":
      return row.status === "new" && row.dateReceived === today;
    case "needs_response":
      return row.status === "new" || row.status === "needs_response";
    case "follow_ups_due":
      return Boolean(row.followUpDate && row.followUpDate <= today) &&
        row.status !== "approved" &&
        row.status !== "declined";
    case "site_visits":
      return row.status === "estimate_scheduled";
    case "waiting":
      return row.status === "waiting_on_customer";
    case "stale":
      return isStale(row, today);
    case "converted_week":
      return convertedThisWeek(row, today);
    case "lost":
      return row.status === "declined";
    case "high_value":
      return (row.potentialValue ?? 0) >= 1000;
    default:
      return true;
  }
}

export function matchesRequestQuery(row: IntakeRequest, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const hay = [
    row.customerName,
    row.company,
    row.phone,
    row.email,
    row.address,
    row.serviceRequested,
    row.requestSource,
    row.assignedPerson,
    row.notes,
    row.status,
  ]
    .join(" ")
    .toLowerCase();
  return hay.includes(q);
}

export type RequestOpsMetrics = {
  newCount: number;
  needsResponse: number;
  siteVisits: number;
  followUpsDue: number;
  stale: number;
  convertedWeek: number;
  potentialValue: number;
  conversionRate: number | null;
};

export function buildOpsMetrics(
  rows: IntakeRequest[],
  today = todayKey(),
): RequestOpsMetrics {
  const open = rows.filter(
    (r) => r.status !== "approved" && r.status !== "declined",
  );
  const converted = rows.filter(
    (r) => r.status === "approved" || Boolean(r.convertedJobId),
  );
  const decided = rows.filter(
    (r) => r.status === "approved" || r.status === "declined",
  );
  return {
    newCount: rows.filter((r) => r.status === "new").length,
    needsResponse: rows.filter(
      (r) => r.status === "new" || r.status === "needs_response",
    ).length,
    siteVisits: rows.filter((r) => r.status === "estimate_scheduled").length,
    followUpsDue: rows.filter(
      (r) =>
        r.followUpDate &&
        r.followUpDate <= today &&
        r.status !== "approved" &&
        r.status !== "declined",
    ).length,
    stale: open.filter((r) => isStale(r, today)).length,
    convertedWeek: rows.filter((r) => convertedThisWeek(r, today)).length,
    potentialValue: open.reduce((s, r) => s + (r.potentialValue ?? 0), 0),
    conversionRate:
      decided.length > 0
        ? Math.round((converted.length / decided.length) * 100)
        : null,
  };
}

export function requestRowSignals(row: IntakeRequest, today = todayKey()) {
  const next = buildRequestNextAction(row, today);
  return {
    next,
    isExistingClient: Boolean(row.linkedClientId || row.convertedClientId),
    isOverdueFollowUp: Boolean(
      row.followUpDate &&
        row.followUpDate < today &&
        row.status !== "approved" &&
        row.status !== "declined",
    ),
    isStale: isStale(row, today),
  };
}
