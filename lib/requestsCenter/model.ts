import type {
  IntakeActivity,
  IntakeAttachment,
  IntakePriority,
  IntakeRequest,
  IntakeStatus,
  PropertyType,
  RequestSource,
} from "./types.ts";
import {
  INTAKE_PRIORITIES,
  INTAKE_STATUSES,
  PROPERTY_TYPES,
  REQUEST_SOURCES,
} from "./types.ts";

export function intakeUid(prefix = "req"): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function asAmount(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return Math.max(0, value);
  if (typeof value === "string" && value.trim()) {
    const n = Number(value);
    if (Number.isFinite(n)) return Math.max(0, n);
  }
  return null;
}

function pick<T extends string>(
  value: unknown,
  allowed: readonly T[],
  fallback: T,
): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

export function todayDateKey(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function emptyIntakeInput() {
  return {
    customerName: "",
    company: "",
    phone: "",
    email: "",
    address: "",
    serviceRequested: "",
    requestSource: "manual" as RequestSource,
    priority: "normal" as IntakePriority,
    notes: "",
    dateReceived: todayDateKey(),
  };
}

function normalizePhoneDigits(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return digits.length >= 10 ? digits.slice(-10) : digits;
}

export function createIntakeRequest(
  input: Partial<IntakeRequest> & { customerName: string },
): IntakeRequest {
  const now = new Date().toISOString();
  return {
    id: input.id || intakeUid("intake"),
    status: pick(input.status, INTAKE_STATUSES, "new"),
    customerName: input.customerName.trim() || "Customer",
    company: (input.company ?? "").trim(),
    phone: (input.phone ?? "").trim(),
    email: (input.email ?? "").trim(),
    address: (input.address ?? "").trim(),
    serviceRequested: (input.serviceRequested ?? "").trim() || "Exterior cleaning",
    requestSource: pick(input.requestSource, REQUEST_SOURCES, "manual"),
    priority: pick(input.priority, INTAKE_PRIORITIES, "normal"),
    notes: (input.notes ?? "").trim(),
    dateReceived: input.dateReceived || todayDateKey(),
    estimateDate: input.estimateDate ?? null,
    estimateTime: (input.estimateTime ?? "").trim(),
    assignedPerson: (input.assignedPerson ?? "").trim(),
    directions: (input.directions ?? "").trim(),
    estimateNotes: (input.estimateNotes ?? "").trim(),
    waitingReason: (input.waitingReason ?? "").trim(),
    declineReason: (input.declineReason ?? "").trim(),
    declineNotes: (input.declineNotes ?? "").trim(),
    convertedClientId: input.convertedClientId ?? null,
    convertedJobId: input.convertedJobId ?? null,
    convertedInvoiceId: input.convertedInvoiceId ?? null,
    convertedQuoteId: input.convertedQuoteId ?? null,
    linkedClientId: input.linkedClientId ?? null,
    followUpDate: input.followUpDate ?? null,
    followUpType: (input.followUpType ?? "").trim(),
    followUpNotes: (input.followUpNotes ?? "").trim(),
    potentialValue:
      input.potentialValue === undefined ? null : asAmount(input.potentialValue),
    propertyType: pick(input.propertyType, PROPERTY_TYPES, ""),
    siteVisitOutcome: (input.siteVisitOutcome ?? "").trim(),
    aiSummary: (input.aiSummary ?? "").trim(),
    aiSuggestedReply: (input.aiSuggestedReply ?? "").trim(),
    aiPriceEstimate: (input.aiPriceEstimate ?? "").trim(),
    aiUpsellSuggestions: (input.aiUpsellSuggestions ?? "").trim(),
    internalNotes: (input.internalNotes ?? "").trim(),
    attachments: Array.isArray(input.attachments) ? input.attachments : [],
    photos: Array.isArray(input.photos) ? input.photos : [],
    createdAt: input.createdAt || now,
    updatedAt: now,
  };
}

function parseAttachments(value: unknown): IntakeAttachment[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === "object")
    .map((row) => ({
      id: asString(row.id) || intakeUid("att"),
      name: asString(row.name) || "Attachment",
      url: asString(row.url),
      kind: row.kind === "photo" ? "photo" : "file",
      addedAt: asString(row.addedAt) || new Date().toISOString(),
    }));
}

