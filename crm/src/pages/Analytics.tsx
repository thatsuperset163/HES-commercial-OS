import { useSales } from '../store/SalesContext'
import { computeAnalytics } from '../lib/metrics'
import { formatMoney } from '../lib/dates'
import './Analytics.css'

function pct(n: number) {
  return `${Math.round(n * 100)}%`
}

export function Analytics() {
  const { state } = useSales()
  const a = computeAnalytics(state)

  const cards = [
    { label: 'Open opportunities', value: String(a.openOpportunities) },
    { label: 'Revenue pipeline', value: formatMoney(a.revenuePipeline) },
    { label: 'Closing %', value: pct(a.closingPct) },
    { label: 'Average deal size', value: formatMoney(a.averageDealSize) },
    { label: 'Emails sent', value: String(a.emailsSent) },
    { label: 'Calls made', value: String(a.callsMade) },
    { label: 'Meetings booked', value: String(a.meetingsBooked) },
    { label: 'Quotes sent', value: String(a.quotesSent) },
    { label: 'Jobs won', value: String(a.jobsWon) },
  ]

  return (
    <div className="page analytics-page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Performance</p>
          <h1>Analytics</h1>
          <p className="lede">
            Pipeline and activity from logged timeline events — no vanity open rates.
          </p>
        </div>
      </header>

      <section className="analytics-hero">
        <div>
          <span>Revenue pipeline</span>
          <strong>{formatMoney(a.revenuePipeline)}</strong>
          <p>{a.openOpportunities} open commercial opportunities (weighted)</p>
        </div>
        <div>
          <span>Won this month</span>
          <strong>{formatMoney(a.wonThisMonth)}</strong>
          <p>
            {a.wonThisMonthCount} job{a.wonThisMonthCount === 1 ? '' : 's'} closed ·{' '}
            {a.lostCount} lost overall
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
