/** Typed client for HQ Sales v2 APIs (`/api/sales/v2/*`). */

export type SalesApiError = {
  ok: false
  status: number
  code: string
  message: string
  details?: unknown
}

export type SalesApiSuccess<T> = {
  ok: true
  status: number
  data: T
}

export type SalesApiResult<T> = SalesApiSuccess<T> | SalesApiError

export type LeadStatus =
  | 'not_contacted'
  | 'contacted'
  | 'qualified'
  | 'nurture'
  | 'converted'
  | 'lost'

export type Priority = 'low' | 'medium' | 'high'

export interface PageResult<T> {
  data: T[]
  page: number
  pageSize: number
  total: number
  totalPages: number
}

export interface OpportunityStage {
  id: string
  name: string
  probability: number
  sort_order: number
  is_closed: boolean
  is_won: boolean
}

export interface LeadSource {
  id: string
  name: string
  description: string | null
  sort_order: number
  is_active: boolean
}

export interface ServiceRow {
  id: string
  name: string
  description: string | null
  is_active: boolean
  sort_order: number
}

export interface TagRow {
  id: string
  name: string
  color: string | null
}

export interface SalesUser {
  id: string
  display_name: string
  email: string | null
  role: string
}

export interface CompanyRow {
  id: string
  name: string
  assigned_user_id: string | null
  industry: string | null
  website: string | null
  phone: string | null
  address_line1: string | null
  address_line2: string | null
  city: string | null
  state: string | null
  postal_code: string | null
  country: string
  notes: string | null
  legacy_prospect_id: string | null
  created_at: string
  updated_at: string
  archived_at: string | null
}

export interface ContactRow {
  id: string
  company_id: string
  full_name: string
  job_title: string | null
  email: string | null
  phone: string | null
  phone_ext: string | null
  contact_type: 'decision_maker' | 'gatekeeper' | 'other'
  is_primary: boolean
  email_verified: boolean
  decision_maker_confirmed: boolean
  notes: string | null
  created_at: string
  updated_at: string
  archived_at: string | null
}

export interface OpportunityRow {
  id: string
  company_id: string
  primary_contact_id: string | null
  stage_id: string
  lead_source_id: string | null
  assigned_user_id: string | null
  name: string
  lead_status: LeadStatus
  priority: Priority
  estimated_job_value: number | null
  estimated_annual_value: number | null
  first_email_at: string | null
  first_call_at: string | null
  next_follow_up_at: string | null
  last_contact_at: string | null
  expected_close_at: string | null
  closed_at: string | null
  property_notes: string | null
  conversation_notes: string | null
  pain_points: string | null
  services_discussed: string | null
  raw_legacy_stage: string | null
  legacy_prospect_id: string | null
  created_at: string
  updated_at: string
  archived_at: string | null
  company?: {
    id: string
    name: string
    industry: string | null
    city: string | null
    state: string | null
    website?: string | null
    phone?: string | null
    address_line1?: string | null
  } | null
  primary_contact?: {
    id: string
    full_name: string
    email: string | null
    phone: string | null
    job_title?: string | null
    phone_ext?: string | null
    email_verified?: boolean
    decision_maker_confirmed?: boolean
  } | null
  stage?: {
    id: string
    name: string
    probability: number
    is_closed: boolean
    is_won: boolean
  } | null
  lead_source?: { id: string; name: string } | null
  opportunity_services?: Array<{
    service_id: string
    service?: ServiceRow | null
  }>
}

export interface ActivityRow {
  id: string
  opportunity_id: string | null
  company_id: string | null
  contact_id: string | null
  activity_type: string
  subject: string
  body: string | null
  notes: string | null
  direction: string | null
  outcome: string | null
  occurred_at: string
  metadata: Record<string, unknown>
  created_at: string
  company?: { id: string; name: string } | null
  contact?: { id: string; full_name: string } | null
  opportunity?: { id: string; name: string } | null
}

