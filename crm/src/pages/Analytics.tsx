import { useSales } from '../store/SalesContext'
import { computeAnalytics } from '../lib/metrics'
import './Analytics.css'

function pct(n: number) {
  return `${Math.round(n * 100)}%`
}

export function Analytics() {
  const { state } = useSales()
  const a = computeAnalytics(state)

  const cards = [
    { label: 'Open opportunities', value: String(a.openOpportunities) },
    { label: 'High-priority open', value: String(a.highPriorityOpen) },
    { label: 'Closing %', value: pct(a.closingPct) },
    { label: 'Priority score', value: String(a.revenuePipeline) },
    { label: 'Emails sent', value: String(a.emailsSent) },
    { label: 'Calls made', value: String(a.callsMade) },
    { label: 'Meetings booked', value: String(a.meetingsBooked) },
    { label: 'Proposals logged', value: String(a.quotesSent) },
    { label: 'Jobs won', value: String(a.jobsWon) },
  ]

  return (
    <div className="page analytics-page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Performance</p>
          <h1>Analytics</h1>
          <p className="lede">
            Outreach activity and pipeline health — focused on decision-maker progress, not vanity
            metrics.
          </p>
        </div>
      </header>

      <section className="analytics-hero">
        <div>
          <span>Open pipeline</span>
          <strong>{a.openOpportunities}</strong>
          <p>
            {a.highPriorityOpen} high priority · score {a.revenuePipeline}
          </p>
        </div>
        <div>
          <span>Won this month</span>
          <strong>{a.wonThisMonth}</strong>
          <p>
            {a.wonThisMonthCount} closed · {a.lostCount} lost overall
          </p>
        </div>
      </section>

      <section className="analytics-grid">
        {cards.map((c) => (
          <article key={c.label} className="stat">
            <span>{c.label}</span>
            <strong>{c.value}</strong>
          </article>
        ))}
      </section>
    </div>
  )
}
