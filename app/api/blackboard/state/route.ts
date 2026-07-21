import { NextResponse } from "next/server";
import {
  backfillClientLinks,
  remapStoreClientIds,
} from "@/lib/clients/backfill";
import { dedupeClients, logClientEvent } from "@/lib/clients/identity";
import { normalizeJobs } from "@/lib/jobs/model";
import {
  getSupabaseAdmin,
  getSupabaseServiceRole,
  supabaseConfigured,
  supabaseServiceRoleConfigured,
} from "@/lib/supabase";
import type { BoardStore } from "@/lib/types";
import {
  normalizeClients,
  normalizeExpenses,
  normalizeInvoices,
  normalizeQuotes,
  normalizeRequests,
  normalizeTasks,
} from "@/lib/work/model";

function notConfigured() {
  return NextResponse.json(
    { ok: false, reason: "supabase_not_configured" },
    { status: 503 },
  );
}

function blackboardClient() {
  // Prefer service role for durable whole-site writes; anon still works while
  // blackboard_workspace keeps its open RLS policy.
  return getSupabaseServiceRole() ?? getSupabaseAdmin();
}

/** Enforce canonical client identity before cloud write. */
function sanitizeIncomingState(state: unknown): unknown {
  if (!state || typeof state !== "object") return state;
  const raw = state as Record<string, unknown>;
  if (!raw.days || typeof raw.days !== "object") return state;

  const clients = normalizeClients(raw.clients);
  const { clients: unique, idMap, removedCount } = dedupeClients(clients);
  if (removedCount > 0) {
    logClientEvent("api_put_deduped_clients", {
      removedCount,
      remaining: unique.length,
    });
  }

  let next = {
    days: raw.days,
    jobs: normalizeJobs(raw.jobs),
    clients: unique,
    requests: normalizeRequests(raw.requests),
    tasks: normalizeTasks(raw.tasks),
    quotes: normalizeQuotes(raw.quotes),
    invoices: normalizeInvoices(raw.invoices),
    expenses: normalizeExpenses(raw.expenses),
    clientLinkFlags: Array.isArray(raw.clientLinkFlags)
      ? raw.clientLinkFlags
      : [],
    ideaLot: typeof raw.ideaLot === "string" ? raw.ideaLot : "",
  } as BoardStore;

  next = remapStoreClientIds(next, idMap);
  const backfilled = backfillClientLinks(next);
  if (backfilled.linked > 0) {
    logClientEvent("api_put_backfilled_client_links", {
      linked: backfilled.linked,
      flagged: backfilled.flags.length,
    });
  }
  return { ...raw, ...backfilled.store };
}

export async function GET() {
  if (!supabaseConfigured()) return notConfigured();

  const supabase = blackboardClient();
  if (!supabase) return notConfigured();

  const { data, error } = await supabase
    .from("blackboard_workspace")
    .select("state, updated_at")
    .eq("id", "default")
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { ok: false, reason: "load_failed", message: error.message },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    state: data?.state ?? {
      days: {},
      jobs: [],
      clients: [],
      requests: [],
      tasks: [],
      quotes: [],
      invoices: [],
      expenses: [],
    },
    updatedAt: data?.updated_at ?? null,
    durable: supabaseServiceRoleConfigured(),
  });
}

export async function PUT(request: Request) {
  if (!supabaseConfigured()) return notConfigured();

  const supabase = blackboardClient();
  if (!supabase) return notConfigured();

  let state: unknown;
  try {
    state = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, reason: "invalid_json" },
      { status: 400 },
    );
  }

  const days =
    state && typeof state === "object"
      ? (state as { days?: unknown }).days
      : null;
  if (!days || typeof days !== "object" || Array.isArray(days)) {
    return NextResponse.json(
      { ok: false, reason: "invalid_blackboard_state" },
      { status: 400 },
    );
  }
  const jobs =
    state && typeof state === "object"
      ? (state as { jobs?: unknown }).jobs
      : undefined;
  if (jobs !== undefined && !Array.isArray(jobs)) {
    return NextResponse.json(
      { ok: false, reason: "invalid_jobs_state" },
      { status: 400 },
    );
  }

  const pipelineKeys = [
    "clients",
    "requests",
    "tasks",
    "quotes",
    "invoices",
    "expenses",
  ] as const;
  for (const key of pipelineKeys) {
    const value =
      state && typeof state === "object"
        ? (state as Record<string, unknown>)[key]
        : undefined;
    if (value !== undefined && !Array.isArray(value)) {
      return NextResponse.json(
        { ok: false, reason: `invalid_${key}_state` },
        { status: 400 },
      );
    }
  }

  const updatedAt = new Date().toISOString();
  const sanitized = sanitizeIncomingState(state);
  const { error } = await supabase.from("blackboard_workspace").upsert({
    id: "default",
    state: sanitized,
    updated_at: updatedAt,
  });

  if (error) {
    return NextResponse.json(
      {
        ok: false,
        reason: "save_failed",
        message: error.message,
        hint: "Run the latest supabase/schema.sql in the SQL Editor.",
      },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    updatedAt,
    durable: supabaseServiceRoleConfigured(),
  });
}