export interface TaskRow {
  id: string
  opportunity_id: string | null
  company_id: string | null
  contact_id: string | null
  title: string
  description: string | null
  task_type: string
  status: 'open' | 'in_progress' | 'completed' | 'cancelled'
  priority: Priority
  due_at: string | null
  completed_at: string | null
  canceled_at: string | null
  created_at: string
  updated_at: string
  company?: { id: string; name: string } | null
  contact?: { id: string; full_name: string } | null
  opportunity?: { id: string; name: string } | null
}

export interface DashboardSummary {
  metrics: {
    todaysFollowUps: number
    overdueFollowUps: number
    newProspectsThisWeek: number
    openPipelineJobValue: number
    openPipelineAnnualValue: number
    wonCount: number
    lostCount: number
  }
  upcomingTasks: TaskRow[]
  recentActivities: ActivityRow[]
  largestOpportunities: OpportunityRow[]
  newestCompanies: CompanyRow[]
  generatedAt: string
}

export interface ReferenceData {
  users: SalesUser[]
  leadSources: LeadSource[]
  opportunityStages: OpportunityStage[]
  services: ServiceRow[]
  tags: TagRow[]
}

export interface BootstrapData {
  reference: ReferenceData
  dashboard: DashboardSummary
}

export interface CompanyInput {
  name: string
  assigned_user_id?: string | null
  industry?: string | null
  website?: string | null
  phone?: string | null
  address_line1?: string | null
  address_line2?: string | null
  city?: string | null
  state?: string | null
  postal_code?: string | null
  country?: string
  notes?: string | null
}

export interface ContactInput {
  company_id: string
  full_name: string
  job_title?: string | null
  email?: string | null
  phone?: string | null
  phone_ext?: string | null
  contact_type?: 'decision_maker' | 'gatekeeper' | 'other'
  is_primary?: boolean
  email_verified?: boolean
  decision_maker_confirmed?: boolean
  notes?: string | null
}

export interface OpportunityInput {
  company_id: string
  primary_contact_id?: string | null
  stage_id: string
  lead_source_id?: string | null
  assigned_user_id?: string | null
  name: string
  lead_status?: LeadStatus
  priority?: Priority
  estimated_job_value?: number | null
  estimated_annual_value?: number | null
  first_email_at?: string | null
  first_call_at?: string | null
  next_follow_up_at?: string | null
  last_contact_at?: string | null
  expected_close_at?: string | null
  closed_at?: string | null
  property_notes?: string | null
  conversation_notes?: string | null
  pain_points?: string | null
  services_discussed?: string | null
}

export interface ActivityInput {
  opportunity_id?: string | null
  company_id?: string | null
  contact_id?: string | null
  activity_type: string
  subject: string
  body?: string | null
  notes?: string | null
  direction?: 'inbound' | 'outbound' | 'internal' | null
  outcome?: string | null
  source?: string | null
  occurred_at?: string
  metadata?: Record<string, unknown>
}

export interface TaskInput {
  opportunity_id?: string | null
  company_id?: string | null
  contact_id?: string | null
  title: string
  description?: string | null
  task_type?: string
  status?: 'open' | 'in_progress' | 'completed' | 'cancelled'
  priority?: Priority
  due_at?: string | null
  remind_at?: string | null
  metadata?: Record<string, unknown>
}

async function request<T>(
  path: string,
  init: RequestInit = {},
): Promise<SalesApiResult<T>> {
  try {
    const res = await fetch(path, {
      credentials: 'same-origin',
      ...init,
      headers: {
        Accept: 'application/json',
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...(init.headers ?? {}),
      },
    })

    const body = (await res.json().catch(() => ({}))) as {
      ok?: boolean
      data?: T
      error?: { code?: string; message?: string; details?: unknown }
      message?: string
      reason?: string
    }

    if (!res.ok || body.ok === false) {
      return {
        ok: false,
        status: res.status,
        code: body.error?.code || body.reason || `http_${res.status}`,
        message:
          body.error?.message ||
          body.message ||
          body.reason ||
          `Request failed (${res.status})`,
        details: body.error?.details,
      }
    }

    return {
      ok: true,
      status: res.status,
      data: body.data as T,
    }
  } catch (err) {
    return {
      ok: false,
      status: 0,
      code: 'network_error',
      message: err instanceof Error ? err.message : 'network_error',
    }
  }
}

