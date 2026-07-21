import { NextResponse } from "next/server";
import {
  getSupabaseAdmin,
  getSupabaseServiceRole,
  supabaseConfigured,
} from "@/lib/supabase";
import { IntakeRepo } from "@/lib/requestsCenter/repo";
import {
  findRecentDuplicate,
  todayDateKey,
} from "@/lib/requestsCenter/model";

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
    company?: string;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, reason: "invalid_json" }, { status: 400 });
  }

  if (body.company?.trim()) {
    return NextResponse.json({ ok: true });
  }

  const name = (body.name ?? "").trim();
  const phone = (body.phone ?? "").trim();
  const email = (body.email ?? "").trim();
  if (!name || (!phone && !email)) {
    return NextResponse.json(
      { ok: false, reason: "name_and_contact_required" },
      { status: 400 },
    );
  }

  try {
    const repo = new IntakeRepo(supabase);
    const existing = await repo.list();
    const dup = findRecentDuplicate(existing, { phone, email, customerName: name });
    if (dup) {
      console.info("[requests] public_lead_reused", {
        existingId: dup.id,
        name,
      });
      // Idempotent: do not create a second website lead for the same contact.
      return NextResponse.json({
        ok: true,
        reused: true,
        requestId: dup.id,
      });
    }

    const created = await repo.create({
      customerName: name,
      phone,
      email,
      address: (body.address ?? "").trim(),
      serviceRequested: (body.message ?? "").trim() || "Website estimate request",
      requestSource: "website",
      priority: "normal",
      notes: (body.message ?? "").trim(),
      dateReceived: todayDateKey(),
      status: "new",
    });
    console.info("[requests] public_lead_created", { id: created.id, name });
    return NextResponse.json({ ok: true, requestId: created.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : "save_failed";
    return NextResponse.json(
      { ok: false, reason: "save_failed", message },
      { status: 500 },
    );
  }
}
