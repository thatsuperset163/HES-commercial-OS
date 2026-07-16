import "server-only";

export type LeadStatus =
  | "not_contacted"
  | "contacted"
  | "qualified"
  | "nurture"
  | "converted"
  | "lost";
export type Priority = "low" | "medium" | "high";
export type ContactType = "decision_maker" | "gatekeeper" | "other";
export type TaskStatus = "open" | "in_progress" | "completed" | "cancelled";
export type Direction = "inbound" | "outbound" | "internal";
export type JsonObject = Record<string, unknown>;

export interface PageOptions {
  page: number;
  pageSize: number;
  sort: string;
  direction: "asc" | "desc";
}

export interface PageResult<T> {
  data: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface CompanyInput {
  name: string;
  assigned_user_id?: string | null;
  industry?: string | null;
  website?: string | null;
  phone?: string | null;
  address_line1?: string | null;
  address_line2?: string | null;
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;
  country?: string;
  notes?: string | null;
}

export interface ContactInput {
  company_id: string;
  full_name: string;
  job_title?: string | null;
  email?: string | null;
  phone?: string | null;
  phone_ext?: string | null;
  contact_type?: ContactType;
  is_primary?: boolean;
  email_verified?: boolean;
  decision_maker_confirmed?: boolean;
  notes?: string | null;
}

export interface OpportunityInput {
  company_id: string;
  primary_contact_id?: string | null;
  stage_id: string;
  lead_source_id?: string | null;
  assigned_user_id?: string | null;
  name: string;
  lead_status?: LeadStatus;
  priority?: Priority;
  estimated_job_value?: number | null;
  estimated_annual_value?: number | null;
  first_email_at?: string | null;
  first_call_at?: string | null;
  next_follow_up_at?: string | null;
  last_contact_at?: string | null;
  expected_close_at?: string | null;
  closed_at?: string | null;
  property_notes?: string | null;
  conversation_notes?: string | null;
  pain_points?: string | null;
  services_discussed?: string | null;
}

export interface ActivityInput {
  opportunity_id?: string | null;
  company_id?: string | null;
  contact_id?: string | null;
  assigned_user_id?: string | null;
  actor_user_id?: string | null;
  activity_type: string;
  subject: string;
  body?: string | null;
  notes?: string | null;
  direction?: Direction | null;
  outcome?: string | null;
  source?: string | null;
  occurred_at?: string;
  metadata?: JsonObject;
}

export interface TaskInput {
  opportunity_id?: string | null;
  company_id?: string | null;
  contact_id?: string | null;
  assigned_user_id?: string | null;
  title: string;
  description?: string | null;
  task_type?: string;
  status?: TaskStatus;
  priority?: Priority;
  due_at?: string | null;
  remind_at?: string | null;
  metadata?: JsonObject;
}

export interface TagInput {
  name: string;
  color?: string | null;
}
