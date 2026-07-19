import type {
  Attachment,
  AttachmentKind,
  EmailTemplate,
  PipelineStage,
  Prospect,
  ProspectPriority,
  SalesState,
  SentEmail,
  ServiceType,
  Task,
  TaskKind,
  TimelineEvent,
  TimelineEventType,
} from '../types.ts'
import {
  CURRENT_SALES_STATE_SCHEMA_VERSION,
  INDUSTRIES,
  SERVICES,
  STAGES,
  emptyProspectDraft,
} from '../types.ts'

const VALID_SERVICE = new Set(SERVICES.map((s) => s.id))
const VALID_STAGE = new Set(STAGES.map((s) => s.id))
const VALID_INDUSTRY = new Set(INDUSTRIES as readonly string[])
const VALID_TASK_KIND = new Set<TaskKind>(['call', 'email', 'visit', 'quote', 'other'])
const VALID_TIMELINE_TYPE = new Set<TimelineEventType>([
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
const VALID_ATTACHMENT_KIND = new Set<AttachmentKind>([
  'photo',
  'document',
  'quote',
  'other',
])

const LEGACY_SERVICE_MAP: Record<string, ServiceType> = {
  pressure_washing: 'pressure_washing',
  window_cleaning: 'window_cleaning',
  junk_removal: 'junk_removal',
  // Retired offerings — fold into the closest current service.
  soft_washing: 'pressure_washing',
  gutter_cleaning: 'pressure_washing',
  other: 'pressure_washing',
  exterior_maintenance: 'pressure_washing',
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

export function migrateService(id: string): ServiceType | null {
  if (VALID_SERVICE.has(id as ServiceType)) return id as ServiceType
  return LEGACY_SERVICE_MAP[id] ?? null
}

export function migrateServicesNeeded(services: unknown): ServiceType[] {
  const next: ServiceType[] = []
  if (!Array.isArray(services)) return next
  for (const raw of services) {
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

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function asIdentifier(value: unknown): string {
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return ''
}

function isValidDate(value: string): boolean {
  return value.trim().length > 0 && Number.isFinite(Date.parse(value))
}

function asIso(value: unknown, fallback: string): string {
  return typeof value === 'string' && isValidDate(value) ? value : fallback
}

function asNullableIso(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null
  return typeof value === 'string' && isValidDate(value) ? value : null
}

function createIdAllocator(prefix: string) {
  const used = new Set<string>()
  return (rawId: unknown, index: number) => {
    const requested = asIdentifier(rawId)
    const base = requested || `migrated-${prefix}-${index + 1}`
    let id = base
    let suffix = 2
    while (used.has(id)) {
      id = `${base}-${suffix}`
      suffix += 1
    }
    used.add(id)
    return id
  }
}

function migrateMeta(value: unknown): TimelineEvent['meta'] | undefined {
  const raw = asRecord(value)
  const entries = Object.entries(raw).filter(([, item]) =>
    item === null ||
    typeof item === 'string' ||
    typeof item === 'number' ||
    typeof item === 'boolean',
  ) as [string, string | number | boolean | null][]
  return entries.length > 0 ? Object.fromEntries(entries) : undefined
}

export function migrateProspect(
  raw: Record<string, unknown>,
  id = asIdentifier(raw.id) || 'migrated-p-1',
  defaultTimestamp = new Date().toISOString(),
): Prospect {
  const draft = emptyProspectDraft(asString(raw.salesRep, 'Will'))
  const legacyNotes = asString(raw.notes)
  const propertyNotes = asString(raw.propertyNotes) || legacyNotes
  const rawStage = asString(raw.stage)
  const existingCompatibility = asRecord(raw.compatibility)
  const legacyStage = rawStage && !VALID_STAGE.has(rawStage as PipelineStage)
    ? rawStage
    : asString(existingCompatibility.legacyStage)
  const compatibility = legacyStage ? { legacyStage } : undefined

  return {
    ...draft,
    id,
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
    stage: migrateStage(rawStage),
    priority: migratePriority(raw.priority),
    firstEmailAt: asNullableIso(raw.firstEmailAt),
    firstCallAt: asNullableIso(raw.firstCallAt),
    nextFollowUpAt: asNullableIso(raw.nextFollowUpAt),
    lastContactAt: asNullableIso(raw.lastContactAt),
    propertyNotes,
    conversationNotes: asString(raw.conversationNotes),
    painPoints: asString(raw.painPoints),
    servicesDiscussed: asString(raw.servicesDiscussed),
    servicesNeeded: migrateServicesNeeded(raw.servicesNeeded),
    emailVerified: asBool(raw.emailVerified),
    decisionMakerConfirmed: asBool(raw.decisionMakerConfirmed),
    salesRep: asString(raw.salesRep, 'Will'),
    createdAt: asIso(raw.createdAt, defaultTimestamp),
    updatedAt: asIso(raw.updatedAt, defaultTimestamp),
    ...(compatibility ? { compatibility } : {}),
  }
}

function migrateTask(
  raw: Record<string, unknown>,
  id: string,
  defaultTimestamp: string,
): Task {
  const kind = asString(raw.kind) as TaskKind
  return {
    id,
    prospectId: asIdentifier(raw.prospectId),
    title: asString(raw.title),
    kind: VALID_TASK_KIND.has(kind) ? kind : 'other',
    dueAt: asIso(raw.dueAt, defaultTimestamp),
    done: asBool(raw.done),
    completedAt: asNullableIso(raw.completedAt),
    salesRep: asString(raw.salesRep, 'Will'),
    createdAt: asIso(raw.createdAt, defaultTimestamp),
  }
}

function migrateTimelineEvent(
  raw: Record<string, unknown>,
  id: string,
  defaultTimestamp: string,
): TimelineEvent {
  const type = asString(raw.type) as TimelineEventType
  const normalizedType = VALID_TIMELINE_TYPE.has(type) ? type : 'other'
  const prospectId = asIdentifier(raw.prospectId)
  const title = asString(raw.title)
  const body = asString(raw.body)
  const existingSearchableText = asString(raw.searchableText).trim()
  const searchableText = (
    existingSearchableText ||
    [title, body, normalizedType, prospectId].join(' ')
  ).trim().toLowerCase()
  const meta = migrateMeta(raw.meta)

  return {
    id,
    prospectId,
    type: normalizedType,
    title,
    body,
    searchableText,
    ...(meta ? { meta } : {}),
    createdAt: asIso(raw.createdAt, defaultTimestamp),
  }
}

function migrateTemplate(
  raw: Record<string, unknown>,
  id: string,
  defaultTimestamp: string,
): EmailTemplate {
  return {
    id,
    name: asString(raw.name),
    subject: asString(raw.subject),
    body: asString(raw.body),
    createdAt: asIso(raw.createdAt, defaultTimestamp),
    updatedAt: asIso(raw.updatedAt, defaultTimestamp),
  }
}

function migrateSentEmail(
  raw: Record<string, unknown>,
  id: string,
  defaultTimestamp: string,
): SentEmail {
  const templateId = asIdentifier(raw.templateId)
  return {
    id,
    prospectId: asIdentifier(raw.prospectId),
    templateId: templateId || null,
    subject: asString(raw.subject),
    body: asString(raw.body),
    sentAt: asIso(raw.sentAt, defaultTimestamp),
  }
}

function migrateAttachment(
  raw: Record<string, unknown>,
  id: string,
  defaultTimestamp: string,
): Attachment {
  const kind = asString(raw.kind) as AttachmentKind
  return {
    id,
    prospectId: asIdentifier(raw.prospectId),
    name: asString(raw.name),
    kind: VALID_ATTACHMENT_KIND.has(kind) ? kind : 'other',
    url: asString(raw.url),
    note: asString(raw.note),
    createdAt: asIso(raw.createdAt, defaultTimestamp),
  }
}

/** Normalize all persisted collections without discarding user records. */
export function migrateState(state: unknown): SalesState {
  const raw = asRecord(state)
  const defaultTimestamp = new Date().toISOString()
  const prospectId = createIdAllocator('p')
  const taskId = createIdAllocator('t')
  const timelineId = createIdAllocator('tl')
  const templateId = createIdAllocator('tpl')
  const sentEmailId = createIdAllocator('se')
  const attachmentId = createIdAllocator('a')

  return {
    schemaVersion: CURRENT_SALES_STATE_SCHEMA_VERSION,
    prospects: asArray(raw.prospects).map((item, index) => {
      const record = asRecord(item)
      return migrateProspect(
        record,
        prospectId(record.id, index),
        defaultTimestamp,
      )
    }),
    tasks: asArray(raw.tasks).map((item, index) => {
      const record = asRecord(item)
      return migrateTask(record, taskId(record.id, index), defaultTimestamp)
    }),
    timeline: asArray(raw.timeline).map((item, index) => {
      const record = asRecord(item)
      return migrateTimelineEvent(
        record,
        timelineId(record.id, index),
        defaultTimestamp,
      )
    }),
    templates: asArray(raw.templates).map((item, index) => {
      const record = asRecord(item)
      return migrateTemplate(
        record,
        templateId(record.id, index),
        defaultTimestamp,
      )
    }),
    sentEmails: asArray(raw.sentEmails).map((item, index) => {
      const record = asRecord(item)
      return migrateSentEmail(
        record,
        sentEmailId(record.id, index),
        defaultTimestamp,
      )
    }),
    attachments: asArray(raw.attachments).map((item, index) => {
      const record = asRecord(item)
      return migrateAttachment(
        record,
        attachmentId(record.id, index),
        defaultTimestamp,
      )
    }),
  }
}
