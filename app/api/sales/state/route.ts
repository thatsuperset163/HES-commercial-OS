import { NextResponse } from "next/server";
import { getSupabaseAdmin, supabaseConfigured } from "@/lib/supabase";

type SalesStatePayload = {
  prospects?: unknown[];
  tasks?: unknown[];
  timeline?: unknown[];
  templates?: unknown[];
  sentEmails?: unknown[];
  attachments?: unknown[];
};

function prospectRow(p: Record<string, unknown>) {
  return {
    id: String(p.id ?? ""),
    company_name: String(p.businessName ?? ""),
    industry: String(p.industry ?? ""),
    website: String(p.website ?? ""),
    company_phone: String(p.companyPhone ?? ""),
    address: String(p.address ?? ""),
    city: String(p.city ?? ""),
    decision_maker: String(p.decisionMaker ?? ""),
    job_title: String(p.jobTitle ?? ""),
    email: String(p.email ?? ""),
    phone: String(p.phone ?? ""),
    phone_ext: String(p.phoneExt ?? ""),
    assistant_name: String(p.assistantName ?? ""),
    assistant_phone: String(p.assistantPhone ?? ""),
    lead_status: String(p.stage ?? "not_contacted"),
    priority: String(p.priority ?? "medium"),
    first_email_at: (p.firstEmailAt as string | null) ?? null,
    first_call_at: (p.firstCallAt as string | null) ?? null,
    next_follow_up_at: (p.nextFollowUpAt as string | null) ?? null,
    last_contact_at: (p.lastContactAt as string | null) ?? null,
    property_notes: String(p.propertyNotes ?? ""),
    conversation_notes: String(p.conversationNotes ?? ""),
    pain_points: String(p.painPoints ?? ""),
    services_discussed: String(p.servicesDiscussed ?? ""),
    services_needed: Array.isArray(p.servicesNeeded) ? p.servicesNeeded : [],
    email_verified: Boolean(p.emailVerified),
    decision_maker_confirmed: Boolean(p.decisionMakerConfirmed),
    sales_rep: String(p.salesRep ?? "Will"),
    created_at: String(p.createdAt ?? new Date().toISOString()),
    updated_at: String(p.updatedAt ?? new Date().toISOString()),
  };
}

export async function GET() {
  if (!supabaseConfigured()) {
    return NextResponse.json(
      { ok: false, reason: "supabase_not_configured" },
      { status: 503 },
    );
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json(
      { ok: false, reason: "supabase_not_configured" },
      { status: 503 },
    );
  }

  const { data, error } = await supabase
    .from("sales_workspace")
    .select("state, updated_at")
    .eq("id", "default")
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { ok: false, reason: "load_failed", message: error.message },
      { status: 500 },
    );
  }

  if (!data?.state) {
    return NextResponse.json({ ok: true, state: null, updatedAt: null });
  }

  return NextResponse.json({
    ok: true,
    state: data.state,
    updatedAt: data.updated_at,
  });
}

export async function PUT(req: Request) {
  if (!supabaseConfigured()) {
    return NextResponse.json(
      { ok: false, reason: "supabase_not_configured" },
      { status: 503 },
    );
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json(
      { ok: false, reason: "supabase_not_configured" },
      { status: 503 },
    );
  }

  let body: SalesStatePayload;
  try {
    body = (await req.json()) as SalesStatePayload;
  } catch {
    return NextResponse.json(
      { ok: false, reason: "invalid_json" },
      { status: 400 },
    );
  }

  const state = {
    prospects: Array.isArray(body.prospects) ? body.prospects : [],
    tasks: Array.isArray(body.tasks) ? body.tasks : [],
    timeline: Array.isArray(body.timeline) ? body.timeline : [],
    templates: Array.isArray(body.templates) ? body.templates : [],
    sentEmails: Array.isArray(body.sentEmails) ? body.sentEmails : [],
    attachments: Array.isArray(body.attachments) ? body.attachments : [],
  };

  const updatedAt = new Date().toISOString();

  const { error: workspaceError } = await supabase.from("sales_workspace").upsert({
    id: "default",
    state,
    updated_at: updatedAt,
  });

  if (workspaceError) {
    return NextResponse.json(
      {
        ok: false,
        reason: "save_failed",
        message: workspaceError.message,
        hint: "Did you run supabase/schema.sql in the SQL Editor?",
      },
      { status: 500 },
    );
  }

  const rows = (state.prospects as Record<string, unknown>[])
    .filter((p) => p && p.id)
    .map(prospectRow);

  const ids = rows.map((r) => r.id);

  if (ids.length > 0) {
    const { error: upsertError } = await supabase
      .from("commercial_prospects")
      .upsert(rows, { onConflict: "id" });
    if (upsertError) {
      return NextResponse.json(
        {
          ok: false,
          reason: "prospects_upsert_failed",
          message: upsertError.message,
        },
        { status: 500 },
      );
    }
  }

  // Remove deleted prospects from the flat table
  const { data: existing } = await supabase
    .from("commercial_prospects")
    .select("id");

  const stale =
    existing
      ?.map((r) => r.id as string)
      .filter((id) => !ids.includes(id)) ?? [];

  if (stale.length > 0) {
    await supabase.from("commercial_prospects").delete().in("id", stale);
  }

  if (ids.length === 0 && existing && existing.length > 0) {
    await supabase
      .from("commercial_prospects")
      .delete()
      .neq("id", "__none__");
  }

  return NextResponse.json({ ok: true, updatedAt });
}
