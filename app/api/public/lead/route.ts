import { NextResponse } from "next/server";
import {
  getSupabaseAdmin,
  getSupabaseServiceRole,
  supabaseConfigured,
} from "@/lib/supabase";
import { createRequest } from "@/lib/work/model";
import { normalizeRequests } from "@/lib/work/model";

type BlackboardState = {
  days?: Record<string, unknown>;
  jobs?: unknown[];
  clients?: unknown[];
  requests?: unknown[];
  tasks?: unknown[];
  quotes?: unknown[];
  invoices?: unknown[];
  expenses?: unknown[];
  ideaLot?: string;
};

function client() {
  return getSupabaseServiceRole() ?? getSupabaseAdmin();
}

export async function POST(request: Request) {
  if (!supabaseConfigured()) {
    return NextResponse.json(
      { ok: false, reason: "supabase_not_configured" },
      { status: 503 },
    );
  }

  const supabase = client();
  if (!supabase) {
    return NextResponse.json(
      { ok: false, reason: "supabase_not_configured" },
      { status: 503 },
    );
  }

  let body: {
    name?: string;
    phone?: string;
    email?: string;
    address?: string;
    message?: string;
    company?: string; // honeypot
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, reason: "invalid_json" }, { status: 400 });
  }

  // Honeypot — bots fill this; humans never see it.
  if (body.company?.trim()) {
    return NextResponse.json({ ok: true });
  }

  const name = (body.name ?? "").trim();
  const phone = (body.phone ?? "").trim();
  const message = (body.message ?? "").trim();
  if (!name || (!phone && !(body.email ?? "").trim())) {
    return NextResponse.json(
      { ok: false, reason: "name_and_contact_required" },
      { status: 400 },
    );
  }

  const summary =
    message ||
    [body.address?.trim() ? `Property: ${body.address.trim()}` : "", "Website estimate request"]
      .filter(Boolean)
      .join(" · ");

  const lead = createRequest({
    clientName: name,
    summary,
    phone,
    notes: [
      (body.email ?? "").trim() ? `Email: ${(body.email ?? "").trim()}` : "",
      body.address?.trim() ? `Address: ${body.address.trim()}` : "",
      "Source: public website /site",
    ]
      .filter(Boolean)
      .join(" · "),
  });

  const { data, error } = await supabase
    .from("blackboard_workspace")
    .select("state")
    .eq("id", "default")
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { ok: false, reason: "load_failed", message: error.message },
      { status: 500 },
    );
  }

  const state = (data?.state ?? { days: {} }) as BlackboardState;
  const requests = normalizeRequests(state.requests);
  const nextState: BlackboardState = {
    ...state,
    days: state.days && typeof state.days === "object" ? state.days : {},
    requests: [lead, ...requests],
  };

  const updatedAt = new Date().toISOString();
  const { error: saveError } = await supabase.from("blackboard_workspace").upsert({
    id: "default",
    state: nextState,
    updated_at: updatedAt,
  });

  if (saveError) {
    return NextResponse.json(
      { ok: false, reason: "save_failed", message: saveError.message },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
