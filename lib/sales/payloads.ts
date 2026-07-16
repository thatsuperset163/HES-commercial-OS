import type {
  ActivityInput,
  CompanyInput,
  ContactInput,
  OpportunityInput,
  TagInput,
  TaskInput,
} from "./types.ts";
import {
  objectBody,
  optionalBoolean,
  optionalDate,
  optionalEnum,
  optionalJsonObject,
  optionalNumber,
  optionalString,
  pick,
  requiredString,
  ValidationError,
} from "./validation.ts";

const LEAD_STATUSES = ["not_contacted", "contacted", "qualified", "nurture", "converted", "lost"] as const;
const PRIORITIES = ["low", "medium", "high"] as const;
const CONTACT_TYPES = ["decision_maker", "gatekeeper", "other"] as const;
const TASK_STATUSES = ["open", "in_progress", "completed", "cancelled"] as const;
const DIRECTIONS = ["inbound", "outbound", "internal"] as const;
const TASK_TYPES = ["call", "email", "meeting", "visit", "site_visit", "quote_follow_up", "quote", "custom", "other"] as const;
export const ACTIVITY_TYPES = [
  "prospect_created", "email_sent", "email_opened", "email_replied", "phone_call",
  "meeting_scheduled", "quote_sent", "quote_accepted", "quote_declined", "job_completed",
  "lost_opportunity", "note", "research", "email", "call", "voicemail", "follow_up",
  "meeting", "site_visit", "quote", "stage_change", "task_created", "task_completed",
  "attachment", "other",
] as const;

function compact<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined)) as T;
}

export function companyPayload(value: unknown, partial = false): Partial<CompanyInput> {
  const body = pick(value, ["name", "assigned_user_id", "industry", "website", "phone", "address_line1", "address_line2", "city", "state", "postal_code", "country", "notes"]);
  return compact({
    name: body.name === undefined && partial ? undefined : requiredString(body.name, "name", 300),
    assigned_user_id: optionalString(body.assigned_user_id, "assigned_user_id", 200),
    industry: optionalString(body.industry, "industry", 200),
    website: optionalString(body.website, "website", 1000),
    phone: optionalString(body.phone, "phone", 100),
    address_line1: optionalString(body.address_line1, "address_line1", 500),
    address_line2: optionalString(body.address_line2, "address_line2", 500),
    city: optionalString(body.city, "city", 200),
    state: optionalString(body.state, "state", 100),
    postal_code: optionalString(body.postal_code, "postal_code", 30),
    country: optionalString(body.country, "country", 100) ?? undefined,
    notes: optionalString(body.notes, "notes"),
  });
}

export function contactPayload(value: unknown, partial = false): Partial<ContactInput> {
  const body = pick(value, ["company_id", "full_name", "job_title", "email", "phone", "phone_ext", "contact_type", "is_primary", "email_verified", "decision_maker_confirmed", "notes"]);
  return compact({
    company_id: body.company_id === undefined && partial ? undefined : requiredString(body.company_id, "company_id", 200),
    full_name: body.full_name === undefined && partial ? undefined : requiredString(body.full_name, "full_name", 300),
    job_title: optionalString(body.job_title, "job_title", 300),
    email: optionalString(body.email, "email", 500),
    phone: optionalString(body.phone, "phone", 100),
    phone_ext: optionalString(body.phone_ext, "phone_ext", 30),
    contact_type: optionalEnum(body.contact_type, "contact_type", CONTACT_TYPES),
    is_primary: optionalBoolean(body.is_primary, "is_primary"),
    email_verified: optionalBoolean(body.email_verified, "email_verified"),
    decision_maker_confirmed: optionalBoolean(body.decision_maker_confirmed, "decision_maker_confirmed"),
    notes: optionalString(body.notes, "notes"),
  });
}

