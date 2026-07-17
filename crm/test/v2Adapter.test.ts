import assert from 'node:assert/strict'
import test from 'node:test'

import {
  PIPELINE_TO_V2,
  activityToTimeline,
  opportunityToProspect,
  pipelineFromV2,
  splitProspectPatch,
  taskFromV2,
  taskKindFromV2,
  taskTypeToV2,
} from '../src/lib/v2Adapter.ts'
import type { OpportunityRow } from '../src/lib/salesApi.ts'

test('maps every UI pipeline stage to a v2 stage + lead_status', () => {
  for (const [stage, mapped] of Object.entries(PIPELINE_TO_V2)) {
    assert.ok(mapped.stage_id, stage)
    assert.ok(mapped.lead_status, stage)
  }
  assert.deepEqual(PIPELINE_TO_V2.proposal_sent, {
    stage_id: 'proposal',
    lead_status: 'qualified',
  })
  assert.deepEqual(PIPELINE_TO_V2.won, {
    stage_id: 'won',
    lead_status: 'converted',
  })
})

test('prefers raw_legacy_stage when reconstructing UI stage', () => {
  assert.equal(
    pipelineFromV2({
      stage_id: 'prospecting',
      lead_status: 'contacted',
      raw_legacy_stage: 'email_sent',
    }),
    'email_sent',
  )
  assert.equal(
    pipelineFromV2({
      stage_id: 'discovery',
      lead_status: 'qualified',
      raw_legacy_stage: null,
    }),
    'interested',
  )
})

test('adapts opportunity list rows into Prospect view-model', () => {
  const row = {
    id: 'opp-1',
    company_id: 'co-1',
    primary_contact_id: 'ct-1',
    stage_id: 'proposal',
    lead_source_id: 'ls-1',
    assigned_user_id: null,
    name: 'Oak Ridge Apartments',
    lead_status: 'qualified',
    priority: 'high',
    estimated_job_value: 4500,
    estimated_annual_value: 18000,
    first_email_at: null,
    first_call_at: null,
    next_follow_up_at: '2026-07-20T12:00:00.000Z',
    last_contact_at: null,
    expected_close_at: null,
    closed_at: null,
    property_notes: 'North elevation staining',
    conversation_notes: '',
    pain_points: '',
    services_discussed: '',
    raw_legacy_stage: 'proposal_sent',
    legacy_prospect_id: 'opp-1',
    created_at: '2026-07-01T00:00:00.000Z',
    updated_at: '2026-07-10T00:00:00.000Z',
    archived_at: null,
    company: {
      id: 'co-1',
      name: 'Oak Ridge Apartments',
      industry: 'Apartment',
      city: 'Austin',
      state: 'TX',
      phone: '512-555-0100',
      address_line1: '100 Oak St',
    },
    primary_contact: {
      id: 'ct-1',
      full_name: 'Jordan Lee',
      email: 'jordan@example.com',
      phone: '512-555-0101',
      job_title: 'Property Manager',
    },
  } as OpportunityRow

  const prospect = opportunityToProspect(row)
  assert.equal(prospect.id, 'opp-1')
  assert.equal(prospect.companyId, 'co-1')
  assert.equal(prospect.businessName, 'Oak Ridge Apartments')
  assert.equal(prospect.decisionMaker, 'Jordan Lee')
  assert.equal(prospect.stage, 'proposal_sent')
  assert.equal(prospect.priority, 'high')
  assert.equal(prospect.city, 'Austin')
  assert.equal(prospect.state, 'TX')
  assert.equal(prospect.estimatedJobValue, 4500)
  assert.equal(prospect.estimatedAnnualValue, 18000)
})

test('maps tasks and activities onto prospect-centric view models', () => {
  assert.equal(taskKindFromV2('site_visit'), 'visit')
  assert.equal(taskTypeToV2('quote'), 'quote')

  const task = taskFromV2({
    id: 't1',
    opportunity_id: 'opp-1',
    company_id: 'co-1',
    contact_id: null,
    title: 'Call Jordan',
    description: null,
    task_type: 'call',
    status: 'open',
    priority: 'high',
    due_at: '2026-07-18T15:00:00.000Z',
    completed_at: null,
    canceled_at: null,
    created_at: '2026-07-17T00:00:00.000Z',
    updated_at: '2026-07-17T00:00:00.000Z',
  })
  assert.equal(task?.prospectId, 'opp-1')
  assert.equal(task?.kind, 'call')
  assert.equal(task?.done, false)

  const event = activityToTimeline({
    id: 'a1',
    opportunity_id: 'opp-1',
    company_id: 'co-1',
    contact_id: null,
    activity_type: 'email_sent',
    subject: 'Intro email',
    body: 'Hello',
    notes: null,
    direction: 'outbound',
    outcome: null,
    occurred_at: '2026-07-17T12:00:00.000Z',
    metadata: { template: 'intro' },
    created_at: '2026-07-17T12:00:00.000Z',
  })
  assert.equal(event?.type, 'email')
  assert.equal(event?.prospectId, 'opp-1')
})

test('splits prospect patches across company, contact, and opportunity', () => {
  const split = splitProspectPatch({
    businessName: 'New Co',
    decisionMaker: 'Pat Smith',
    priority: 'high',
    estimatedJobValue: 9000,
    stage: 'interested',
    assistantName: 'Alex',
  })

  assert.equal(split.company.name, 'New Co')
  assert.equal(split.opportunity.name, 'New Co')
  assert.equal(split.contact.full_name, 'Pat Smith')
  assert.equal(split.opportunity.priority, 'high')
  assert.equal(split.opportunity.estimated_job_value, 9000)
  assert.equal(split.opportunity.stage_id, 'discovery')
  assert.equal(split.opportunity.lead_status, 'qualified')
  assert.equal(split.assistant.full_name, 'Alex')
})
