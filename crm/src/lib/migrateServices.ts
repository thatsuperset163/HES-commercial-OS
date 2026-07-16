import type {
  PipelineStage,
  Prospect,
  ProspectPriority,
  SalesState,
  ServiceType,
} from '../types'
import { INDUSTRIES, SERVICES, STAGES, emptyProspectDraft } from '../types'

const VALID_SERVICE = new Set(SERVICES.map((s) => s.id))
const VALID_STAGE = new Set(STAGES.map((s) => s.id))
const VALID_INDUSTRY = new Set(INDUSTRIES as readonly string[])

const LEGACY_SERVICE_MAP: Record<string, ServiceType> = {
  pressure_washing: 'pressure_washing',
  window_cleaning: 'window_cleaning',
  junk_removal: 'junk_removal',
  soft_washing: 'soft_washing',
  gutter_cleaning: 'gutter_cleaning',
  other: 'other',
  exterior_maintenance: 'other',
}

const LEGACY_STAGE_MAP: Record<string, PipelineStage> = {
  not_researched: 'not_contacted',
  research_complete: 'not_contacted',
  not_contacted: 'not_contacted',
  email_sent: 'email_sent',
  called: 'called',
  follow_up_1: 'follow_up_due',
  follow_up_2: 'follow_up_due',
  follow_up_due: 'follow_up_due',
  left_voicemail: 'left_voicemail',
  spoke_with_dm: 'spoke_with_dm',
  interested: 'interested',
  negotiating: 'interested',
  meeting_scheduled: 'site_visit_scheduled',
  site_visit: 'site_visit_scheduled',
  site_visit_scheduled: 'site_visit_scheduled',
  quote_sent: 'proposal_sent',
  proposal_sent: 'proposal_sent',
  won: 'won',
  lost: 'lost',
  future_opportunity: 'future_opportunity',
}

const LEGACY_INDUSTRY_MAP: Record<string, string> = {
  Retail: 'Other',
  Office: 'Office Park',
  'HOA / Multifamily': 'HOA',
  Medical: 'Medical',
  'Warehouse / Industrial': 'Industrial',
  Hospitality: 'Hotel',
  Religious: 'Church',
  Education: 'School',
  Government: 'Other',
  Other: 'Other',
  'Education / Schools': 'School',
  'Property Management': 'Property Management',
  Apartment: 'Apartment',
  Hotel: 'Hotel',
  'Assisted Living': 'Assisted Living',
  School: 'School',
  HOA: 'HOA',
  Industrial: 'Industrial',
  Church: 'Church',
  'Office Park': 'Office Park',
}

/** Original demo seed prospect IDs — always strip so fake CRM data stays gone. */
const DEMO_PROSPECT_IDS = new Set([
  'p1',
  'p2',
  'p3',
  'p4',
  'p5',
  'p6',
  'p7',
  'p8',
])

export function migrateService(id: string): ServiceType | null {
  if (VALID_SERVICE.has(id as ServiceType)) return id as ServiceType
  return LEGACY_SERVICE_MAP[id] ?? null
}

export function migrateServicesNeeded(services: string[] | undefined): ServiceType[] {
  const next: ServiceType[] = []
  for (const raw of services ?? []) {
    const mapped = migrateService(String(raw))
    if (mapped && !next.includes(mapped)) next.push(mapped)
  }
  return next
}

function migrateStage(raw: unknown): PipelineStage {
  const key = String(raw || '')
  if (VALID_STAGE.has(key as PipelineStage)) return key as PipelineStage
  return LEGACY_STAGE_MAP[key] ?? 'not_contacted'
}

function migrateIndustry(raw: unknown): string {
  const key = String(raw || 'Other')
  if (VALID_INDUSTRY.has(key)) return key
  return LEGACY_INDUSTRY_MAP[key] ?? 'Other'
}

function migratePriority(raw: unknown): ProspectPriority {
  const key = String(raw || '').toLowerCase()
  if (key === 'high' || key === 'medium' || key === 'low') return key
  return 'medium'
}

function asString(v: unknown, fallback = '') {
  return typeof v === 'string' ? v : fallback
}

function asBool(v: unknown, fallback = false) {
  return typeof v === 'boolean' ? v : fallback
}

function asIso(v: unknown): string | null {
  if (typeof v !== 'string' || !v.trim()) return null
  return v
}

export function migrateProspect(raw: Record<string, unknown>): Prospect {
  const draft = emptyProspectDraft(asString(raw.salesRep, 'Will'))
  const legacyNotes = asString(raw.notes)
  const propertyNotes =
    asString(raw.propertyNotes) || legacyNotes || ''

  return {
    ...draft,
    id: asString(raw.id) || `p-${Date.now()}`,
    businessName: asString(raw.businessName),
    industry: migrateIndustry(raw.industry),
    website: asString(raw.website),
    companyPhone: asString(raw.companyPhone),
    address: asString(raw.address),
    city: asString(raw.city),
    decisionMaker: asString(raw.decisionMaker),
    jobTitle: asString(raw.jobTitle),
    email: asString(raw.email),
    phone: asString(raw.phone),
    phoneExt: asString(raw.phoneExt),
    assistantName: asString(raw.assistantName),
    assistantPhone: asString(raw.assistantPhone),
    stage: migrateStage(raw.stage),
    priority: migratePriority(raw.priority),
    firstEmailAt: asIso(raw.firstEmailAt),
    firstCallAt: asIso(raw.firstCallAt),
    nextFollowUpAt: asIso(raw.nextFollowUpAt),
    lastContactAt: asIso(raw.lastContactAt),
    propertyNotes,
    conversationNotes: asString(raw.conversationNotes),
    painPoints: asString(raw.painPoints),
    servicesDiscussed: asString(raw.servicesDiscussed),
    servicesNeeded: migrateServicesNeeded(
      raw.servicesNeeded as string[] | undefined,
    ),
    emailVerified: asBool(raw.emailVerified),
    decisionMakerConfirmed: asBool(raw.decisionMakerConfirmed),
    salesRep: asString(raw.salesRep, 'Will'),
    createdAt: asString(raw.createdAt) || new Date().toISOString(),
    updatedAt: asString(raw.updatedAt) || new Date().toISOString(),
  }
}

function stripDemoRecords(state: SalesState): SalesState {
  const prospects = state.prospects.filter((p) => !DEMO_PROSPECT_IDS.has(p.id))
  const keepIds = new Set(prospects.map((p) => p.id))
  return {
    ...state,
    prospects,
    tasks: (state.tasks ?? []).filter((t) => keepIds.has(t.prospectId)),
    timeline: (state.timeline ?? []).filter((e) => keepIds.has(e.prospectId)),
    sentEmails: (state.sentEmails ?? []).filter((e) =>
      keepIds.has(e.prospectId),
    ),
    attachments: (state.attachments ?? []).filter((a) =>
      keepIds.has(a.prospectId),
    ),
  }
}

/** Normalize persisted state for the decision-maker CRM model. */
export function migrateState(state: SalesState): SalesState {
  const stripped = stripDemoRecords(state)
  return {
    ...stripped,
    prospects: stripped.prospects.map((p) =>
      migrateProspect(p as unknown as Record<string, unknown>),
    ),
  }
}
