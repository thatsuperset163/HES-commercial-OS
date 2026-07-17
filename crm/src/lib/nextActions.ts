import type {
  PipelineStage,
  Prospect,
  ProspectPriority,
  SalesState,
  Task,
  TaskKind,
} from '../types.ts'
import { OPEN_STAGES } from '../types.ts'
import { isOverdue, isToday, startOfDay } from './dates.ts'

export type ActionUrgency = 'overdue' | 'today' | 'soon' | 'opportunity'

export interface NextAction {
  id: string
  prospectId: string
  taskId?: string
  kind: TaskKind
  title: string
  reason: string
  dueAt: string | null
  score: number
  urgency: ActionUrgency
  jobValue: number
  businessName: string
  decisionMaker: string
  stage: PipelineStage
  priority: ProspectPriority
}

const PRIORITY_SCORE: Record<ProspectPriority, number> = {
  high: 40,
  medium: 20,
  low: 8,
}

const STAGE_ACTION: Record<
  PipelineStage,
  { kind: TaskKind; title: string }
> = {
  not_contacted: { kind: 'email', title: 'Send first outreach email' },
  email_sent: { kind: 'call', title: 'Call after email' },
  follow_up_due: { kind: 'call', title: 'Follow up with decision maker' },
  called: { kind: 'call', title: 'Call again / leave a clear next step' },
  left_voicemail: { kind: 'call', title: 'Call back after voicemail' },
  spoke_with_dm: { kind: 'call', title: 'Advance the conversation' },
  interested: { kind: 'visit', title: 'Book a site visit' },
  site_visit_scheduled: { kind: 'visit', title: 'Prepare / confirm site visit' },
  proposal_sent: { kind: 'quote', title: 'Follow up on proposal' },
  won: { kind: 'other', title: 'Close out won job' },
  lost: { kind: 'other', title: 'Archive lost opportunity' },
  future_opportunity: { kind: 'email', title: 'Nurture for later' },
}

function daysBetween(from: Date, to: Date) {
  const ms = startOfDay(to).getTime() - startOfDay(from).getTime()
  return Math.floor(ms / 86400000)
}

function daysOverdue(iso: string | null | undefined, now: Date) {
  if (!iso) return 0
  const due = new Date(iso)
  if (due >= startOfDay(now)) return 0
  return Math.max(1, daysBetween(due, now))
}

function daysSince(iso: string | null | undefined, now: Date) {
  if (!iso) return 999
  return Math.max(0, daysBetween(new Date(iso), now))
}

function moneyLabel(value: number) {
  if (!value) return ''
  return `$${Math.round(value).toLocaleString('en-US')}`
}

function urgencyForDue(dueAt: string | null | undefined, now: Date): ActionUrgency {
  if (!dueAt) return 'opportunity'
  if (isOverdue(dueAt) || new Date(dueAt) < startOfDay(now)) return 'overdue'
  if (isToday(dueAt)) return 'today'
  return 'soon'
}

function scoreAction(input: {
  urgency: ActionUrgency
  overdueDays: number
  priority: ProspectPriority
  jobValue: number
  stage: PipelineStage
  staleDays: number
}): number {
  let score = PRIORITY_SCORE[input.priority] ?? 10

  if (input.urgency === 'overdue') score += 100 + input.overdueDays * 12
  else if (input.urgency === 'today') score += 70
  else if (input.urgency === 'soon') score += 35
  else score += 15

  score += Math.min(60, Math.round(input.jobValue / 500))

  if (input.stage === 'proposal_sent') score += 25
  if (input.stage === 'site_visit_scheduled') score += 20
  if (input.stage === 'interested' || input.stage === 'spoke_with_dm') score += 12
  if (input.staleDays >= 7) score += Math.min(30, input.staleDays)

  return score
}

function buildReason(input: {
  urgency: ActionUrgency
  overdueDays: number
  priority: ProspectPriority
  jobValue: number
  stage: PipelineStage
  staleDays: number
  fromTask: boolean
}): string {
  const parts: string[] = []

  if (input.urgency === 'overdue') {
    parts.push(
      input.overdueDays === 1
        ? '1 day overdue'
        : `${input.overdueDays} days overdue`,
    )
  } else if (input.urgency === 'today') {
    parts.push('due today')
  } else if (input.urgency === 'soon') {
    parts.push('coming up')
  }

  if (input.priority === 'high') parts.push('high priority')
  if (input.jobValue > 0) parts.push(`${moneyLabel(input.jobValue)} job value`)

  if (input.stage === 'proposal_sent') parts.push('proposal waiting')
  else if (input.stage === 'site_visit_scheduled') parts.push('site visit on deck')
  else if (input.stage === 'not_contacted') parts.push('not contacted yet')
  else if (input.staleDays >= 7 && input.staleDays < 900) {
    parts.push(`no contact in ${input.staleDays} days`)
  }

  if (!input.fromTask && parts.length === 0) {
    parts.push('best open opportunity to move')
  }

  return parts.join(' · ')
}

function suggestedForProspect(p: Prospect) {
  return STAGE_ACTION[p.stage] ?? {
    kind: 'call' as TaskKind,
    title: 'Follow up',
  }
}

