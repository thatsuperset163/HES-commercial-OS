import type {
  PipelineStage,
  Prospect,
  ProspectPriority,
  ServiceType,
  Task,
  TaskKind,
  TimelineEvent,
  TimelineEventType,
} from '../types.ts'
import { CURRENT_SALES_STATE_SCHEMA_VERSION, emptyProspectDraft } from '../types.ts'
import type {
  ActivityRow,
  CompanyRow,
  ContactRow,
  LeadStatus,
  OpportunityRow,
  TaskRow,
} from './salesApi.ts'

/** UI PipelineStage → normalized opportunity stage + lead_status. */
export const PIPELINE_TO_V2: Record<
  PipelineStage,
  { stage_id: string; lead_status: LeadStatus }
> = {
  not_contacted: { stage_id: 'prospecting', lead_status: 'not_contacted' },
  email_sent: { stage_id: 'prospecting', lead_status: 'contacted' },
  follow_up_due: { stage_id: 'prospecting', lead_status: 'contacted' },
  called: { stage_id: 'prospecting', lead_status: 'contacted' },
  left_voicemail: { stage_id: 'prospecting', lead_status: 'contacted' },
  spoke_with_dm: { stage_id: 'discovery', lead_status: 'qualified' },
  interested: { stage_id: 'discovery', lead_status: 'qualified' },
  site_visit_scheduled: { stage_id: 'site_visit', lead_status: 'qualified' },
  proposal_sent: { stage_id: 'proposal', lead_status: 'qualified' },
  won: { stage_id: 'won', lead_status: 'converted' },
  lost: { stage_id: 'lost', lead_status: 'lost' },
  future_opportunity: { stage_id: 'prospecting', lead_status: 'nurture' },
}

/**
 * Prefer raw_legacy_stage when present so UI lead-status labels stay faithful
 * after backfill; otherwise reconstruct from stage_id + lead_status.
 */
export function pipelineFromV2(input: {
  stage_id?: string | null
  lead_status?: string | null
  raw_legacy_stage?: string | null
}): PipelineStage {
  const raw = input.raw_legacy_stage?.trim()
  if (raw && raw in PIPELINE_TO_V2) {
    return raw as PipelineStage
  }

  const stageId = input.stage_id ?? 'prospecting'
  const lead = input.lead_status ?? 'not_contacted'

  if (stageId === 'won' || lead === 'converted') return 'won'
  if (stageId === 'lost' || lead === 'lost') return 'lost'
  if (stageId === 'proposal' || stageId === 'negotiation') return 'proposal_sent'
  if (stageId === 'site_visit') return 'site_visit_scheduled'
  if (stageId === 'discovery') {
    return lead === 'qualified' ? 'interested' : 'spoke_with_dm'
  }
  if (lead === 'nurture') return 'future_opportunity'
  if (lead === 'contacted') return 'follow_up_due'
  return 'not_contacted'
}

export function taskKindFromV2(taskType: string | null | undefined): TaskKind {
  switch (taskType) {
    case 'call':
      return 'call'
    case 'email':
      return 'email'
    case 'visit':
    case 'site_visit':
    case 'meeting':
      return 'visit'
    case 'quote':
    case 'quote_follow_up':
      return 'quote'
    default:
      return 'other'
  }
}

export function taskTypeToV2(kind: TaskKind): string {
  switch (kind) {
    case 'call':
      return 'call'
    case 'email':
      return 'email'
    case 'visit':
      return 'visit'
    case 'quote':
      return 'quote'
    default:
      return 'other'
  }
}

const TIMELINE_TYPES = new Set<TimelineEventType>([
  'note',
  'research',
  'email',
  'call',
  'voicemail',
  'follow_up',
  'meeting',
  'site_visit',
  'quote',
  'stage_change',
  'task_created',
  'task_completed',
  'attachment',
  'other',
])

export function timelineTypeFromActivity(activityType: string): TimelineEventType {
  if (activityType === 'email_sent') return 'email'
  if (activityType === 'phone_call') return 'call'
  if (activityType === 'prospect_created') return 'other'
  if (TIMELINE_TYPES.has(activityType as TimelineEventType)) {
    return activityType as TimelineEventType
  }
  return 'other'
}

