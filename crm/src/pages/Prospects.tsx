import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useSales } from '../store/SalesContext'
import { STAGES, INDUSTRIES, type PipelineStage, type Prospect } from '../types'
import { formatDate, formatMoney, fromDateInput, daysFromNow } from '../lib/dates'
import { weightedValue } from '../lib/metrics'
import { serviceLabels } from '../lib/templates'
import './Prospects.css'

type Filters = {
  q: string
  industry: string
  city: string
  stage: PipelineStage | 'all'
  salesRep: string
  lastContact: 'all' | '7' | '30' | 'never'
  nextFollowUp: 'all' | 'overdue' | 'today' | 'week'
  quoteMin: string
}

const emptyProspect = (): Omit<Prospect, 'id' | 'createdAt' | 'updatedAt'> => ({
  businessName: '',
  industry: 'Retail',
  address: '',
  city: '',
  website: '',
  googleMapsUrl: '',
  decisionMaker: '',
  jobTitle: '',
  email: '',
  phone: '',
  linkedIn: '',
  numberOfBuildings: 1,
  estimatedSqFt: 0,
  servicesNeeded: ['pressure_washing'],
  notes: '',
  stage: 'not_researched',
  salesRep: 'Will',
  quoteAmount: 0,
  probability: 10,
  expectedCloseDate: null,
  billingType: 'one_time',
  expectedAnnualValue: 0,
  lastContactAt: null,
  nextFollowUpAt: daysFromNow(1),
})