function openProspects(state: SalesState) {
  return state.prospects.filter((p) => OPEN_STAGES.includes(p.stage))
}

function openTasksForProspect(tasks: Task[], prospectId: string) {
  return tasks.filter((t) => t.prospectId === prospectId && !t.done)
}

/**
 * Ranked “what should I do next” queue for Commercial Sales.
 * Combines due tasks with implied follow-ups on open opportunities.
 */
export function buildNextActions(
  state: SalesState,
  now = new Date(),
  limit = 20,
): NextAction[] {
  const actions: NextAction[] = []
  const covered = new Set<string>()

  for (const task of state.tasks) {
    if (task.done) continue
    const due = task.dueAt
    const urgency = urgencyForDue(due, now)
    if (urgency !== 'overdue' && urgency !== 'today') continue

    const prospect = state.prospects.find((p) => p.id === task.prospectId)
    if (!prospect || !OPEN_STAGES.includes(prospect.stage)) continue

    const overdueDays = daysOverdue(due, now)
    const jobValue = Number(prospect.estimatedJobValue || 0)
    const staleDays = daysSince(prospect.lastContactAt, now)
    const score = scoreAction({
      urgency,
      overdueDays,
      priority: prospect.priority,
      jobValue,
      stage: prospect.stage,
      staleDays,
    })

    actions.push({
      id: `task:${task.id}`,
      prospectId: prospect.id,
      taskId: task.id,
      kind: task.kind,
      title: task.title,
      reason: buildReason({
        urgency,
        overdueDays,
        priority: prospect.priority,
        jobValue,
        stage: prospect.stage,
        staleDays,
        fromTask: true,
      }),
      dueAt: due,
      score: score + 8,
      urgency,
      jobValue,
      businessName: prospect.businessName,
      decisionMaker: prospect.decisionMaker,
      stage: prospect.stage,
      priority: prospect.priority,
    })
    covered.add(prospect.id)
  }

  for (const prospect of openProspects(state)) {
    if (covered.has(prospect.id)) continue

    const openTasks = openTasksForProspect(state.tasks, prospect.id)
    const followUpDue =
      prospect.nextFollowUpAt &&
      (isOverdue(prospect.nextFollowUpAt) || isToday(prospect.nextFollowUpAt))

    const staleDays = daysSince(prospect.lastContactAt, now)
    const followUpScheduledLater =
      Boolean(prospect.nextFollowUpAt) &&
      !isOverdue(prospect.nextFollowUpAt) &&
      !isToday(prospect.nextFollowUpAt)

    const needsColdOutreach =
      prospect.stage === 'not_contacted' &&
      !prospect.lastContactAt &&
      openTasks.length === 0 &&
      !followUpScheduledLater

    const proposalWaiting =
      prospect.stage === 'proposal_sent' &&
      openTasks.length === 0 &&
      !followUpScheduledLater

    const highValueStale =
      prospect.priority === 'high' &&
      staleDays >= 5 &&
      openTasks.length === 0 &&
      !followUpScheduledLater

    if (!followUpDue && !needsColdOutreach && !proposalWaiting && !highValueStale) {
      continue
    }

    const suggested = suggestedForProspect(prospect)
    const dueAt = prospect.nextFollowUpAt
    const urgency = followUpDue
      ? urgencyForDue(dueAt, now)
      : proposalWaiting || needsColdOutreach
        ? staleDays >= 7
          ? 'overdue'
          : 'opportunity'
        : 'opportunity'
    const overdueDays = followUpDue ? daysOverdue(dueAt, now) : Math.max(0, staleDays - 5)
    const jobValue = Number(prospect.estimatedJobValue || 0)
    const score = scoreAction({
      urgency,
      overdueDays,
      priority: prospect.priority,
      jobValue,
      stage: prospect.stage,
      staleDays,
    })

    let title = suggested.title
    if (followUpDue) title = `Follow up with ${prospect.decisionMaker || 'decision maker'}`
    if (proposalWaiting) title = 'Follow up on proposal'
    if (needsColdOutreach) title = 'First outreach to decision maker'

    actions.push({
      id: `opp:${prospect.id}:${suggested.kind}`,
      prospectId: prospect.id,
      kind: suggested.kind,
      title,
      reason: buildReason({
        urgency,
        overdueDays,
        priority: prospect.priority,
        jobValue,
        stage: prospect.stage,
        staleDays,
        fromTask: false,
      }),
      dueAt,
      score,
      urgency,
      jobValue,
      businessName: prospect.businessName,
      decisionMaker: prospect.decisionMaker,
      stage: prospect.stage,
      priority: prospect.priority,
    })
    covered.add(prospect.id)
  }

  return actions.sort((a, b) => b.score - a.score || (a.dueAt || '').localeCompare(b.dueAt || '')).slice(0, limit)
}

export function summarizeNextActions(actions: NextAction[]) {
  return {
    total: actions.length,
    overdue: actions.filter((a) => a.urgency === 'overdue').length,
    today: actions.filter((a) => a.urgency === 'today').length,
    calls: actions.filter((a) => a.kind === 'call').length,
    emails: actions.filter((a) => a.kind === 'email').length,
    visits: actions.filter((a) => a.kind === 'visit').length,
    quotes: actions.filter((a) => a.kind === 'quote').length,
  }
}
