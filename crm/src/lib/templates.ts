import type { Prospect, ServiceType } from '../types'
import { SERVICES } from '../types'

const SERVICE_LABEL: Record<ServiceType, string> = Object.fromEntries(
  SERVICES.map((s) => [s.id, s.label]),
) as Record<ServiceType, string>

export function serviceLabels(services: ServiceType[]) {
  return services.map((s) => SERVICE_LABEL[s] ?? s).join(', ')
}

export function personalize(template: string, prospect: Prospect) {
  const map: Record<string, string> = {
    businessName: prospect.businessName,
    decisionMaker: prospect.decisionMaker,
    jobTitle: prospect.jobTitle,
    city: prospect.city,
    industry: prospect.industry,
    services: serviceLabels(prospect.servicesNeeded),
    buildings: String(prospect.numberOfBuildings || ''),
    sqFt: prospect.estimatedSqFt
      ? prospect.estimatedSqFt.toLocaleString('en-US')
      : '',
    quoteAmount: prospect.quoteAmount
      ? prospect.quoteAmount.toLocaleString('en-US', {
          style: 'currency',
          currency: 'USD',
          maximumFractionDigits: 0,
        })
      : '',
    salesRep: prospect.salesRep,
    phone: prospect.phone,
    email: prospect.email,
    address: prospect.address,
  }

  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => map[key] ?? '')
}

export function followUpSubject(lastSubject: string) {
  if (!lastSubject) return 'Following up'
  if (/^re:/i.test(lastSubject)) return lastSubject
  return `Re: ${lastSubject}`
}

export function followUpBody(prospect: Prospect, lastBody?: string) {
  const first = prospect.decisionMaker.split(' ')[0] || prospect.decisionMaker
  const services = serviceLabels(prospect.servicesNeeded) || 'exterior cleaning'
  return `Hi ${first},

Just following up on ${services.toLowerCase()} for ${prospect.businessName}. Happy to answer questions on scope, timing, or a quick site look — whatever is easiest on your end.

If now isn't the right time, tell me when to check back.

Thanks,
${prospect.salesRep}
Harris Exterior Solutions
(336) 986-8371${lastBody ? `\n\n---\nPrevious message:\n${lastBody}` : ''}`
}
