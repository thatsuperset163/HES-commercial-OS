import assert from 'node:assert/strict'
import test from 'node:test'

import { buildNextActions, summarizeNextActions } from '../src/lib/nextActions.ts'
import { CURRENT_SALES_STATE_SCHEMA_VERSION, emptyProspectDraft } from '../src/types.ts'
import type { Prospect, SalesState, Task } from '../src/types.ts'

const NOW = new Date('2026-07-17T15:00:00.000Z')

function prospect(partial: Partial<Prospect> & { id: string; businessName: string }): Prospect {
  return {
    ...emptyProspectDraft('Will'),
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-07-10T00:00:00.000Z',
    ...partial,
  }
}

function task(partial: Partial<Task> & { id: string; prospectId: string; title: string }): Task {
  return {
    kind: 'call',
    dueAt: '2026-07-17T12:00:00.000Z',
    done: false,
    completedAt: null,
    salesRep: 'Will',
    createdAt: '2026-07-16T00:00:00.000Z',
    ...partial,
  }
}

function state(prospects: Prospect[], tasks: Task[] = []): SalesState {
  return {
    schemaVersion: CURRENT_SALES_STATE_SCHEMA_VERSION,
    prospects,
    tasks,
    timeline: [],
    templates: [],
    sentEmails: [],
    attachments: [],
  }
}

test('ranks overdue high-value tasks ahead of today medium tasks', () => {
  const actions = buildNextActions(
    state(
      [
        prospect({
          id: 'a',
          businessName: 'Alpha HOA',
          decisionMaker: 'Ann',
          stage: 'follow_up_due',
          priority: 'medium',
          estimatedJobValue: 2000,
        }),
        prospect({
          id: 'b',
          businessName: 'Beta Apartments',
          decisionMaker: 'Bob',
          stage: 'proposal_sent',
          priority: 'high',
          estimatedJobValue: 12000,
        }),
      ],
      [
        task({
          id: 't1',
          prospectId: 'a',
          title: 'Call Ann',
          dueAt: '2026-07-17T12:00:00.000Z',
          kind: 'call',
        }),
        task({
          id: 't2',
          prospectId: 'b',
          title: 'Chase proposal',
          dueAt: '2026-07-10T12:00:00.000Z',
          kind: 'quote',
        }),
      ],
    ),
    NOW,
  )

  assert.equal(actions[0]?.prospectId, 'b')
  assert.equal(actions[0]?.urgency, 'overdue')
  assert.match(actions[0]?.reason ?? '', /overdue/i)
  assert.match(actions[0]?.reason ?? '', /\$12,000|high priority|proposal/i)
  assert.equal(actions[1]?.prospectId, 'a')
})

test('creates implied follow-ups for open opportunities without tasks', () => {
  const actions = buildNextActions(
    state([
      prospect({
        id: 'cold',
        businessName: 'Cold Church',
        decisionMaker: 'Chris',
        stage: 'not_contacted',
        priority: 'high',
        estimatedJobValue: 8000,
        lastContactAt: null,
        nextFollowUpAt: null,
      }),
      prospect({
        id: 'proposal',
        businessName: 'Proposal Park',
        decisionMaker: 'Pat',
        stage: 'proposal_sent',
        priority: 'medium',
        estimatedJobValue: 5000,
        nextFollowUpAt: '2026-07-16T12:00:00.000Z',
      }),
    ]),
    NOW,
  )

  assert.ok(actions.some((a) => a.prospectId === 'cold' && a.kind === 'email'))
  assert.ok(actions.some((a) => a.prospectId === 'proposal' && a.urgency === 'overdue'))
  const summary = summarizeNextActions(actions)
  assert.ok(summary.total >= 2)
})

test('ignores won/lost and completed tasks', () => {
  const actions = buildNextActions(
    state(
      [
        prospect({
          id: 'won',
          businessName: 'Won Co',
          stage: 'won',
          priority: 'high',
          estimatedJobValue: 50000,
        }),
        prospect({
          id: 'open',
          businessName: 'Open Co',
          stage: 'called',
          priority: 'low',
          nextFollowUpAt: '2026-07-17T09:00:00.000Z',
        }),
      ],
      [
        task({
          id: 'done',
          prospectId: 'open',
          title: 'Already done',
          done: true,
          dueAt: '2026-07-10T09:00:00.000Z',
        }),
      ],
    ),
    NOW,
  )

  assert.ok(actions.every((a) => a.prospectId !== 'won'))
  assert.ok(actions.every((a) => a.taskId !== 'done'))
  assert.ok(actions.some((a) => a.prospectId === 'open'))
})
