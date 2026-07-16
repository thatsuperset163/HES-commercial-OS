export type ServiceType =
  | 'pressure_washing'
  | 'window_cleaning'
  | 'junk_removal'
  | 'soft_washing'
  | 'gutter_cleaning'
  | 'other'

/** Lead status — tracks outreach with the decision maker. */
export type PipelineStage =
  | 'not_contacted'
  | 'email_sent'
  | 'follow_up_due'
  | 'called'
  | 'left_voicemail'
  | 'spoke_with_dm'
  | 'interested'
  | 'site_visit_scheduled'
  | 'proposal_sent'
  | 'won'
  | 'lost'
  | 'future_opportunity'

export type ProspectPriority = 'high' | 'medium' | 'low'

export type TaskKind = 'call' | 'email' | 'visit' | 'quote' | 'other'

export type TimelineEventType =
  | 'note'
  | 'research'
  | 'email'
  | 'call'
  | 'voicemail'
  | 'follow_up'
  | 'meeting'
  | 'site_visit'
  | 'quote'
  | 'stage_change'
  | 'task_created'
  | 'task_completed'
  | 'attachment'
  | 'other'

export type AttachmentKind = 'photo' | 'document' | 'quote' | 'other'

export const CURRENT_SALES_STATE_SCHEMA_VERSION = 2

export interface ProspectCompatibility {
  /** Original stage value retained when a legacy/unknown stage is normalized. */
  legacyStage?: string
}

export interface Prospect {
  id: string
  /** Company name */
  businessName: string
  industry: string
  website: string
  /** Main company line */
  companyPhone: string
  /** Full street / city / state / zip */
  address: string
  /** Optional locality for filters (derived from address when possible) */
  city: string

  /** Decision maker full name */
  decisionMaker: string
  jobTitle: string
  /** Direct email */
  email: string
  /** Direct phone */
  phone: string
  phoneExt: string
  assistantName: string
  assistantPhone: string

  stage: PipelineStage
  priority: ProspectPriority

  firstEmailAt: string | null
  firstCallAt: string | null
  nextFollowUpAt: string | null
  lastContactAt: string | null

  propertyNotes: string
  conversationNotes: string
  painPoints: string
  servicesDiscussed: string
  servicesNeeded: ServiceType[]

  emailVerified: boolean
  decisionMakerConfirmed: boolean

  salesRep: string
  createdAt: string
  updatedAt: string
  compatibility?: ProspectCompatibility
}

export interface Task {
  id: string
  prospectId: string
  title: string
  kind: TaskKind
  dueAt: string
  done: boolean
  completedAt: string | null
  salesRep: string
  createdAt: string
}

export interface TimelineEvent {
  id: string
  prospectId: string
  type: TimelineEventType
  title: string
  body: string
  searchableText: string
  meta?: Record<string, string | number | boolean | null>
  createdAt: string
}

export interface EmailTemplate {
  id: string
  name: string
  subject: string
  body: string
  createdAt: string
  updatedAt: string
}

export interface SentEmail {
  id: string
  prospectId: string
  templateId: string | null
  subject: string
  body: string
  sentAt: string
}

export interface Attachment {
  id: string
  prospectId: string
  name: string
  kind: AttachmentKind
  url: string
  note: string
  createdAt: string
}

export interface SalesState {
  schemaVersion: typeof CURRENT_SALES_STATE_SCHEMA_VERSION
  prospects: Prospect[]
  tasks: Task[]
  timeline: TimelineEvent[]
  templates: EmailTemplate[]
  sentEmails: SentEmail[]
  attachments: Attachment[]
}

export const SERVICES: { id: ServiceType; label: string }[] = [
  { id: 'pressure_washing', label: 'Pressure Washing' },
  { id: 'window_cleaning', label: 'Window Cleaning' },
  { id: 'junk_removal', label: 'Junk Removal' },
  { id: 'soft_washing', label: 'Soft Washing' },
  { id: 'gutter_cleaning', label: 'Gutter Cleaning' },
  { id: 'other', label: 'Other' },
]

export const STAGES: { id: PipelineStage; label: string }[] = [
  { id: 'not_contacted', label: 'Not Contacted' },
  { id: 'email_sent', label: 'Email Sent' },
  { id: 'follow_up_due', label: 'Follow-up Due' },
  { id: 'called', label: 'Called' },
  { id: 'left_voicemail', label: 'Left Voicemail' },
  { id: 'spoke_with_dm', label: 'Spoke with Decision Maker' },
  { id: 'interested', label: 'Interested' },
  { id: 'site_visit_scheduled', label: 'Site Visit Scheduled' },
  { id: 'proposal_sent', label: 'Proposal Sent' },
  { id: 'won', label: 'Won' },
  { id: 'lost', label: 'Lost' },
  { id: 'future_opportunity', label: 'Future Opportunity' },
]

export const OPEN_STAGES: PipelineStage[] = STAGES.filter(
  (s) => s.id !== 'won' && s.id !== 'lost',
).map((s) => s.id)

export const PRIORITIES: { id: ProspectPriority; label: string }[] = [
  { id: 'high', label: 'High' },
  { id: 'medium', label: 'Medium' },
  { id: 'low', label: 'Low' },
]

export const INDUSTRIES = [
  'Property Management',
  'Apartment',
  'Hotel',
  'Assisted Living',
  'School',
  'HOA',
  'Medical',
  'Industrial',
  'Church',
  'Office Park',
  'Other',
] as const

export function emptyProspectDraft(
  salesRep = 'Will',
): Omit<Prospect, 'id' | 'createdAt' | 'updatedAt'> {
  return {
    businessName: '',
    industry: 'Other',
    website: '',
    companyPhone: '',
    address: '',
    city: '',
    decisionMaker: '',
    jobTitle: '',
    email: '',
    phone: '',
    phoneExt: '',
    assistantName: '',
    assistantPhone: '',
    stage: 'not_contacted',
    priority: 'medium',
    firstEmailAt: null,
    firstCallAt: null,
    nextFollowUpAt: null,
    lastContactAt: null,
    propertyNotes: '',
    conversationNotes: '',
    painPoints: '',
    servicesDiscussed: '',
    servicesNeeded: [],
    emailVerified: false,
    decisionMakerConfirmed: false,
    salesRep,
  }
}