export function rowToIntake(row: Record<string, unknown>): IntakeRequest {
  return {
    id: asString(row.id),
    status: pick(row.status, INTAKE_STATUSES, "new"),
    customerName: asString(row.customer_name) || "Customer",
    company: asString(row.company),
    phone: asString(row.phone),
    email: asString(row.email),
    address: asString(row.address),
    serviceRequested: asString(row.service_requested) || "Exterior cleaning",
    requestSource: pick(row.request_source, REQUEST_SOURCES, "manual"),
    priority: pick(row.priority, INTAKE_PRIORITIES, "normal"),
    notes: asString(row.notes),
    dateReceived: asString(row.date_received) || todayDateKey(),
    estimateDate: row.estimate_date ? asString(row.estimate_date) : null,
    estimateTime: asString(row.estimate_time),
    assignedPerson: asString(row.assigned_person),
    directions: asString(row.directions),
    estimateNotes: asString(row.estimate_notes),
    waitingReason: asString(row.waiting_reason),
    declineReason: asString(row.decline_reason),
    declineNotes: asString(row.decline_notes),
    convertedClientId: row.converted_client_id
      ? asString(row.converted_client_id)
      : null,
    convertedJobId: row.converted_job_id ? asString(row.converted_job_id) : null,
    convertedInvoiceId: row.converted_invoice_id
      ? asString(row.converted_invoice_id)
      : null,
    convertedQuoteId: row.converted_quote_id
      ? asString(row.converted_quote_id)
      : null,
    linkedClientId: row.linked_client_id ? asString(row.linked_client_id) : null,
    followUpDate: row.follow_up_date ? asString(row.follow_up_date) : null,
    followUpType: asString(row.follow_up_type),
    followUpNotes: asString(row.follow_up_notes),
    potentialValue: asAmount(row.potential_value),
    propertyType: pick(row.property_type, PROPERTY_TYPES, "") as PropertyType,
    siteVisitOutcome: asString(row.site_visit_outcome),
    aiSummary: asString(row.ai_summary),
    aiSuggestedReply: asString(row.ai_suggested_reply),
    aiPriceEstimate: asString(row.ai_price_estimate),
    aiUpsellSuggestions: asString(row.ai_upsell_suggestions),
    internalNotes: asString(row.internal_notes),
    attachments: parseAttachments(row.attachments),
    photos: parseAttachments(row.photos),
    createdAt: asString(row.created_at) || new Date().toISOString(),
    updatedAt: asString(row.updated_at) || new Date().toISOString(),
  };
}

export function intakeToRow(request: IntakeRequest): Record<string, unknown> {
  return {
    id: request.id,
    status: request.status,
    customer_name: request.customerName,
    company: request.company,
    phone: request.phone,
    email: request.email,
    address: request.address,
    service_requested: request.serviceRequested,
    request_source: request.requestSource,
    priority: request.priority,
    notes: request.notes,
    date_received: request.dateReceived,
    estimate_date: request.estimateDate,
    estimate_time: request.estimateTime,
    assigned_person: request.assignedPerson,
    directions: request.directions,
    estimate_notes: request.estimateNotes,
    waiting_reason: request.waitingReason,
    decline_reason: request.declineReason,
    decline_notes: request.declineNotes,
    converted_client_id: request.convertedClientId,
    converted_job_id: request.convertedJobId,
    converted_invoice_id: request.convertedInvoiceId,
    converted_quote_id: request.convertedQuoteId,
    linked_client_id: request.linkedClientId,
    follow_up_date: request.followUpDate,
    follow_up_type: request.followUpType,
    follow_up_notes: request.followUpNotes,
    potential_value: request.potentialValue,
    property_type: request.propertyType,
    site_visit_outcome: request.siteVisitOutcome,
    ai_summary: request.aiSummary,
    ai_suggested_reply: request.aiSuggestedReply,
    ai_price_estimate: request.aiPriceEstimate,
    ai_upsell_suggestions: request.aiUpsellSuggestions,
    internal_notes: request.internalNotes,
    attachments: request.attachments,
    photos: request.photos,
    created_at: request.createdAt,
    updated_at: request.updatedAt,
    archived_at: null,
  };
}

export function rowToActivity(row: Record<string, unknown>): IntakeActivity {
  return {
    id: asString(row.id),
    requestId: asString(row.request_id),
    activityType: asString(row.activity_type) || "note",
    body: asString(row.body),
    meta:
      row.meta && typeof row.meta === "object" && !Array.isArray(row.meta)
        ? (row.meta as Record<string, unknown>)
        : {},
    createdAt: asString(row.created_at) || new Date().toISOString(),
  };
}

export function buildDashboard(rows: IntakeRequest[]): Record<IntakeStatus, number> {
  const dash: Record<IntakeStatus, number> = {
    new: 0,
    needs_response: 0,
    estimate_scheduled: 0,
    waiting_on_customer: 0,
    approved: 0,
    declined: 0,
  };
  for (const row of rows) dash[row.status] += 1;
  return dash;
}

/**
 * Detect a likely duplicate inbound request (same phone or email) among
 * recent open rows — flag for review instead of silent multi-create.
 */
export function findRecentDuplicate(
  existing: IntakeRequest[],
  input: { phone?: string; email?: string; customerName?: string },
  withinHours = 48,
): IntakeRequest | null {
  const phone = normalizePhoneDigits(input.phone ?? "");
  const email = (input.email ?? "").trim().toLowerCase();
  if (!phone && !email) return null;
  const cutoff = Date.now() - withinHours * 60 * 60 * 1000;

  return (
    existing.find((row) => {
      if (row.status === "declined") return false;
      const created = Date.parse(row.createdAt || "");
      if (!Number.isFinite(created) || created < cutoff) return false;
      const rowPhone = normalizePhoneDigits(row.phone);
      const rowEmail = row.email.trim().toLowerCase();
      if (phone && rowPhone && phone === rowPhone) return true;
      if (email && rowEmail && email === rowEmail) return true;
      return false;
    }) ?? null
  );
}
