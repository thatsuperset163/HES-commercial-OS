import type { Prospect, ServiceType } from '../types.ts'
import { SERVICES } from '../types.ts'

const SERVICE_LABEL: Record<ServiceType, string> = Object.fromEntries(
  SERVICES.map((s) => [s.id, s.label]),
) as Record<ServiceType, string>

/** Single source of truth for the HES outbound email footer. */
export const EMAIL_SIGNATURE = `Thank you for your time, and I appreciate your consideration. I look forward to hearing from you.

William Harris
Owner | Harris Exterior Solutions LLC

Pressure Washing | Window Cleaning | Junk Removal

336-986-8371
www.harrisexteriorsolutions.com`

const SIGNATURE_MARKERS = [
  'Owner | Harris Exterior Solutions LLC',
  'www.harrisexteriorsolutions.com',
]

export function hasEmailSignature(text: string) {
  return SIGNATURE_MARKERS.some((marker) => text.includes(marker))
}

/** Append the HES signature once — skips if already present. */
export function withEmailSignature(body: string) {
  const trimmed = body.replace(/\s+$/, '')
  if (hasEmailSignature(trimmed)) return trimmed
  if (!trimmed) return EMAIL_SIGNATURE
  return `${trimmed}\n\n${EMAIL_SIGNATURE}`
}

export function serviceLabels(services: ServiceType[]) {
  return services.map((s) => SERVICE_LABEL[s] ?? s).join(', ')
}

export function personalize(template: string, prospect: Prospect) {
  const map: Record<string, string> = {
    businessName: prospect.businessName,
    decisionMaker: prospect.decisionMaker,
    jobTitle: prospect.jobTitle,
    city: prospect.city || prospect.address,
    state: prospect.state || '',
    industry: prospect.industry,
    services: serviceLabels(prospect.servicesNeeded),
    salesRep: prospect.salesRep,
    phone: prospect.phone,
    email: prospect.email,
    address: prospect.address,
    companyPhone: prospect.companyPhone,
    propertyNotes: prospect.propertyNotes,
    painPoints: prospect.painPoints,
    conversationNotes: prospect.conversationNotes,
    servicesDiscussed: prospect.servicesDiscussed,
    assistantName: prospect.assistantName,
    signature: EMAIL_SIGNATURE,
  }

  const filled = template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => map[key] ?? '')
  return withEmailSignature(filled)
}

export function followUpSubject(lastSubject: string) {
  if (!lastSubject) return 'Following up'
  if (/^re:/i.test(lastSubject)) return lastSubject
  return `Re: ${lastSubject}`
}

export function followUpBody(prospect: Prospect, lastBody?: string) {
  const first = prospect.decisionMaker.split(' ')[0] || prospect.decisionMaker
  const services = serviceLabels(prospect.servicesNeeded) || 'exterior cleaning'
  const main = withEmailSignature(`Hi ${first},

Just following up on ${services.toLowerCase()} for ${prospect.businessName}. Happy to answer questions on scope, timing, or a quick site look — whatever is easiest on your end.

If now isn't the right time, tell me when to check back.`)

  if (!lastBody?.trim()) return main
  return `${main}\n\n---\nPrevious message:\n${lastBody.trim()}`
}

/** Default body when creating a new blank template. */
export function defaultTemplateBody() {
  return `Hi {{decisionMaker}},

This is William Harris with Harris Exterior Solutions. We help commercial properties in the Triad stay clean and presentable with pressure washing, window cleaning, and junk removal.

I'd like to discuss {{services}} for {{businessName}} in {{city}}.

Would a short call this week work?

{{signature}}`
}
