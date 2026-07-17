import { Link } from 'react-router-dom'
import { useMemo } from 'react'
import { useSales } from '../store/SalesContext'
import {
  daysFromNow,
  formatDate,
  formatMoney,
  isOverdue,
  isThisMonth,
} from '../lib/dates'
import { buildNextActions, summarizeNextActions } from '../lib/nextActions'
import { OPEN_STAGES, STAGES } from '../types'
import './Today.css'

function money(value: number | null | undefined) {
  return formatMoney(Number(value || 0))
}

function urgencyLabel(urgency: string) {
  if (urgency === 'overdue') return 'Overdue'
  if (urgency === 'today') return 'Today'
  if (urgency === 'soon') return 'Soon'
  return 'Opportunity'
}

export function Today() {
  const {
    state,
    completeTask,
    rescheduleTask,
    logCall,
    updateProspect,
    dashboard,
    apiMode,
  } = useSales()

  const actions = useMemo(() => buildNextActions(state), [state])
  const summary = useMemo(() => summarizeNextActions(actions), [actions])
  const top = actions[0] ?? null

  const openCount = state.prospects.filter((p) => OPEN_STAGES.includes(p.stage)).length
  const highPriority = state.prospects.filter(
    (p) => OPEN_STAGES.includes(p.stage) && p.priority === 'high',
  ).length
  const wonMonth = state.prospects.filter(
    (p) => p.stage === 'won' && isThisMonth(p.updatedAt),
  ).length

  const metrics = dashboard?.metrics
  const pipelineJob = metrics?.openPipelineJobValue
  const pipelineAnnual = metrics?.openPipelineAnnualValue
  const wonCount = metrics?.wonCount ?? wonMonth
  const lostCount = metrics?.lostCount ?? state.prospects.filter((p) => p.stage === 'lost').length

  function snoozeAction(action: (typeof actions)[number], days: number) {
    const dueAt = daysFromNow(days)
    if (action.taskId) {
      rescheduleTask(action.taskId, dueAt)
      return
    }
    updateProspect(action.prospectId, { nextFollowUpAt: dueAt })
  }

  return (
    <div className="page today-page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Harris Exterior Solutions</p>
          <h1>Today</h1>
          <p className="lede">
            What to do next to reach the next decision maker and book the job.
          </p>
        </div>
        <Link className="btn" to="/prospects">
          Open prospects
        </Link>
      </header>

      <section className="metric-strip" aria-label="Today metrics">
        <div className="metric">
          <span>Next actions</span>
          <strong>{summary.total}</strong>
        </div>
        <div className="metric">
          <span>Overdue</span>
          <strong>{summary.overdue}</strong>
        </div>
        <div className="metric">
          <span>Due today</span>
          <strong>{summary.today}</strong>
        </div>
        <div className="metric">
          <span>High priority</span>
          <strong>{highPriority}</strong>
        </div>
        <div className="metric">
          <span>Open job value</span>
          <strong>{apiMode === 'v2' ? money(pipelineJob) : '—'}</strong>
        </div>
        <div className="metric">
          <span>Open annual value</span>
          <strong>{apiMode === 'v2' ? money(pipelineAnnual) : '—'}</strong>
        </div>
        <div className="metric">
          <span>Won</span>
          <strong>{wonCount}</strong>
        </div>
        <div className="metric">
          <span>Lost</span>
          <strong>{lostCount}</strong>
        </div>
      </section>

      <p className="open-line muted">
        {openCount} open opportunities · ranked by overdue, priority, and job value
        {apiMode === 'v2' ? ' · Sales v2' : ''}
      </p>

      {top && (
        <section className="panel focus-panel" aria-label="Do this next">
          <div className="panel-head">
            <h2>Do this next</h2>
            <span className={`urgency-tag ${top.urgency}`}>
              {urgencyLabel(top.urgency)}
            </span>
          </div>
          <div className="focus-body">
            <span className={`pill ${top.kind}`}>{top.kind}</span>
            <div className="focus-copy">
              <strong>{top.title}</strong>
              <p>
                <Link to={`/prospects/${top.prospectId}`}>
                  {top.decisionMaker || top.businessName}
                </Link>
                {top.decisionMaker ? ` · ${top.businessName}` : ''}
              </p>
              <p className="focus-reason">{top.reason}</p>
              <p className="focus-meta">
                {STAGES.find((s) => s.id === top.stage)?.label}
                {top.dueAt
                  ? ` · ${isOverdue(top.dueAt) ? 'Was due' : 'Due'} ${formatDate(top.dueAt)}`
                  : ''}
                {top.jobValue > 0 ? ` · ${money(top.jobValue)}` : ''}
              </p>
            </div>
          </div>
          <div className="action-ctas focus-ctas">
            {top.kind === 'call' && (
              <button
                type="button"
                className="btn"
                onClick={() => logCall(top.prospectId, 'Logged from Today focus')}
              >
                Log call
              </button>
            )}
            {top.kind === 'email' && (
              <Link className="btn" to={`/emails?prospect=${top.prospectId}`}>
                Draft email
              </Link>
            )}
            {top.kind === 'visit' && (
              <Link className="btn" to={`/prospects/${top.prospectId}`}>
                Open visit
              </Link>
            )}
            {top.kind === 'quote' && (
              <Link className="btn" to={`/prospects/${top.prospectId}`}>
                Open proposal
              </Link>
            )}
            {top.taskId && (
              <button
                type="button"
                className="btn secondary"
                onClick={() => completeTask(top.taskId!)}
              >
                Done
              </button>
            )}
            <button
              type="button"
              className="btn secondary"
              onClick={() => snoozeAction(top, 1)}
            >
              Snooze 1 day
            </button>
            <button
              type="button"
              className="btn secondary"
              onClick={() => snoozeAction(top, 3)}
            >
              Snooze 3 days
            </button>
          </div>
        </section>
      )}

      <section className="panel">
        <div className="panel-head">
          <h2>Ranked queue</h2>
          <span className="muted queue-count">
            {summary.calls} calls · {summary.emails} emails · {summary.visits} visits ·{' '}
            {summary.quotes} quotes
          </span>
        </div>
        {actions.length === 0 ? (
          <p className="empty">
            Queue clear. Add a follow-up date or task on a prospect to fill Today.
          </p>
        ) : (
          <ul className="action-list">
            {actions.map((action, index) => (
              <li key={action.id} className="action-row">
                <div className="action-main">
                  <span className="rank-num" aria-hidden>
                    {index + 1}
                  </span>
                  <span className={`pill ${action.kind}`}>{action.kind}</span>
                  <div>
                    <strong>{action.title}</strong>
                    <span>
                      <Link to={`/prospects/${action.prospectId}`}>
                        {action.businessName}
                      </Link>
                      {action.decisionMaker ? ` · ${action.decisionMaker}` : ''}
                    </span>
                    <span className="action-reason">{action.reason}</span>
                  </div>
                </div>
                <div className="action-ctas">
                  <span className={`urgency-tag ${action.urgency}`}>
                    {urgencyLabel(action.urgency)}
                  </span>
                  {action.kind === 'call' && (
                    <button
                      type="button"
                      className="btn small secondary"
                      onClick={() => logCall(action.prospectId, 'Logged from Today')}
                    >
                      Log call
                    </button>
                  )}
                  {action.kind === 'email' && (
                    <Link
                      className="btn small secondary"
                      to={`/emails?prospect=${action.prospectId}`}
                    >
                      Draft email
                    </Link>
                  )}
                  {action.taskId ? (
                    <button
                      type="button"
                      className="btn small"
                      onClick={() => completeTask(action.taskId!)}
                    >
                      Done
                    </button>
                  ) : (
                    <Link
                      className="btn small"
                      to={`/prospects/${action.prospectId}`}
                    >
                      Open
                    </Link>
                  )}
                  <button
                    type="button"
                    className="btn small secondary"
                    onClick={() => snoozeAction(action, 1)}
                  >
                    Snooze
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
