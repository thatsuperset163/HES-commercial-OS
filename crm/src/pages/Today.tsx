import { Link } from 'react-router-dom'
import { useMemo } from 'react'
import { useSales } from '../store/SalesContext'
import {
  formatDate,
  isOverdue,
  isToday,
  isThisMonth,
} from '../lib/dates'
import { OPEN_STAGES } from '../types'
import './Today.css'

function money(value: number | null | undefined) {
  const n = Number(value || 0)
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(n)
}

export function Today() {
  const { state, completeTask, logCall, dashboard, apiMode } = useSales()

  const dueTasks = useMemo(
    () =>
      state.tasks
        .filter((t) => !t.done && (isToday(t.dueAt) || isOverdue(t.dueAt)))
        .sort((a, b) => a.dueAt.localeCompare(b.dueAt)),
    [state.tasks],
  )

  const callsDue = dueTasks.filter((t) => t.kind === 'call')
  const emailsDue = dueTasks.filter((t) => t.kind === 'email')
  const siteVisits = [
    ...dueTasks.filter((t) => t.kind === 'visit'),
    ...state.prospects.filter(
      (p) =>
        p.stage === 'site_visit_scheduled' && isToday(p.nextFollowUpAt),
    ),
  ]
  const quotesWaiting = [
    ...dueTasks.filter((t) => t.kind === 'quote'),
    ...state.prospects.filter((p) => p.stage === 'proposal_sent' || p.stage === 'interested'),
  ]

  const wonMonth = state.prospects.filter(
    (p) => p.stage === 'won' && isThisMonth(p.updatedAt),
  )
  const lost = state.prospects.filter((p) => p.stage === 'lost')
  const highPriority = state.prospects.filter(
    (p) => OPEN_STAGES.includes(p.stage) && p.priority === 'high',
  )
  const openCount = state.prospects.filter((p) => OPEN_STAGES.includes(p.stage)).length

  const metrics = dashboard?.metrics
  const followUpsToday = metrics?.todaysFollowUps ?? dueTasks.length
  const overdueFollowUps = metrics?.overdueFollowUps
  const newThisWeek = metrics?.newProspectsThisWeek
  const pipelineJob = metrics?.openPipelineJobValue
  const pipelineAnnual = metrics?.openPipelineAnnualValue
  const wonCount = metrics?.wonCount ?? wonMonth.length
  const lostCount = metrics?.lostCount ?? lost.length

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
          <span>Follow-ups today</span>
          <strong>{followUpsToday}</strong>
        </div>
        <div className="metric">
          <span>Overdue follow-ups</span>
          <strong>{overdueFollowUps ?? dueTasks.filter((t) => isOverdue(t.dueAt)).length}</strong>
        </div>
        <div className="metric">
          <span>Calls due</span>
          <strong>{callsDue.length}</strong>
        </div>
        <div className="metric">
          <span>Emails due</span>
          <strong>{emailsDue.length}</strong>
        </div>
        <div className="metric">
          <span>Site visits</span>
          <strong>{siteVisits.length}</strong>
        </div>
        <div className="metric">
          <span>Proposals waiting</span>
          <strong>{quotesWaiting.length}</strong>
        </div>
        <div className="metric">
          <span>High priority</span>
          <strong>{highPriority.length}</strong>
        </div>
        <div className="metric">
          <span>New this week</span>
          <strong>{newThisWeek ?? '—'}</strong>
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
        {openCount} open opportunities · focus high-priority decision makers first
        {apiMode === 'v2' ? ' · metrics from Sales v2' : ''}
      </p>

      <section className="panel">
        <div className="panel-head">
          <h2>Next actions</h2>
        </div>
        {dueTasks.length === 0 ? (
          <p className="empty">No tasks due. Add follow-ups on a prospect.</p>
        ) : (
          <ul className="action-list">
            {dueTasks.map((t) => {
              const p = state.prospects.find((x) => x.id === t.prospectId)
              return (
                <li key={t.id} className="action-row">
                  <div className="action-main">
                    <span className={`pill ${t.kind}`}>{t.kind}</span>
                    <div>
                      <strong>{t.title}</strong>
                      <span>
                        <Link to={`/prospects/${t.prospectId}`}>
                          {p?.businessName ?? 'Prospect'}
                        </Link>
                        {' · '}
                        {isOverdue(t.dueAt) ? 'Overdue' : 'Today'}
                        {' · '}
                        {formatDate(t.dueAt)}
                      </span>
                    </div>
                  </div>
                  <div className="action-ctas">
                    {t.kind === 'call' && (
                      <button
                        type="button"
                        className="btn small secondary"
                        onClick={() => logCall(t.prospectId, 'Logged from Today')}
                      >
                        Log call
                      </button>
                    )}
                    {t.kind === 'email' && (
                      <Link className="btn small secondary" to={`/emails?prospect=${t.prospectId}`}>
                        Draft email
                      </Link>
                    )}
                    <button
                      type="button"
                      className="btn small"
                      onClick={() => completeTask(t.id)}
                    >
                      Done
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      {apiMode === 'v2' && dashboard && dashboard.largestOpportunities.length > 0 && (
        <section className="panel">
          <div className="panel-head">
            <h2>Largest open opportunities</h2>
          </div>
          <ul className="action-list">
            {dashboard.largestOpportunities.slice(0, 5).map((opp) => (
              <li key={opp.id} className="action-row">
                <div className="action-main">
                  <div>
                    <strong>
                      <Link to={`/prospects/${opp.id}`}>
                        {opp.company?.name || opp.name}
                      </Link>
                    </strong>
                    <span>
                      {money(opp.estimated_job_value)} job ·{' '}
                      {money(opp.estimated_annual_value)} annual
                    </span>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