function str(value: string | null | undefined): string {
  return value?.trim() ?? ''
}

function asPriority(value: string | null | undefined): ProspectPriority {
  if (value === 'high' || value === 'low' || value === 'medium') return value
  return 'medium'
}

function servicesFromOpportunity(row: OpportunityRow): ServiceType[] {
  const ids = (row.opportunity_services ?? [])
    .map((s) => s.service_id || s.service?.id)
    .filter(Boolean) as string[]
  const allowed: ServiceType[] = [
    'pressure_washing',
    'window_cleaning',
    'junk_removal',
  ]
  return ids.filter((id): id is ServiceType =>
    (allowed as string[]).includes(id),
  )
}

export function opportunityToProspect(
  row: OpportunityRow,
  extras?: {
    company?: CompanyRow | null
    primary?: ContactRow | null
    assistant?: ContactRow | null
    salesRep?: string
  },
): Prospect {
  const company = extras?.company
  const primary = extras?.primary
  const assistant = extras?.assistant
  const joinedCompany = row.company
  const joinedContact = row.primary_contact

  const businessName =
    company?.name || joinedCompany?.name || row.name || 'Untitled'
  const address =
    company?.address_line1 ||
    joinedCompany?.address_line1 ||
    [joinedCompany?.city, joinedCompany?.state].filter(Boolean).join(', ') ||
    ''

  const stage = pipelineFromV2({
    stage_id: row.stage_id || row.stage?.id,
    lead_status: row.lead_status,
    raw_legacy_stage: row.raw_legacy_stage,
  })

  const draft = emptyProspectDraft(extras?.salesRep || 'Will')

  return {
    ...draft,
    id: row.id,
    companyId: row.company_id,
    primaryContactId:
      row.primary_contact_id || primary?.id || joinedContact?.id || undefined,
    assistantContactId: assistant?.id,
    businessName,
    industry: str(company?.industry || joinedCompany?.industry) || 'Other',
    website: str(company?.website || joinedCompany?.website),
    companyPhone: str(company?.phone || joinedCompany?.phone),
    address: str(address),
    city: str(company?.city || joinedCompany?.city),
    state: str(company?.state || joinedCompany?.state),
    decisionMaker: str(primary?.full_name || joinedContact?.full_name),
    jobTitle: str(primary?.job_title || joinedContact?.job_title),
    email: str(primary?.email || joinedContact?.email),
    phone: str(primary?.phone || joinedContact?.phone),
    phoneExt: str(primary?.phone_ext || joinedContact?.phone_ext),
    assistantName: str(assistant?.full_name),
    assistantPhone: str(assistant?.phone),
    stage,
    priority: asPriority(row.priority),
    firstEmailAt: row.first_email_at,
    firstCallAt: row.first_call_at,
    nextFollowUpAt: row.next_follow_up_at,
    lastContactAt: row.last_contact_at,
    propertyNotes: str(row.property_notes),
    conversationNotes: str(row.conversation_notes),
    painPoints: str(row.pain_points),
    servicesDiscussed: str(row.services_discussed),
    servicesNeeded: servicesFromOpportunity(row),
    emailVerified: Boolean(
      primary?.email_verified ?? joinedContact?.email_verified,
    ),
    decisionMakerConfirmed: Boolean(
      primary?.decision_maker_confirmed ??
        joinedContact?.decision_maker_confirmed,
    ),
    estimatedJobValue: row.estimated_job_value,
    estimatedAnnualValue: row.estimated_annual_value,
    leadSourceId: row.lead_source_id,
    opportunityStageId: row.stage_id || row.stage?.id || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    compatibility: row.raw_legacy_stage
      ? { legacyStage: row.raw_legacy_stage }
      : undefined,
  }
}

export function taskFromV2(row: TaskRow): Task | null {
  const prospectId = row.opportunity_id || row.company_id
  if (!prospectId) return null
  return {
    id: row.id,
    prospectId,
    title: row.title,
    kind: taskKindFromV2(row.task_type),
    dueAt: row.due_at || row.created_at,
    done: row.status === 'completed',
    completedAt: row.completed_at,
    salesRep: 'Will',
    createdAt: row.created_at,
  }
}

