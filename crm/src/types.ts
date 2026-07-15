export type ServiceType =
  | 'pressure_washing'
  | 'soft_washing'
  | 'window_cleaning'
  | 'gutter_cleaning'
  | 'exterior_maintenance'

export type PipelineStage =
  | 'not_researched'
  | 'research_complete'
  | 'email_sent'
  | 'called'
  | 'follow_up_1'
  | 'follow_up_2'
  | 'meeting_scheduled'
  | 'site_visit'
  | 'quote_sent'
  | 'negotiating'
  | 'won'
  | 'lost'

export type BillingType = 'one_time' | 'recurring'

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

export interface Prospect {
  id: string
  businessName: string
  industry: string
  address: string
  city: string
  website: string
  googleMapsUrl: string
  decisionMaker: string
  jobTitle: string
  email: string
  phone: string
  linkedIn: string
  numberOfBuildings: number
  estimatedSqFt: number
  servicesNeeded: ServiceType[]
  notes: string
  stage: PipelineStage
  salesRep: string
  quoteAmount: number
  probability: number
  expectedCloseDate: string | null
  billingType: BillingType
  expectedAnnualValue: number
  lastContactAt: string | null
  nextFollowUpAt: string | null
  createdAt: string
  updatedAt: string
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
  prospects: Prospect[]
  tasks: Task[]
  timeline: TimelineEvent[]
  templates: EmailTemplate[]
  sentEmails: SentEmail[]
  attachments: Attachment[]
}

export const SERVICES: { id: ServiceType; label: string }[] = [
  { id: 'pressure_washing', label: 'Pressure washing' },
  { id: 'soft_washing', label: 'Soft washing' },
  { id: 'window_cleaning', label: 'Window cleaning' },
  { id: 'gutter_cleaning', label: 'Gutter cleaning' },
  { id: 'exterior_maintenance', label: 'Exterior maintenance' },
]

export const STAGES: { id: PipelineStage; label: string }[] = [
  { id: 'not_researched', label: 'Not Researched' },
  { id: 'research_complete', label: 'Research Complete' },
  { id: 'email_sent', label: 'Email Sent' },
  { id: 'called', label: 'Called' },
  { id: 'follow_up_1', label: 'Follow-up 1' },
  { id: 'follow_up_2', label: 'Follow-up 2' },
  { id: 'meeting_scheduled', label: 'Meeting Scheduled' },
  { id: 'site_visit', label: 'Site Visit' },
  { id: 'quote_sent', label: 'Quote Sent' },
  { id: 'negotiating', label: 'Negotiating' },
  { id: 'won', label: 'Won' },
  { id: 'lost', label: 'Lost' },
]

export const OPEN_STAGES: PipelineStage[] = STAGES.filter(
  (s) => s.id !== 'won' && s.id !== 'lost',
).map((s) => s.id)

export const INDUSTRIES = [
  'Retail',
  'Office',
  'HOA / Multifamily',
  'Medical',
  'Warehouse / Industrial',
  'Hospitality',
  'Religious',
  'Education',
  'Government',
  'Other',
] as const
