import assert from 'node:assert/strict'
import test from 'node:test'

import { migrateState } from '../src/lib/migrateServices.ts'
import { CURRENT_SALES_STATE_SCHEMA_VERSION } from '../src/types.ts'

const VALID_DATE = '2025-01-02T03:04:05.000Z'

test('migrates unversioned state without deleting reused demo IDs', () => {
  const migrated = migrateState({
    prospects: [{
      id: 'p1',
      businessName: 'Real Customer',
      stage: 'negotiating',
      notes: 'Legacy notes',
      createdAt: VALID_DATE,
      updatedAt: VALID_DATE,
    }],
  })

  assert.equal(migrated.schemaVersion, CURRENT_SALES_STATE_SCHEMA_VERSION)
  assert.equal(migrated.prospects.length, 1)
  assert.equal(migrated.prospects[0].id, 'p1')
  assert.equal(migrated.prospects[0].businessName, 'Real Customer')
  assert.equal(migrated.prospects[0].stage, 'interested')
  assert.equal(migrated.prospects[0].compatibility?.legacyStage, 'negotiating')
  assert.equal(migrated.prospects[0].propertyNotes, 'Legacy notes')
  assert.deepEqual(migrated.tasks, [])
  assert.deepEqual(migrated.timeline, [])
  assert.deepEqual(migrated.templates, [])
  assert.deepEqual(migrated.sentEmails, [])
  assert.deepEqual(migrated.attachments, [])
})

test('turns malformed top-level collections into empty arrays', () => {
  const migrated = migrateState({
    prospects: null,
    tasks: { id: 'not-an-array' },
    timeline: 'broken',
    templates: 42,
    sentEmails: false,
    attachments: {},
  })

  assert.deepEqual(migrated, {
    schemaVersion: CURRENT_SALES_STATE_SCHEMA_VERSION,
    prospects: [],
    tasks: [],
    timeline: [],
    templates: [],
    sentEmails: [],
    attachments: [],
  })
})

test('normalizes corrupt records, IDs, timestamps, and child references', () => {
  const migrated = migrateState({
    prospects: [
      {
        id: 'duplicate',
        businessName: 17,
        servicesNeeded: ['window_cleaning', 'window_cleaning', 'invalid'],
        createdAt: 'invalid',
        updatedAt: null,
      },
      { id: 'duplicate', stage: 'unexpected-stage' },
      null,
    ],
    tasks: [{
      prospectId: 42,
      kind: 'bad-kind',
      dueAt: 'not-a-date',
      completedAt: 'also-bad',
      done: 'yes',
    }],
    timeline: [{
      prospectId: 'orphan-prospect',
      type: 'bad-type',
      title: 'Customer Called',
      body: 'Needs a quote',
      createdAt: 'bad',
      meta: { kept: true, nested: { discarded: true } },
    }],
    templates: [{ createdAt: 'bad', updatedAt: 'bad' }],
    sentEmails: [{ prospectId: 'orphan-prospect', templateId: 9, sentAt: 'bad' }],
    attachments: [{ prospectId: 'orphan-prospect', kind: 'bad', createdAt: 'bad' }],
  })

  assert.deepEqual(
    migrated.prospects.map((prospect) => prospect.id),
    ['duplicate', 'duplicate-2', 'migrated-p-3'],
  )
  assert.equal(migrated.prospects[0].businessName, '')
  assert.deepEqual(migrated.prospects[0].servicesNeeded, ['window_cleaning'])
  assert.equal(migrated.prospects[1].compatibility?.legacyStage, 'unexpected-stage')

  assert.equal(migrated.tasks[0].id, 'migrated-t-1')
  assert.equal(migrated.tasks[0].prospectId, '42')
  assert.equal(migrated.tasks[0].kind, 'other')
  assert.equal(migrated.tasks[0].done, false)
  assert.equal(migrated.tasks[0].completedAt, null)

  assert.equal(migrated.timeline[0].prospectId, 'orphan-prospect')
  assert.equal(migrated.timeline[0].type, 'other')
  assert.match(migrated.timeline[0].searchableText, /customer called/)
  assert.match(migrated.timeline[0].searchableText, /needs a quote/)
  assert.deepEqual(migrated.timeline[0].meta, { kept: true })

  assert.equal(migrated.sentEmails[0].templateId, '9')
  assert.equal(migrated.attachments[0].kind, 'other')

  const timestamps = [
    migrated.prospects[0].createdAt,
    migrated.prospects[0].updatedAt,
    migrated.tasks[0].dueAt,
    migrated.tasks[0].createdAt,
    migrated.timeline[0].createdAt,
    migrated.templates[0].createdAt,
    migrated.templates[0].updatedAt,
    migrated.sentEmails[0].sentAt,
    migrated.attachments[0].createdAt,
  ]
  for (const timestamp of timestamps) {
    assert.ok(Number.isFinite(Date.parse(timestamp)), `${timestamp} should be valid`)
  }
})

test('leaves a current normalized state unchanged', () => {
  const current = migrateState({
    schemaVersion: CURRENT_SALES_STATE_SCHEMA_VERSION,
    prospects: [{
      id: 'customer-1',
      businessName: 'Current Customer',
      stage: 'won',
      servicesNeeded: ['pressure_washing'],
      createdAt: VALID_DATE,
      updatedAt: VALID_DATE,
    }],
    tasks: [{
      id: 'task-1',
      prospectId: 'customer-1',
      title: 'Call',
      kind: 'call',
      dueAt: VALID_DATE,
      done: true,
      completedAt: VALID_DATE,
      salesRep: 'Will',
      createdAt: VALID_DATE,
    }],
    timeline: [{
      id: 'event-1',
      prospectId: 'customer-1',
      type: 'call',
      title: 'Called',
      body: 'Reached owner',
      searchableText: 'called reached owner',
      createdAt: VALID_DATE,
    }],
    templates: [],
    sentEmails: [],
    attachments: [],
  })

  assert.deepEqual(migrateState(current), current)
})
