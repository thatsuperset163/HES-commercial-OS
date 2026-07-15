import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useSales } from '../store/SalesContext'
import {
  SERVICES,
  STAGES,
  INDUSTRIES,
  type BillingType,
  type PipelineStage,
  type ServiceType,
  type TaskKind,
} from '../types'
import {
  daysFromNow,
  formatDate,
  formatMoney,
  fromDateInput,
  toDateInput,
} from '../lib/dates'
import { weightedValue } from '../lib/metrics'
import { Timeline, TaskList } from '../components/Timeline'
import '../components/Overlay.css'
import './Prospects.css'

export function ProspectDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const {
    state,
    updateProspect,
    deleteProspect,
    setStage,
    addTask,
    completeTask,
    deleteTask,
    logCall,
    logEvent,
    addAttachment,
  } = useSales()

  const prospect = state.prospects.find((p) => p.id === id)
  const [taskTitle, setTaskTitle] = useState('')
  const [taskKind, setTaskKind] = useState<TaskKind>('call')
  const [taskDue, setTaskDue] = useState(toDateInput(daysFromNow(1)))
  const [note, setNote] = useState('')
  const [attachName, setAttachName] = useState('')
  const [attachKind, setAttachKind] = useState<'photo' | 'document' | 'quote' | 'other'>('photo')
  const taskInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null
      const typing =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      if (typing) return
      if (e.key.toLowerCase() === 'n') {
        e.preventDefault()
        taskInputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const tasks = useMemo(
    () =>
      state.tasks
        .filter((t) => t.prospectId === id)
        .sort((a, b) => Number(a.done) - Number(b.done) || a.dueAt.localeCompare(b.dueAt)),
    [state.tasks, id],
  )
  const timeline = useMemo(
    () =>
      state.timeline
        .filter((e) => e.prospectId === id)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [state.timeline, id],
  )
  const attachments = useMemo(
    () => state.attachments.filter((a) => a.prospectId === id),
    [state.attachments, id],
  )

  if (!prospect) {
    return (
      <div className="page">
        <p className="empty">Prospect not found.</p>
        <Link to="/prospects">Back</Link>
      </div>
    )
  }

  function toggleService(service: ServiceType) {
    const has = prospect!.servicesNeeded.includes(service)
    updateProspect(prospect!.id, {
      servicesNeeded: has
        ? prospect!.servicesNeeded.filter((s) => s !== service)
        : [...prospect!.servicesNeeded, service],
    })
  }

  function createTask(e: React.FormEvent) {
    e.preventDefault()
    if (!taskTitle.trim() || !id) return
    addTask({
      prospectId: id,
      title: taskTitle.trim(),
      kind: taskKind,
      dueAt: fromDateInput(taskDue) || daysFromNow(1),
    })
    setTaskTitle('')
  }

  return (
    <div className="page prospect-detail">
      <div className="breadcrumb">
        <Link to="/prospects">Prospects</Link>
        <span>/</span>
        <span>{prospect.businessName}</span>
      </div>

      <header className="detail-header">
        <div>
          <p className="eyebrow">{prospect.industry}</p>
          <h1>{prospect.businessName}</h1>
          <p className="lede">
            {prospect.decisionMaker}
            {prospect.jobTitle ? ` · ${prospect.jobTitle}` : ''}
            {prospect.city ? ` · ${prospect.city}` : ''}
          </p>
        </div>
        <div className="detail-actions">
          <Link className="btn" to={`/emails?prospect=${prospect.id}`}>
            Draft email
          </Link>
          <button
            type="button"
            className="btn secondary"
            onClick={() => logCall(prospect.id, 'Call logged from prospect')}
          >
            Log call
          </button>
          <button
            type="button"
            className="btn secondary"
            onClick={() =>
              logCall(prospect.id, 'Voicemail left from prospect', true)
            }
          >
            Log voicemail
          </button>
          <button
            type="button"
            className="btn danger"
            onClick={() => {
              if (confirm(`Delete ${prospect.businessName}?`)) {
                deleteProspect(prospect.id)
                navigate('/prospects')
              }
            }}
          >
            Delete
          </button>
        </div>
      </header>

      <section className="quote-bar panel">
        <label className="lbl">
          Stage
          <select
            className="field"
            value={prospect.stage}
            onChange={(e) => setStage(prospect.id, e.target.value as PipelineStage)}
          >
            {STAGES.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        <label className="lbl">
          Quote amount
          <input
            className="field"
            type="number"
            value={prospect.quoteAmount}
            onChange={(e) =>
              updateProspect(prospect.id, { quoteAmount: Number(e.target.value) || 0 })
            }
          />
        </label>
        <label className="lbl">
          Probability %
          <input
            className="field"
            type="number"
            min={0}
            max={100}
            value={prospect.probability}
            onChange={(e) =>
              updateProspect(prospect.id, { probability: Number(e.target.value) || 0 })
            }
          />
        </label>
        <label className="lbl">
          Expected close
          <input
            className="field"
            type="date"
            value={toDateInput(prospect.expectedCloseDate)}
            onChange={(e) =>
              updateProspect(prospect.id, {
                expectedCloseDate: fromDateInput(e.target.value),
              })
            }
          />
        </label>
        <label className="lbl">
          Billing
          <select
            className="field"
            value={prospect.billingType}
            onChange={(e) =>
              updateProspect(prospect.id, {
                billingType: e.target.value as BillingType,
              })
            }
          >
            <option value="one_time">One-time</option>
            <option value="recurring">Recurring</option>
          </select>
        </label>
        <label className="lbl">
          Expected annual value
          <input
            className="field"
            type="number"
            value={prospect.expectedAnnualValue}
            onChange={(e) =>
              updateProspect(prospect.id, {
                expectedAnnualValue: Number(e.target.value) || 0,
              })
            }
          />
        </label>
        <div className="weighted">
          <span>Weighted pipeline</span>
          <strong>{formatMoney(weightedValue(prospect))}</strong>
        </div>
      </section>

      <div className="detail-grid">
        <section className="panel">
          <div className="panel-head">
            <h2>Prospect record</h2>
          </div>
          <div className="form-grid">
            <label className="lbl">
              Business name
              <input
                className="field"
                value={prospect.businessName}
                onChange={(e) => updateProspect(prospect.id, { businessName: e.target.value })}
              />
            </label>
            <label className="lbl">
              Industry
              <select
                className="field"
                value={prospect.industry}
                onChange={(e) => updateProspect(prospect.id, { industry: e.target.value })}
              >
                {INDUSTRIES.map((i) => (
                  <option key={i} value={i}>
                    {i}
                  </option>
                ))}
              </select>
            </label>
            <label className="lbl full">
              Address
              <input
                className="field"
                value={prospect.address}
                onChange={(e) => updateProspect(prospect.id, { address: e.target.value })}
              />
            </label>
            <label className="lbl">
              City
              <input
                className="field"
                value={prospect.city}
                onChange={(e) => updateProspect(prospect.id, { city: e.target.value })}
              />
            </label>
            <label className="lbl">
              Website
              <input
                className="field"
                value={prospect.website}
                onChange={(e) => updateProspect(prospect.id, { website: e.target.value })}
              />
            </label>
            <label className="lbl full">
              Google Maps link
              <input
                className="field"
                value={prospect.googleMapsUrl}
                onChange={(e) =>
                  updateProspect(prospect.id, { googleMapsUrl: e.target.value })
                }
              />
            </label>
            <label className="lbl">
              Decision maker
              <input
                className="field"
                value={prospect.decisionMaker}
                onChange={(e) =>
                  updateProspect(prospect.id, { decisionMaker: e.target.value })
                }
              />
            </label>
            <label className="lbl">
              Job title
              <input
                className="field"
                value={prospect.jobTitle}
                onChange={(e) => updateProspect(prospect.id, { jobTitle: e.target.value })}
              />
            </label>
            <label className="lbl">
              Email
              <input
                className="field"
                value={prospect.email}
                onChange={(e) => updateProspect(prospect.id, { email: e.target.value })}
              />
            </label>
            <label className="lbl">
              Phone
              <input
                className="field"
                value={prospect.phone}
                onChange={(e) => updateProspect(prospect.id, { phone: e.target.value })}
              />
            </label>
            <label className="lbl full">
              LinkedIn
              <input
                className="field"
                value={prospect.linkedIn}
                onChange={(e) => updateProspect(prospect.id, { linkedIn: e.target.value })}
              />
            </label>
            <label className="lbl">
              Buildings
              <input
                className="field"
                type="number"
                value={prospect.numberOfBuildings}
                onChange={(e) =>
                  updateProspect(prospect.id, {
                    numberOfBuildings: Number(e.target.value) || 0,
                  })
                }
              />
            </label>
            <label className="lbl">
              Est. sq ft
              <input
                className="field"
                type="number"
                value={prospect.estimatedSqFt}
                onChange={(e) =>
                  updateProspect(prospect.id, {
                    estimatedSqFt: Number(e.target.value) || 0,
                  })
                }
              />
            </label>
            <label className="lbl">
              Sales rep
              <input
                className="field"
                value={prospect.salesRep}
                onChange={(e) => updateProspect(prospect.id, { salesRep: e.target.value })}
              />
            </label>
            <label className="lbl">
              Next follow-up
              <input
                className="field"
                type="date"
                value={toDateInput(prospect.nextFollowUpAt)}
                onChange={(e) =>
                  updateProspect(prospect.id, {
                    nextFollowUpAt: fromDateInput(e.target.value),
                  })
                }
              />
            </label>
            <label className="lbl full">
              Notes
              <textarea
                className="field"
                rows={3}
                value={prospect.notes}
                onChange={(e) => updateProspect(prospect.id, { notes: e.target.value })}
              />
            </label>
          </div>

          <div className="services-block">
            <span className="lbl">Services needed</span>
            <div className="service-chips">
              {SERVICES.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  className={
                    prospect.servicesNeeded.includes(s.id)
                      ? 'chip active'
                      : 'chip'
                  }
                  onClick={() => toggleService(s.id)}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <div className="link-row">
            {prospect.website && (
              <a href={prospect.website} target="_blank" rel="noreferrer">
                Website
              </a>
            )}
            {prospect.googleMapsUrl && (
              <a href={prospect.googleMapsUrl} target="_blank" rel="noreferrer">
                Google Maps
              </a>
            )}
            {prospect.linkedIn && (
              <a href={prospect.linkedIn} target="_blank" rel="noreferrer">
                LinkedIn
              </a>
            )}
            <span className="muted">Last contact {formatDate(prospect.lastContactAt)}</span>
          </div>
        </section>

        <section className="panel">
          <div className="panel-head">
            <h2>Tasks</h2>
          </div>
          <form className="inline-row" onSubmit={createTask}>
            <input
              ref={taskInputRef}
              className="field"
              placeholder="Call Tuesday / Email Friday… (press N)"
              value={taskTitle}
              onChange={(e) => setTaskTitle(e.target.value)}
            />
            <select
              className="field"
              value={taskKind}
              onChange={(e) => setTaskKind(e.target.value as TaskKind)}
            >
              <option value="call">Call</option>
              <option value="email">Email</option>
              <option value="visit">Visit</option>
              <option value="quote">Quote</option>
              <option value="other">Other</option>
            </select>
            <input
              className="field"
              type="date"
              value={taskDue}
              onChange={(e) => setTaskDue(e.target.value)}
            />
            <button type="submit" className="btn">
              Add
            </button>
          </form>
          <TaskList
            tasks={tasks}
            onComplete={completeTask}
            onDelete={deleteTask}
          />
        </section>

        <section className="panel">
          <div className="panel-head">
            <h2>Photos & attachments</h2>
          </div>
          <form
            className="inline-row"
            onSubmit={(e) => {
              e.preventDefault()
              if (!attachName.trim()) return
              addAttachment({
                prospectId: prospect.id,
                name: attachName.trim(),
                kind: attachKind,
                url: '#',
                note: '',
              })
              setAttachName('')
            }}
          >
            <input
              className="field"
              placeholder="File name"
              value={attachName}
              onChange={(e) => setAttachName(e.target.value)}
            />
            <select
              className="field"
              value={attachKind}
              onChange={(e) =>
                setAttachKind(e.target.value as typeof attachKind)
              }
            >
              <option value="photo">Photo</option>
              <option value="document">Document</option>
              <option value="quote">Quote</option>
              <option value="other">Other</option>
            </select>
            <button type="submit" className="btn secondary">
              Attach
            </button>
          </form>
          <ul className="attach-list">
            {attachments.map((a) => (
              <li key={a.id}>
                <span className={`pill ${a.kind === 'photo' ? 'visit' : 'quote'}`}>
                  {a.kind}
                </span>
                <div>
                  <strong>{a.name}</strong>
                  <span>{formatDate(a.createdAt)}{a.note ? ` · ${a.note}` : ''}</span>
                </div>
              </li>
            ))}
            {attachments.length === 0 && <li className="empty">No attachments yet.</li>}
          </ul>
        </section>

        <section className="panel">
          <div className="panel-head">
            <h2>Quick note</h2>
          </div>
          <form
            className="note-form"
            onSubmit={(e) => {
              e.preventDefault()
              if (!note.trim()) return
              logEvent({
                prospectId: prospect.id,
                type: 'note',
                title: 'Note',
                body: note.trim(),
                touchContact: false,
              })
              setNote('')
            }}
          >
            <textarea
              className="field"
              rows={4}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Site observations, gate codes, decision notes…"
            />
            <button type="submit" className="btn">
              Add to timeline
            </button>
          </form>
        </section>
      </div>

      <section className="panel">
        <div className="panel-head">
          <h2>Timeline</h2>
        </div>
        <Timeline events={timeline} />
      </section>
    </div>
  )
}