export function activityToTimeline(row: ActivityRow): TimelineEvent | null {
  const prospectId = row.opportunity_id || row.company_id
  if (!prospectId) return null
  const type = timelineTypeFromActivity(row.activity_type)
  const title = row.subject || type
  const body = str(row.body || row.notes)
  const meta =
    row.metadata && Object.keys(row.metadata).length
      ? (Object.fromEntries(
          Object.entries(row.metadata).map(([k, v]) => [
            k,
            typeof v === 'string' ||
            typeof v === 'number' ||
            typeof v === 'boolean' ||
            v === null
              ? v
              : String(v),
          ]),
        ) as TimelineEvent['meta'])
      : undefined
  return {
    id: row.id,
    prospectId,
    type,
    title,
    body,
    searchableText: [title, body, type, prospectId].join(' ').toLowerCase(),
    meta,
    createdAt: row.occurred_at || row.created_at,
  }
}

export function companyPayloadFromProspect(p: Partial<Prospect> & { businessName?: string }) {
  return {
    name: p.businessName?.trim() || 'Untitled company',
    industry: p.industry || null,
    website: p.website || null,
    phone: p.companyPhone || null,
    address_line1: p.address || null,
    city: p.city || null,
    state: p.state || null,
    notes: null as string | null,
  }
}

export function contactPayloadFromProspect(
  companyId: string,
  p: Partial<Prospect>,
  opts?: { isPrimary?: boolean; contactType?: ContactRow['contact_type'] },
) {
  return {
    company_id: companyId,
    full_name: p.decisionMaker?.trim() || 'Decision maker',
    job_title: p.jobTitle || null,
    email: p.email || null,
    phone: p.phone || null,
    phone_ext: p.phoneExt || null,
    contact_type: opts?.contactType ?? 'decision_maker',
    is_primary: opts?.isPrimary ?? true,
    email_verified: Boolean(p.emailVerified),
    decision_maker_confirmed: Boolean(p.decisionMakerConfirmed),
  }
}

export function assistantPayloadFromProspect(
  companyId: string,
  p: Partial<Prospect>,
) {
  return {
    company_id: companyId,
    full_name: p.assistantName?.trim() || 'Assistant',
    phone: p.assistantPhone || null,
    contact_type: 'gatekeeper' as const,
    is_primary: false,
  }
}

export function opportunityPayloadFromProspect(
  companyId: string,
  primaryContactId: string | null | undefined,
  p: Partial<Prospect> & { stage?: PipelineStage; businessName?: string },
) {
  const stage = p.stage ?? 'not_contacted'
  const mapped = PIPELINE_TO_V2[stage]
  return {
    company_id: companyId,
    primary_contact_id: primaryContactId ?? null,
    stage_id: mapped.stage_id,
    name: p.businessName?.trim() || 'Opportunity',
    lead_status: mapped.lead_status,
    priority: (p.priority ?? 'medium') as ProspectPriority,
    estimated_job_value: p.estimatedJobValue ?? null,
    estimated_annual_value: p.estimatedAnnualValue ?? null,
    lead_source_id: p.leadSourceId ?? null,
    first_email_at: p.firstEmailAt ?? null,
    first_call_at: p.firstCallAt ?? null,
    next_follow_up_at: p.nextFollowUpAt ?? null,
    last_contact_at: p.lastContactAt ?? null,
    property_notes: p.propertyNotes || null,
    conversation_notes: p.conversationNotes || null,
    pain_points: p.painPoints || null,
    services_discussed: p.servicesDiscussed || null,
    closed_at: stage === 'won' || stage === 'lost' ? new Date().toISOString() : null,
  }
}

