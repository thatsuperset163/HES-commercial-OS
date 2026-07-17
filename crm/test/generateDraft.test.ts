import assert from 'node:assert/strict'
import test from 'node:test'

import { generateActionDraft } from '../src/lib/generateDraft.ts'
import { emptyProspectDraft } from '../src/types.ts'
import type { Prospect } from '../src/types.ts'

function prospect(partial: Partial<Prospect> & { businessName: string }): Prospect {
  return {
    ...emptyProspectDraft('Will'),
    id: 'p1',
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-07-10T00:00:00.000Z',
    decisionMaker: 'Jordan Lee',
    jobTitle: 'Property Manager',
    email: 'jordan@oakridge.com',
    phone: '512-555-0101',
    address: '100 Oak St',
    city: 'Austin',
    state: 'TX',
    industry: 'Apartment',
    servicesNeeded: ['pressure_washing', 'window_cleaning'],
    propertyNotes: 'North elevation staining near dumpster pad',
    painPoints: 'Residents complaining about curb appeal',
    ...partial,
  }
}

test('generates first outreach email from prospect card fields', () => {
  const draft = generateActionDraft(
    prospect({ stage: 'not_contacted', businessName: 'Oak Ridge Apartments' }),
    'email',
  )

  assert.equal(draft.channel, 'email')
  assert.equal(draft.to, 'jordan@oakridge.com')
  assert.match(draft.subject, /Oak Ridge Apartments/)
  assert.match(draft.body, /Jordan/)
  assert.match(draft.body, /Oak Ridge Apartments/)
  assert.match(draft.body, /Austin/)
  assert.match(draft.body, /Pressure Washing|pressure washing/i)
  assert.match(draft.body, /staining|curb appeal/i)
  assert.match(draft.gmailHref, /^https:\/\/mail\.google\.com\/mail\/\?/)
  assert.match(draft.gmailHref, /jordan%40oakridge\.com|jordan@oakridge\.com/)
  assert.ok(draft.contextLines.some((line) => line.includes('jordan@oakridge.com')))
})

test('proposal kind writes a proposal follow-up email', () => {
  const draft = generateActionDraft(
    prospect({ stage: 'proposal_sent', businessName: 'Oak Ridge Apartments' }),
    'quote',
  )

  assert.equal(draft.channel, 'quote')
  assert.match(draft.subject, /proposal/i)
  assert.match(draft.body, /proposal/i)
  assert.match(draft.body, /Oak Ridge/)
})

test('call kind builds a phone script with contact details', () => {
  const draft = generateActionDraft(
    prospect({ stage: 'follow_up_due', businessName: 'Oak Ridge Apartments' }),
    'call',
  )

  assert.equal(draft.channel, 'call')
  assert.match(draft.body, /512-555-0101/)
  assert.match(draft.body, /Opening:/)
  assert.match(draft.body, /Jordan/)
  assert.ok(draft.missing.length === 0)
})

test('flags missing email instead of inventing one', () => {
  const draft = generateActionDraft(
    prospect({
      businessName: 'No Email LLC',
      email: '',
      stage: 'not_contacted',
    }),
    'email',
  )

  assert.equal(draft.to, '')
  assert.equal(draft.gmailHref, '')
  assert.ok(draft.missing.includes('email address'))
  assert.match(draft.body, /No Email LLC/)
})
