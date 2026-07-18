import { NextResponse } from "next/server";
import {
  getSupabaseAdmin,
  getSupabaseServiceRole,
  supabaseConfigured,
} from "@/lib/supabase";
import { IntakeRepo } from "@/lib/requestsCenter/repo";
import { todayDateKey } from "@/lib/requestsCenter/model";
import { createTask, normalizeTasks } from "@/lib/work/model";

function client() {
  return getSupabaseServiceRole() ?? getSupabaseAdmin();
}

type BlackboardState = {
  days?: Record<string, unknown>;
  tasks?: unknown[];
  [key: string]: unknown;
};

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
    // Website leads skip "new" and land in Needs Response for same-day triage.
    const created = await repo.create({
      customerName: name,
      phone,
      email,
      address: (body.address ?? "").trim(),
      serviceRequested: (body.message ?? "").trim() || "Website estimate request",
      requestSource: "website",
      priority: "high",
      notes: (body.message ?? "").trim(),
      dateReceived: todayDateKey(),
      status: "needs_response",
    });

    const marker = `auto:website-lead:${created.id}`;
    const { data, error } = await supabase
      .from("blackboard_workspace")
      .select("state")
      .eq("id", "default")
      .maybeSingle();
    if (!error) {
      const state = (data?.state ?? { days: {} }) as BlackboardState;
      const tasks = normalizeTasks(state.tasks);
      if (!tasks.some((task) => task.notes.includes(marker))) {
        const task = createTask({
          title: `Respond to website lead · ${name}`,
          dueDate: todayDateKey(),
          notes: `${marker} · Open /work/requests`,
        });
        await supabase.from("blackboard_workspace").upsert({
          id: "default",
          state: {
            ...state,
            days: state.days && typeof state.days === "object" ? state.days : {},
            tasks: [task, ...tasks],
          },
          updated_at: new Date().toISOString(),
        });
      }
    }

    return NextResponse.json({ ok: true, id: created.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : "save_failed";
    return NextResponse.json(
      { ok: false, reason: "save_failed", message },
      { status: 500 },
    );
  }
}