/** Split a Prospect patch into company / contact / opportunity field bags. */
export function splitProspectPatch(patch: Partial<Prospect>) {
  const company: Partial<{
    name: string
    industry: string | null
    website: string | null
    phone: string | null
    address_line1: string | null
    city: string | null
    state: string | null
  }> = {}
  const contact: Partial<{
    full_name: string
    job_title: string | null
    email: string | null
    phone: string | null
    phone_ext: string | null
    email_verified: boolean
    decision_maker_confirmed: boolean
  }> = {}
  const assistant: Partial<{
    full_name: string
    phone: string | null
  }> = {}
  const opportunity: Partial<{
    name: string
    priority: ProspectPriority
    estimated_job_value: number | null
    estimated_annual_value: number | null
    lead_source_id: string | null
    first_email_at: string | null
    first_call_at: string | null
    next_follow_up_at: string | null
    last_contact_at: string | null
    property_notes: string | null
    conversation_notes: string | null
    pain_points: string | null
    services_discussed: string | null
    stage_id: string
    lead_status: LeadStatus
    closed_at: string | null
  }> = {}

  if (patch.businessName !== undefined) {
    company.name = patch.businessName.trim() || 'Untitled company'
    opportunity.name = company.name
  }
  if (patch.industry !== undefined) company.industry = patch.industry || null
  if (patch.website !== undefined) company.website = patch.website || null
  if (patch.companyPhone !== undefined) company.phone = patch.companyPhone || null
  if (patch.address !== undefined) company.address_line1 = patch.address || null
  if (patch.city !== undefined) company.city = patch.city || null
  if (patch.state !== undefined) company.state = patch.state || null

  if (patch.decisionMaker !== undefined) {
    contact.full_name = patch.decisionMaker.trim() || 'Decision maker'
  }
  if (patch.jobTitle !== undefined) contact.job_title = patch.jobTitle || null
  if (patch.email !== undefined) contact.email = patch.email || null
  if (patch.phone !== undefined) contact.phone = patch.phone || null
  if (patch.phoneExt !== undefined) contact.phone_ext = patch.phoneExt || null
  if (patch.emailVerified !== undefined) {
    contact.email_verified = Boolean(patch.emailVerified)
  }
  if (patch.decisionMakerConfirmed !== undefined) {
    contact.decision_maker_confirmed = Boolean(patch.decisionMakerConfirmed)
  }

  if (patch.assistantName !== undefined) {
    assistant.full_name = patch.assistantName.trim() || 'Assistant'
  }
  if (patch.assistantPhone !== undefined) {
    assistant.phone = patch.assistantPhone || null
  }

  if (patch.priority !== undefined) opportunity.priority = patch.priority
  if (patch.estimatedJobValue !== undefined) {
    opportunity.estimated_job_value = patch.estimatedJobValue
  }
  if (patch.estimatedAnnualValue !== undefined) {
    opportunity.estimated_annual_value = patch.estimatedAnnualValue
  }
  if (patch.leadSourceId !== undefined) {
    opportunity.lead_source_id = patch.leadSourceId
  }
  if (patch.firstEmailAt !== undefined) {
    opportunity.first_email_at = patch.firstEmailAt
  }
  if (patch.firstCallAt !== undefined) {
    opportunity.first_call_at = patch.firstCallAt
  }
  if (patch.nextFollowUpAt !== undefined) {
    opportunity.next_follow_up_at = patch.nextFollowUpAt
  }
  if (patch.lastContactAt !== undefined) {
    opportunity.last_contact_at = patch.lastContactAt
  }
  if (patch.propertyNotes !== undefined) {
    opportunity.property_notes = patch.propertyNotes || null
  }
  if (patch.conversationNotes !== undefined) {
    opportunity.conversation_notes = patch.conversationNotes || null
  }
  if (patch.painPoints !== undefined) {
    opportunity.pain_points = patch.painPoints || null
  }
  if (patch.servicesDiscussed !== undefined) {
    opportunity.services_discussed = patch.servicesDiscussed || null
  }
  if (patch.stage !== undefined) {
    const mapped = PIPELINE_TO_V2[patch.stage]
    opportunity.stage_id = mapped.stage_id
    opportunity.lead_status = mapped.lead_status
    opportunity.closed_at =
      patch.stage === 'won' || patch.stage === 'lost'
        ? new Date().toISOString()
        : null
    if (patch.stage === 'won' || patch.stage === 'lost') {
      opportunity.next_follow_up_at = null
    }
  }

  return { company, contact, assistant, opportunity }
}

export function emptySalesStateShell() {
  return {
    schemaVersion: CURRENT_SALES_STATE_SCHEMA_VERSION,
    prospects: [] as Prospect[],
    tasks: [] as Task[],
    timeline: [] as TimelineEvent[],
    templates: [] as never[],
    sentEmails: [] as never[],
    attachments: [] as never[],
  }
}
