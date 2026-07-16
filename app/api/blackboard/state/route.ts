import { NextResponse } from "next/server";
import { getSupabaseAdmin, supabaseConfigured } from "@/lib/supabase";

function notConfigured() {
  return NextResponse.json(
    { ok: false, reason: "supabase_not_configured" },
    { status: 503 },
  );
}

export async function GET() {
  if (!supabaseConfigured()) return notConfigured();

  const supabase = getSupabaseAdmin();
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
    state: data?.state ?? { days: {} },
    updatedAt: data?.updated_at ?? null,
  });
}

export async function PUT(request: Request) {
  if (!supabaseConfigured()) return notConfigured();

  const supabase = getSupabaseAdmin();
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

  const updatedAt = new Date().toISOString();
  const { error } = await supabase.from("blackboard_workspace").upsert({
    id: "default",
    state,
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

  return NextResponse.json({ ok: true, updatedAt });
}