export function Prospects() {
  const { state, upsertProspect } = useSales()
  const navigate = useNavigate()
  const [showNew, setShowNew] = useState(false)
  const [filters, setFilters] = useState<Filters>({
    q: '',
    industry: 'all',
    city: 'all',
    stage: 'all',
    salesRep: 'all',
    lastContact: 'all',
    nextFollowUp: 'all',
    quoteMin: '',
  })

  const cities = useMemo(
    () => [...new Set(state.prospects.map((p) => p.city).filter(Boolean))].sort(),
    [state.prospects],
  )
  const reps = useMemo(
    () => [...new Set(state.prospects.map((p) => p.salesRep).filter(Boolean))].sort(),
    [state.prospects],
  )

  const filtered = useMemo(() => {
    const now = Date.now()
    const q = filters.q.trim().toLowerCase()
    const minQuote = Number(filters.quoteMin) || 0

    return state.prospects
      .filter((p) => {
        if (filters.industry !== 'all' && p.industry !== filters.industry) return false
        if (filters.city !== 'all' && p.city !== filters.city) return false
        if (filters.stage !== 'all' && p.stage !== filters.stage) return false
        if (filters.salesRep !== 'all' && p.salesRep !== filters.salesRep) return false
        if (p.quoteAmount < minQuote) return false

        if (filters.lastContact === 'never' && p.lastContactAt) return false
        if (filters.lastContact === '7' || filters.lastContact === '30') {
          if (!p.lastContactAt) return false
          const days = (now - new Date(p.lastContactAt).getTime()) / 86400000
          if (filters.lastContact === '7' && days > 7) return false
          if (filters.lastContact === '30' && days > 30) return false
        }

        if (filters.nextFollowUp !== 'all') {
          if (!p.nextFollowUpAt) return false
          const d = new Date(p.nextFollowUpAt)
          const start = new Date()
          start.setHours(0, 0, 0, 0)
          const endWeek = new Date(start)
          endWeek.setDate(endWeek.getDate() + 7)
          if (filters.nextFollowUp === 'overdue' && d >= start) return false
          if (filters.nextFollowUp === 'today') {
            if (
              d.getFullYear() !== start.getFullYear() ||
              d.getMonth() !== start.getMonth() ||
              d.getDate() !== start.getDate()
            )
              return false
          }
          if (filters.nextFollowUp === 'week' && (d < start || d > endWeek)) return false
        }

        if (!q) return true
        return [
          p.businessName,
          p.decisionMaker,
          p.city,
          p.industry,
          p.email,
          p.phone,
          p.notes,
        ]
          .join(' ')
          .toLowerCase()
          .includes(q)
      })
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  }, [state.prospects, filters])

  function createProspect(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const base = emptyProspect()
    const created = upsertProspect({
      ...base,
      businessName: String(fd.get('businessName') || ''),
      industry: String(fd.get('industry') || 'Other'),
      city: String(fd.get('city') || ''),
      decisionMaker: String(fd.get('decisionMaker') || ''),
      email: String(fd.get('email') || ''),
      phone: String(fd.get('phone') || ''),
      address: String(fd.get('address') || ''),
      salesRep: String(fd.get('salesRep') || 'Will'),
      quoteAmount: Number(fd.get('quoteAmount') || 0),
      nextFollowUpAt: fromDateInput(String(fd.get('nextFollowUpAt') || '')),
    })
    setShowNew(false)
    navigate(`/prospects/${created.id}`)
  }

  return (
    <div className="page prospects-page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Database</p>
          <h1>Prospects</h1>
          <p className="lede">Commercial properties that need exterior cleaning contracts.</p>
        </div>
        <button type="button" className="btn" onClick={() => setShowNew(true)}>
          Add prospect
        </button>
      </header>

      <div className="filters">
        <input
          className="search-input"
          placeholder="Search business, contact, city…"
          value={filters.q}
          onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
        />
        <select
          className="field"
          value={filters.industry}
          onChange={(e) => setFilters((f) => ({ ...f, industry: e.target.value }))}
        >
          <option value="all">All industries</option>
          {INDUSTRIES.map((i) => (
            <option key={i} value={i}>
              {i}
            </option>
          ))}
        </select>
        <select
          className="field"
          value={filters.city}
          onChange={(e) => setFilters((f) => ({ ...f, city: e.target.value }))}
        >
          <option value="all">All cities</option>
          {cities.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select
          className="field"
          value={filters.stage}
          onChange={(e) =>
            setFilters((f) => ({ ...f, stage: e.target.value as PipelineStage | 'all' }))
          }
        >
          <option value="all">All stages</option>
          {STAGES.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
        <select
          className="field"
          value={filters.salesRep}
          onChange={(e) => setFilters((f) => ({ ...f, salesRep: e.target.value }))}
        >
          <option value="all">All reps</option>
          {reps.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
        <select
          className="field"
          value={filters.lastContact}
          onChange={(e) =>
            setFilters((f) => ({
              ...f,
              lastContact: e.target.value as Filters['lastContact'],
            }))
          }
        >
          <option value="all">Last contact: any</option>
          <option value="7">Last 7 days</option>
          <option value="30">Last 30 days</option>
          <option value="never">Never contacted</option>
        </select>
        <select
          className="field"
          value={filters.nextFollowUp}
          onChange={(e) =>
            setFilters((f) => ({
              ...f,
              nextFollowUp: e.target.value as Filters['nextFollowUp'],
            }))
          }
        >
          <option value="all">Next follow-up: any</option>
          <option value="overdue">Overdue</option>
          <option value="today">Today</option>
          <option value="week">Next 7 days</option>
        </select>
        <input
          className="field"
          type="number"
          min={0}
          placeholder="Min quote $"
          value={filters.quoteMin}
          onChange={(e) => setFilters((f) => ({ ...f, quoteMin: e.target.value }))}
        />
      </div>

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Business</th>
              <th>Stage</th>
              <th>Services</th>
              <th>Quote</th>
              <th>Weighted</th>
              <th>Next follow-up</th>
              <th>Rep</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => (
              <tr key={p.id}>
                <td>
                  <Link to={`/prospects/${p.id}`} className="biz-link">
                    <strong>{p.businessName}</strong>
                    <span>
                      {p.decisionMaker} · {p.city} · {p.industry}
                    </span>
                  </Link>
                </td>
                <td>
                  <span className="stage-tag">
                    {STAGES.find((s) => s.id === p.stage)?.label}
                  </span>
                </td>
                <td className="services-cell">
                  {serviceLabels(p.servicesNeeded)}
                </td>
                <td>{formatMoney(p.quoteAmount)}</td>
                <td>{formatMoney(weightedValue(p))}</td>
                <td>{formatDate(p.nextFollowUpAt)}</td>
                <td>{p.salesRep}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <p className="empty padded">No prospects match filters.</p>}
      </div>

      {showNew && (
        <div className="overlay-backdrop" onClick={() => setShowNew(false)}>
          <form className="modal panel" onClick={(e) => e.stopPropagation()} onSubmit={createProspect}>
            <h2>New commercial prospect</h2>
            <div className="form-grid">
              <label className="lbl">
                Business name
                <input className="field" name="businessName" required />
              </label>
              <label className="lbl">
                Decision maker
                <input className="field" name="decisionMaker" required />
              </label>
              <label className="lbl">
                Industry
                <select className="field" name="industry" defaultValue="Retail">
                  {INDUSTRIES.map((i) => (
                    <option key={i} value={i}>
                      {i}
                    </option>
                  ))}
                </select>
              </label>
              <label className="lbl">
                City
                <input className="field" name="city" />
              </label>
              <label className="lbl">
                Address
                <input className="field" name="address" />
              </label>
              <label className="lbl">
                Email
                <input className="field" name="email" type="email" />
              </label>
              <label className="lbl">
                Phone
                <input className="field" name="phone" />
              </label>
              <label className="lbl">
                Sales rep
                <input className="field" name="salesRep" defaultValue="Will" />
              </label>
              <label className="lbl">
                Quote amount
                <input className="field" name="quoteAmount" type="number" min={0} defaultValue={0} />
              </label>
              <label className="lbl">
                Next follow-up
                <input className="field" name="nextFollowUpAt" type="date" />
              </label>
            </div>
            <div className="modal-actions">
              <button type="button" className="btn secondary" onClick={() => setShowNew(false)}>
                Cancel
              </button>
              <button type="submit" className="btn">
                Save
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
