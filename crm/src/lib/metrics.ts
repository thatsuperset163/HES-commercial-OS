import type { Prospect, SalesState, TimelineEventType } from '../types'
import { OPEN_STAGES } from '../types'
import { isThisMonth } from './dates'

export function weightedValue(p: Prospect) {
  return p.quoteAmount * (Math.min(100, Math.max(0, p.probability)) / 100)
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

  const countType = (type: TimelineEventType) =>
    state.timeline.filter((e) => e.type === type).length

  const revenueWon = won.reduce((s, p) => s + (p.expectedAnnualValue || p.quoteAmount), 0)
  const avgDeal = won.length
    ? won.reduce((s, p) => s + p.quoteAmount, 0) / won.length
    : 0

  return {
    openOpportunities: open.length,
    revenuePipeline: pipelineValue(state.prospects),
    closingPct: closed.length ? won.length / closed.length : 0,
    averageDealSize: avgDeal,
    emailsSent: state.sentEmails.length || countType('email'),
    callsMade: countType('call') + countType('voicemail'),
    meetingsBooked: countType('meeting'),
    quotesSent: countType('quote'),
    jobsWon: won.length,
    wonThisMonth: wonMonth.reduce((s, p) => s + p.quoteAmount, 0),
    wonThisMonthCount: wonMonth.length,
    lostCount: lost.length,
    revenueWon,
  }
}
