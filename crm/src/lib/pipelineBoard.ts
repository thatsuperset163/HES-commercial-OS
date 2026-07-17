import type { PipelineStage, Prospect } from '../types.ts'
import type { LeadStatus } from './salesApi.ts'
import { PIPELINE_TO_V2 } from './v2Adapter.ts'

export const BOARD_STAGES = [
  { id: 'prospecting', label: 'Prospecting' },
  { id: 'discovery', label: 'Discovery' },
  { id: 'site_visit', label: 'Site Visit' },
  { id: 'proposal', label: 'Proposal' },
  { id: 'negotiation', label: 'Negotiation' },
  { id: 'won', label: 'Won' },
  { id: 'lost', label: 'Lost' },
] as const

export type BoardStageId = (typeof BOARD_STAGES)[number]['id']

const BOARD_DEFAULTS: Record<
  BoardStageId,
  { stage: PipelineStage; lead_status: LeadStatus }
> = {
  prospecting: { stage: 'follow_up_due', lead_status: 'contacted' },
  discovery: { stage: 'interested', lead_status: 'qualified' },
  site_visit: { stage: 'site_visit_scheduled', lead_status: 'qualified' },
  proposal: { stage: 'proposal_sent', lead_status: 'qualified' },
  negotiation: { stage: 'proposal_sent', lead_status: 'qualified' },
  won: { stage: 'won', lead_status: 'converted' },
  lost: { stage: 'lost', lead_status: 'lost' },
}

export function boardStageId(prospect: Prospect): BoardStageId {
  const fromOpp = prospect.opportunityStageId
  if (fromOpp && BOARD_STAGES.some((s) => s.id === fromOpp)) {
    return fromOpp as BoardStageId
  }
  return PIPELINE_TO_V2[prospect.stage].stage_id as BoardStageId
}

/** Keep finer lead status when staying in the same board column family. */
export function pipelineForBoardMove(
  current: PipelineStage,
  target: BoardStageId,
): { stage: PipelineStage; lead_status: LeadStatus } {
  const currentBoard = PIPELINE_TO_V2[current].stage_id
  if (currentBoard === target && target !== 'negotiation') {
    return {
      stage: current,
      lead_status: PIPELINE_TO_V2[current].lead_status,
    }
  }
  return BOARD_DEFAULTS[target]
}

export function groupProspectsByBoardStage(prospects: Prospect[]) {
  const groups: Record<BoardStageId, Prospect[]> = {
    prospecting: [],
    discovery: [],
    site_visit: [],
    proposal: [],
    negotiation: [],
    won: [],
    lost: [],
  }
  for (const prospect of prospects) {
    groups[boardStageId(prospect)].push(prospect)
  }
  for (const stage of BOARD_STAGES) {
    groups[stage.id].sort((a, b) => {
      const av = Number(a.estimatedJobValue || 0)
      const bv = Number(b.estimatedJobValue || 0)
      if (bv !== av) return bv - av
      return b.updatedAt.localeCompare(a.updatedAt)
    })
  }
  return groups
}

export function columnJobValue(prospects: Prospect[]) {
  return prospects.reduce(
    (sum, p) => sum + Number(p.estimatedJobValue || 0),
    0,
  )
}
