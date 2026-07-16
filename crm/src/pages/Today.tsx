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

export function Today() {
  const { state, completeTask, logCall } = useSales()

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
          <span>Tasks due today</span>
          <strong>{dueTasks.length}</strong>
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
          <span>Won this month</span>
          <strong>{wonMonth.length}</strong>
        </div>
        <div className="metric">
          <span>Lost opportunities</span>
          <strong>{lost.length}</strong>
        </div>
      </section>

      <p className="open-line muted">
        {openCount} open opportunities · focus high-priority decision makers first
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
    </div>
  )
}