export function opportunityPayload(value: unknown, partial = false): Partial<OpportunityInput> {
  const body = pick(value, ["company_id", "primary_contact_id", "stage_id", "lead_source_id", "assigned_user_id", "name", "lead_status", "priority", "estimated_job_value", "estimated_annual_value", "first_email_at", "first_call_at", "next_follow_up_at", "last_contact_at", "expected_close_at", "closed_at", "property_notes", "conversation_notes", "pain_points", "services_discussed"]);
  return compact({
    company_id: body.company_id === undefined && partial ? undefined : requiredString(body.company_id, "company_id", 200),
    primary_contact_id: optionalString(body.primary_contact_id, "primary_contact_id", 200),
    stage_id: body.stage_id === undefined && partial ? undefined : requiredString(body.stage_id, "stage_id", 200),
    lead_source_id: optionalString(body.lead_source_id, "lead_source_id", 200),
    assigned_user_id: optionalString(body.assigned_user_id, "assigned_user_id", 200),
    name: body.name === undefined && partial ? undefined : requiredString(body.name, "name", 300),
    lead_status: optionalEnum(body.lead_status, "lead_status", LEAD_STATUSES),
    priority: optionalEnum(body.priority, "priority", PRIORITIES),
    estimated_job_value: optionalNumber(body.estimated_job_value, "estimated_job_value"),
    estimated_annual_value: optionalNumber(body.estimated_annual_value, "estimated_annual_value"),
    first_email_at: optionalDate(body.first_email_at, "first_email_at"),
    first_call_at: optionalDate(body.first_call_at, "first_call_at"),
    next_follow_up_at: optionalDate(body.next_follow_up_at, "next_follow_up_at"),
    last_contact_at: optionalDate(body.last_contact_at, "last_contact_at"),
    expected_close_at: optionalDate(body.expected_close_at, "expected_close_at"),
    closed_at: optionalDate(body.closed_at, "closed_at"),
    property_notes: optionalString(body.property_notes, "property_notes"),
    conversation_notes: optionalString(body.conversation_notes, "conversation_notes"),
    pain_points: optionalString(body.pain_points, "pain_points"),
    services_discussed: optionalString(body.services_discussed, "services_discussed"),
  });
}

export function activityPayload(value: unknown): ActivityInput {
  const body = pick(value, ["opportunity_id", "company_id", "contact_id", "assigned_user_id", "actor_user_id", "activity_type", "subject", "body", "notes", "direction", "outcome", "source", "occurred_at", "metadata"]);
  const output = compact({
    opportunity_id: optionalString(body.opportunity_id, "opportunity_id", 200),
    company_id: optionalString(body.company_id, "company_id", 200),
    contact_id: optionalString(body.contact_id, "contact_id", 200),
    assigned_user_id: optionalString(body.assigned_user_id, "assigned_user_id", 200),
    actor_user_id: optionalString(body.actor_user_id, "actor_user_id", 200),
    activity_type: optionalEnum(body.activity_type, "activity_type", ACTIVITY_TYPES) ?? requiredString(body.activity_type, "activity_type"),
    subject: requiredString(body.subject, "subject", 500),
    body: optionalString(body.body, "body"),
    notes: optionalString(body.notes, "notes"),
    direction: body.direction === null ? null : optionalEnum(body.direction, "direction", DIRECTIONS),
    outcome: optionalString(body.outcome, "outcome", 1000),
    source: optionalString(body.source, "source", 300),
    occurred_at: optionalDate(body.occurred_at, "occurred_at") ?? undefined,
    metadata: optionalJsonObject(body.metadata, "metadata"),
  });
  if (!output.opportunity_id && !output.company_id && !output.contact_id) {
    throw new ValidationError("An activity must reference an opportunity, company, or contact");
  }
  return output as ActivityInput;
}

export function taskPayload(value: unknown, partial = false): Partial<TaskInput> {
  const body = pick(value, ["opportunity_id", "company_id", "contact_id", "assigned_user_id", "title", "description", "task_type", "status", "priority", "due_at", "remind_at", "metadata"]);
  const output = compact({
    opportunity_id: optionalString(body.opportunity_id, "opportunity_id", 200),
    company_id: optionalString(body.company_id, "company_id", 200),
    contact_id: optionalString(body.contact_id, "contact_id", 200),
    assigned_user_id: optionalString(body.assigned_user_id, "assigned_user_id", 200),
    title: body.title === undefined && partial ? undefined : requiredString(body.title, "title", 500),
    description: optionalString(body.description, "description"),
    task_type: optionalEnum(body.task_type, "task_type", TASK_TYPES),
    status: optionalEnum(body.status, "status", TASK_STATUSES),
    priority: optionalEnum(body.priority, "priority", PRIORITIES),
    due_at: optionalDate(body.due_at, "due_at"),
    remind_at: optionalDate(body.remind_at, "remind_at"),
    metadata: optionalJsonObject(body.metadata, "metadata"),
  });
  if (!partial && !output.opportunity_id && !output.company_id && !output.contact_id) {
    throw new ValidationError("A task must reference an opportunity, company, or contact");
  }
  return output;
}

export function tagPayload(value: unknown): TagInput {
  const body = objectBody(value);
  const color = optionalString(body.color, "color", 7);
  if (color && !/^#[0-9a-fA-F]{6}$/.test(color)) {
    throw new ValidationError("color must be a six-digit hex color");
  }
  return { name: requiredString(body.name, "name", 200), color };
}
