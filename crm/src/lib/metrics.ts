import type { Prospect, ProspectPriority, SalesState, TimelineEventType } from '../types'
import { OPEN_STAGES } from '../types'
import { isThisMonth } from './dates'

const PRIORITY_WEIGHT: Record<ProspectPriority, number> = {
  high: 3,
  medium: 2,
  low: 1,
}

/** Priority weight for pipeline scoring (no dollar quotes). */
export function weightedValue(p: Prospect) {
  if (!OPEN_STAGES.includes(p.stage)) return 0
  return PRIORITY_WEIGHT[p.priority] ?? 1
}

export function pipelineValue(prospects: Prospect[]) {
  return prospects
    .filter((p) => OPEN_STAGES.includes(p.stage))
    .reduce((sum, p) => sum + weightedValue(p), 0)
}

export function computeAnalytics(state: SalesState) {
  const open = state.prospects.filter((p) => OPEN_STAGES.includes(p.stage))
  const closed = state.prospects.filter((p) => p.stage === 'won' || p.stage === 'lost')
  const won = state.prospects.filter((p) => p.stage === 'won')
  const wonMonth = won.filter((p) => isThisMonth(p.updatedAt))
  const lost = state.prospects.filter((p) => p.stage === 'lost')
  const highPriority = open.filter((p) => p.priority === 'high')

  const countType = (type: TimelineEventType) =>
    state.timeline.filter((e) => e.type === type).length

  return {
    openOpportunities: open.length,
    revenuePipeline: pipelineValue(state.prospects),
    closingPct: closed.length ? won.length / closed.length : 0,
    averageDealSize: 0,
    emailsSent: state.sentEmails.length || countType('email'),
    callsMade: countType('call') + countType('voicemail'),
    meetingsBooked: countType('meeting'),
    quotesSent: countType('quote'),
    jobsWon: won.length,
    wonThisMonth: wonMonth.length,
    wonThisMonthCount: wonMonth.length,
    lostCount: lost.length,
    revenueWon: won.length,
    highPriorityOpen: highPriority.length,
  }
}
