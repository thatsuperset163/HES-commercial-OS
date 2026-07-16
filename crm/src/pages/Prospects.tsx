import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useSales } from '../store/SalesContext'
import {
  STAGES,
  INDUSTRIES,
  SERVICES,
  PRIORITIES,
  emptyProspectDraft,
  type PipelineStage,
  type ProspectPriority,
  type ServiceType,
} from '../types'
import { formatDate, fromDateInput, toDateInput } from '../lib/dates'
import { serviceLabels } from '../lib/templates'
import './Prospects.css'

type Filters = {
  q: string
  industry: string
  stage: PipelineStage | 'all'
  priority: ProspectPriority | 'all'
  lastContact: 'all' | '7' | '30' | 'never'
  nextFollowUp: 'all' | 'overdue' | 'today' | 'week'
}

export function Prospects() {
  const { state, upsertProspect } = useSales()
  const navigate = useNavigate()
  const [showNew, setShowNew] = useState(false)
  const [services, setServices] = useState<ServiceType[]>([])
  const [filters, setFilters] = useState<Filters>({
    q: '',
    industry: 'all',
    stage: 'all',
    priority: 'all',
    lastContact: 'all',
    nextFollowUp: 'all',
  })

  const filtered = useMemo(() => {
    const now = Date.now()
    const q = filters.q.trim().toLowerCase()

    return state.prospects
      .filter((p) => {
        if (filters.industry !== 'all' && p.industry !== filters.industry) return false
        if (filters.stage !== 'all' && p.stage !== filters.stage) return false
        if (filters.priority !== 'all' && p.priority !== filters.priority) return false

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
          p.jobTitle,
          p.email,
          p.phone,
          p.companyPhone,
          p.address,
          p.city,
          p.industry,
          p.assistantName,
          p.propertyNotes,
          p.conversationNotes,
          p.painPoints,
        ]
          .join(' ')
          .toLowerCase()
          .includes(q)
      })
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  }, [state.prospects, filters])

  function toggleService(id: ServiceType) {
    setServices((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id],
    )
  }

  function createProspect(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const base = emptyProspectDraft(String(fd.get('salesRep') || 'Will'))
    const created = upsertProspect({
      ...base,
      businessName: String(fd.get('businessName') || '').trim(),
      industry: String(fd.get('industry') || 'Other'),
      website: String(fd.get('website') || '').trim(),
      companyPhone: String(fd.get('companyPhone') || '').trim(),
      address: String(fd.get('address') || '').trim(),
      decisionMaker: String(fd.get('decisionMaker') || '').trim(),
      jobTitle: String(fd.get('jobTitle') || '').trim(),
      email: String(fd.get('email') || '').trim(),
      phone: String(fd.get('phone') || '').trim(),
      phoneExt: String(fd.get('phoneExt') || '').trim(),
      assistantName: String(fd.get('assistantName') || '').trim(),
      assistantPhone: String(fd.get('assistantPhone') || '').trim(),
      stage: (String(fd.get('stage') || 'not_contacted') as PipelineStage),
      priority: (String(fd.get('priority') || 'medium') as ProspectPriority),
      firstEmailAt: fromDateInput(String(fd.get('firstEmailAt') || '')),
      firstCallAt: fromDateInput(String(fd.get('firstCallAt') || '')),
      nextFollowUpAt: fromDateInput(String(fd.get('nextFollowUpAt') || '')),
      lastContactAt: fromDateInput(String(fd.get('lastContactAt') || '')),
      propertyNotes: String(fd.get('propertyNotes') || '').trim(),
      conversationNotes: String(fd.get('conversationNotes') || '').trim(),
      painPoints: String(fd.get('painPoints') || '').trim(),
      servicesDiscussed: String(fd.get('servicesDiscussed') || '').trim(),
      servicesNeeded: services,
      emailVerified: fd.get('emailVerified') === 'yes',
      decisionMakerConfirmed: fd.get('decisionMakerConfirmed') === 'yes',
    })
    setShowNew(false)
    setServices([])
    navigate(`/prospects/${created.id}`)
  }

  return (
    <div className="page prospects-page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Database</p>
          <h1>Prospects</h1>
          <p className="lede">
            Decision makers at commercial properties — who to call, email, and close.
          </p>
        </div>
        <button
          type="button"
          className="btn"
          onClick={() => {
            setServices([])
            setShowNew(true)
          }}
        >
          Add prospect
        </button>
      </header>

      <div className="filters">
        <input
          className="search-input"
          placeholder="Search company, decision maker, email, phone…"
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
          value={filters.stage}
          onChange={(e) =>
            setFilters((f) => ({ ...f, stage: e.target.value as PipelineStage | 'all' }))
          }
        >
          <option value="all">All lead statuses</option>
          {STAGES.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
        <select
          className="field"
          value={filters.priority}
          onChange={(e) =>
            setFilters((f) => ({
              ...f,
              priority: e.target.value as ProspectPriority | 'all',
            }))
          }
        >
          <option value="all">All priorities</option>
          {PRIORITIES.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
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
      </div>

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Decision maker</th>
              <th>Company</th>
              <th>Lead status</th>
              <th>Priority</th>
              <th>Services</th>
              <th>Next follow-up</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => (
              <tr key={p.id}>
                <td>
                  <Link to={`/prospects/${p.id}`} className="biz-link">
                    <strong>{p.decisionMaker || '—'}</strong>
                    <span>
                      {p.jobTitle || 'No title'}
                      {p.email ? ` · ${p.email}` : ''}
                    </span>
                  </Link>
                </td>
                <td>
                  <div className="biz-link">
                    <strong>{p.businessName}</strong>
                    <span>{p.industry}</span>
                  </div>
                </td>
                <td>
                  <span className="stage-tag">
                    {STAGES.find((s) => s.id === p.stage)?.label}
                  </span>
                </td>
                <td>
                  <span className={`priority-tag ${p.priority}`}>
                    {PRIORITIES.find((x) => x.id === p.priority)?.label}
                  </span>
                </td>
                <td className="services-cell">
                  {serviceLabels(p.servicesNeeded) || '—'}
                </td>
                <td>{formatDate(p.nextFollowUpAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <p className="empty padded">No prospects match filters.</p>}
      </div>

      {showNew && (
        <div
          className="overlay-backdrop prospect-overlay"
          onClick={() => setShowNew(false)}
        >
          <form
            className="modal panel prospect-form-modal"
            onClick={(e) => e.stopPropagation()}
            onSubmit={createProspect}
          >
            <div className="modal-head">
              <div>
                <p className="eyebrow">New record</p>
                <h2>New commercial prospect</h2>
                <p className="form-lede">
                  Capture the decision maker first — company context second.
                </p>
              </div>
            </div>

            <section className="form-section">
              <h3>Company information</h3>
              <div className="form-grid">
                <label className="lbl">
                  Company name
                  <input className="field" name="businessName" required autoFocus />
                </label>
                <label className="lbl">
                  Industry
                  <select className="field" name="industry" defaultValue="Other">
                    {INDUSTRIES.map((i) => (
                      <option key={i} value={i}>
                        {i}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="lbl">
                  Company website
                  <input className="field" name="website" placeholder="https://" />
                </label>
                <label className="lbl">
                  Company phone number
                  <input className="field" name="companyPhone" inputMode="tel" />
                </label>
                <label className="lbl full">
                  Company address
                  <input
                    className="field"
                    name="address"
                    placeholder="Street, city, state, ZIP"
                  />
                </label>
              </div>
            </section>

            <section className="form-section">
              <h3>Decision maker</h3>
              <div className="form-grid">
                <label className="lbl">
                  Full name
                  <input className="field" name="decisionMaker" required />
                </label>
                <label className="lbl">
                  Job title
                  <input className="field" name="jobTitle" placeholder="Property Manager, FM…" />
                </label>
                <label className="lbl">
                  Direct email address
                  <input className="field" name="email" type="email" />
                </label>
                <label className="lbl">
                  Direct phone number
                  <input className="field" name="phone" inputMode="tel" />
                </label>
                <label className="lbl">
                  Extension
                  <input className="field" name="phoneExt" />
                </label>
                <label className="lbl">
                  Assistant / gatekeeper name
                  <span className="opt">Optional</span>
                  <input className="field" name="assistantName" />
                </label>
                <label className="lbl">
                  Assistant phone
                  <span className="opt">Optional</span>
                  <input className="field" name="assistantPhone" inputMode="tel" />
                </label>
              </div>
            </section>

            <section className="form-section">
              <h3>Outreach tracking</h3>
              <div className="form-grid">
                <label className="lbl">
                  Lead status
                  <select className="field" name="stage" defaultValue="not_contacted">
                    {STAGES.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="lbl">
                  Priority
                  <select className="field" name="priority" defaultValue="medium">
                    {PRIORITIES.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </section>

            <section className="form-section">
              <h3>Dates</h3>
              <div className="form-grid">
                <label className="lbl">
                  Date added
                  <input
                    className="field"
                    type="date"
                    value={toDateInput(new Date().toISOString())}
                    disabled
                    readOnly
                  />
                </label>
                <label className="lbl">
                  First email date
                  <input className="field" name="firstEmailAt" type="date" />
                </label>
                <label className="lbl">
                  First call date
                  <input className="field" name="firstCallAt" type="date" />
                </label>
                <label className="lbl">
                  Next follow-up date
                  <input className="field" name="nextFollowUpAt" type="date" />
                </label>
                <label className="lbl">
                  Last contact date
                  <input className="field" name="lastContactAt" type="date" />
                </label>
              </div>
            </section>

            <section className="form-section">
              <h3>Notes</h3>
              <div className="form-grid">
                <label className="lbl full">
                  Property notes
                  <textarea
                    className="field"
                    name="propertyNotes"
                    rows={2}
                    placeholder="Buildings, staining, access, dumpster pads…"
                  />
                </label>
                <label className="lbl full">
                  Conversation notes
                  <textarea
                    className="field"
                    name="conversationNotes"
                    rows={2}
                    placeholder="What they said, tone, next ask…"
                  />
                </label>
                <label className="lbl full">
                  Pain points / opportunities
                  <textarea
                    className="field"
                    name="painPoints"
                    rows={2}
                    placeholder="Complaints, budget cycle, competitor issues…"
                  />
                </label>
                <label className="lbl full">
                  Services discussed
                  <textarea
                    className="field"
                    name="servicesDiscussed"
                    rows={2}
                    placeholder="What you talked through on the call / email…"
                  />
                </label>
              </div>
            </section>

            <section className="form-section">
              <h3>Services of interest</h3>
              <div className="service-chips">
                {SERVICES.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    className={services.includes(s.id) ? 'chip active' : 'chip'}
                    onClick={() => toggleService(s.id)}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </section>

            <section className="form-section">
              <h3>Data quality</h3>
              <div className="form-grid">
                <label className="lbl">
                  Email verified
                  <select className="field" name="emailVerified" defaultValue="no">
                    <option value="no">No</option>
                    <option value="yes">Yes</option>
                  </select>
                </label>
                <label className="lbl">
                  Decision maker confirmed
                  <select
                    className="field"
                    name="decisionMakerConfirmed"
                    defaultValue="no"
                  >
                    <option value="no">No</option>
                    <option value="yes">Yes</option>
                  </select>
                </label>
                <input type="hidden" name="salesRep" value="Will" />
              </div>
            </section>

            <div className="modal-actions">
              <button type="button" className="btn secondary" onClick={() => setShowNew(false)}>
                Cancel
              </button>
              <button type="submit" className="btn">
                Save prospect
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