function qs(params?: Record<string, string | number | undefined | null>) {
  if (!params) return ''
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue
    search.set(key, String(value))
  }
  const out = search.toString()
  return out ? `?${out}` : ''
}

const v2 = '/api/sales/v2'

export const salesApi = {
  bootstrap: () => request<BootstrapData>(`${v2}/bootstrap`),

  dashboard: () => request<DashboardSummary>(`${v2}/dashboard`),

  reference: () => request<ReferenceData>(`${v2}/reference`),

  listCompanies: (params?: Record<string, string | number | undefined | null>) =>
    request<PageResult<CompanyRow>>(`${v2}/companies${qs(params)}`),

  getCompany: (id: string) =>
    request<
      CompanyRow & {
        contacts: ContactRow[]
        opportunities: OpportunityRow[]
        tags: TagRow[]
      }
    >(`${v2}/companies/${id}`),

  createCompany: (input: CompanyInput) =>
    request<CompanyRow>(`${v2}/companies`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),

  updateCompany: (id: string, input: Partial<CompanyInput>) =>
    request<CompanyRow>(`${v2}/companies/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    }),

  archiveCompany: (id: string) =>
    request<CompanyRow>(`${v2}/companies/${id}`, { method: 'DELETE' }),

  createContact: (input: ContactInput) =>
    request<ContactRow>(`${v2}/contacts`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),

  updateContact: (id: string, input: Partial<ContactInput>) =>
    request<ContactRow>(`${v2}/contacts/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    }),

  archiveContact: (id: string) =>
    request<ContactRow>(`${v2}/contacts/${id}`, { method: 'DELETE' }),

  listOpportunities: (
    params?: Record<string, string | number | undefined | null>,
  ) =>
    request<PageResult<OpportunityRow>>(
      `${v2}/opportunities${qs(params)}`,
    ),

  getOpportunity: (id: string) =>
    request<OpportunityRow>(`${v2}/opportunities/${id}`),

  createOpportunity: (input: OpportunityInput) =>
    request<OpportunityRow>(`${v2}/opportunities`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),

  updateOpportunity: (id: string, input: Partial<OpportunityInput>) =>
    request<OpportunityRow>(`${v2}/opportunities/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    }),

  replaceOpportunityServices: (id: string, serviceIds: string[]) =>
    request<{ opportunity_id: string; service_ids: string[] }>(
      `${v2}/opportunities/${id}/services`,
      {
        method: 'PUT',
        body: JSON.stringify({ service_ids: serviceIds }),
      },
    ),

  archiveOpportunity: (id: string) =>
    request<OpportunityRow>(`${v2}/opportunities/${id}`, {
      method: 'DELETE',
    }),

  listActivities: (
    params?: Record<string, string | number | undefined | null>,
  ) =>
    request<PageResult<ActivityRow>>(`${v2}/activities${qs(params)}`),

  createActivity: (input: ActivityInput) =>
    request<ActivityRow>(`${v2}/activities`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),

  listTasks: (params?: Record<string, string | number | undefined | null>) =>
    request<PageResult<TaskRow>>(`${v2}/tasks${qs(params)}`),

  createTask: (input: TaskInput) =>
    request<TaskRow>(`${v2}/tasks`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),

  updateTask: (id: string, input: Partial<TaskInput>) =>
    request<TaskRow>(`${v2}/tasks/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    }),
}

/** Probe whether Sales v2 is available for this session. */
export async function probeSalesV2(): Promise<
  | { available: true; bootstrap: BootstrapData }
  | { available: false; reason: string }
> {
  const result = await salesApi.bootstrap()
  if (!result.ok) {
    if (result.status === 503) {
      return { available: false, reason: 'service_role_not_configured' }
    }
    if (result.status === 401) {
      return { available: false, reason: 'unauthorized' }
    }
    return { available: false, reason: result.code }
  }
  return { available: true, bootstrap: result.data }
}
