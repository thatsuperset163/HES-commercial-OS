import assert from 'node:assert/strict'
import test from 'node:test'

import {
  boardStageId,
  groupProspectsByBoardStage,
  pipelineForBoardMove,
} from '../src/lib/pipelineBoard.ts'
import { emptyProspectDraft } from '../src/types.ts'
import type { Prospect } from '../src/types.ts'

function prospect(partial: Partial<Prospect> & { id: string }): Prospect {
  return {
    ...emptyProspectDraft('Will'),
    businessName: 'Test Co',
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-07-10T00:00:00.000Z',
    ...partial,
  }
}

test('boardStageId prefers opportunityStageId then pipeline mapping', () => {
  assert.equal(
    boardStageId(prospect({ id: '1', stage: 'proposal_sent' })),
    'proposal',
  )
  assert.equal(
    boardStageId(
      prospect({
        id: '2',
        stage: 'proposal_sent',
        opportunityStageId: 'negotiation',
      }),
    ),
    'negotiation',
  )
})

test('pipelineForBoardMove keeps finer status inside the same column', () => {
  const same = pipelineForBoardMove('email_sent', 'prospecting')
  assert.equal(same.stage, 'email_sent')
  assert.equal(same.lead_status, 'contacted')

  const moved = pipelineForBoardMove('email_sent', 'discovery')
  assert.equal(moved.stage, 'interested')
  assert.equal(moved.lead_status, 'qualified')
})

test('groups prospects into board columns by value', () => {
  const groups = groupProspectsByBoardStage([
    prospect({
      id: 'a',
      stage: 'interested',
      estimatedJobValue: 1000,
      businessName: 'Small',
    }),
    prospect({
      id: 'b',
      stage: 'interested',
      estimatedJobValue: 9000,
      businessName: 'Big',
    }),
    prospect({ id: 'c', stage: 'won', businessName: 'Closed' }),
  ])

  assert.equal(groups.discovery[0]?.id, 'b')
  assert.equal(groups.discovery[1]?.id, 'a')
  assert.equal(groups.won.length, 1)
  assert.equal(groups.prospecting.length, 0)
})
