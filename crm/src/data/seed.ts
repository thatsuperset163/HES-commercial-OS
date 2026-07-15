import type { SalesState } from '../types'
import { daysAgo } from '../lib/dates'
import { EMAIL_SIGNATURE } from '../lib/templates'

const now = () => new Date().toISOString()

function schoolProspect(
  id: string,
  businessName: string,
  city: string,
): SalesState['prospects'][number] {
  const stamp = now()
  return {
    id,
    businessName,
    industry: 'Education / Schools',
    address: '',
    city,
    website: '',
    googleMapsUrl: '',
    decisionMaker: '',
    jobTitle: '',
    email: '',
    phone: '',
    linkedIn: '',
    numberOfBuildings: 1,
    estimatedSqFt: 0,
    servicesNeeded: ['pressure_washing'],
    notes: '',
    stage: 'not_researched',
    salesRep: 'Will',
    quoteAmount: 0,
    probability: 20,
    expectedCloseDate: null,
    billingType: 'one_time',
    expectedAnnualValue: 0,
    lastContactAt: null,
    nextFollowUpAt: null,
    createdAt: stamp,
    updatedAt: stamp,
  }
}

/** Default CRM: your real school leads + email templates. No fake demo companies. */
export const SEED: SalesState = {
  prospects: [
    schoolProspect('ps-reagan', 'Reagan High School', 'Pfafftown'),
    schoolProspect('ps-east-forsyth', 'East Forsyth High School', 'Kernersville'),
  ],
  tasks: [],
  timeline: [],
  templates: [
    {
      id: 'tpl1',
      name: 'Cold intro — commercial wash',
      subject: 'Exterior cleaning for {{businessName}}',
      body: `Hi {{decisionMaker}},

This is {{salesRep}} with Harris Exterior Solutions. We help commercial properties in the Triad stay clean and presentable with pressure washing, window cleaning, and junk removal.

I'd like to learn whether {{services}} would help {{businessName}} in {{city}}. Happy to do a quick site look and send a clear written scope.

Would a short call this week work?

${EMAIL_SIGNATURE}`,
      createdAt: daysAgo(60),
      updatedAt: daysAgo(10),
    },
    {
      id: 'tpl2',
      name: 'Follow-up after email',
      subject: 'Re: Exterior cleaning for {{businessName}}',
      body: `Hi {{decisionMaker}},

Following up on exterior cleaning for {{businessName}}. If helpful, I can walk the property, photograph problem areas, and send options for {{services}}.

${EMAIL_SIGNATURE}`,
      createdAt: daysAgo(60),
      updatedAt: daysAgo(10),
    },
    {
      id: 'tpl3',
      name: 'Post site-visit quote cover',
      subject: 'Site notes + quote — {{businessName}}',
      body: `Hi {{decisionMaker}},

Thanks for walking {{businessName}} with me. Attached is our written scope for {{services}}.

Quote: {{quoteAmount}}
Property notes captured on site for {{buildings}} building(s).

Happy to adjust phasing or recurring maintenance if that fits better.

${EMAIL_SIGNATURE}`,
      createdAt: daysAgo(40),
      updatedAt: daysAgo(5),
    },
  ],
  sentEmails: [],
  attachments: [],
}
