import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useSales } from '../store/SalesContext'
import {
  SERVICES,
  STAGES,
  INDUSTRIES,
  PRIORITIES,
  type PipelineStage,
  type ProspectPriority,
  type ServiceType,
  type TaskKind,
} from '../types'
import {
  daysFromNow,
  formatDate,
  formatDateTime,
  fromDateInput,
  toDateInput,
} from '../lib/dates'
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
    ensureProspectDetail,
    reference,
    apiMode,
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
    if (id && apiMode === 'v2') {
      void ensureProspectDetail(id)
    }
  }, [id, apiMode, ensureProspectDetail])

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
  const sentEmails = useMemo(
    () =>
      state.sentEmails
        .filter((e) => e.prospectId === id)
        .sort((a, b) => b.sentAt.localeCompare(a.sentAt)),
    [state.sentEmails, id],
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
        <span>{prospect.decisionMaker || prospect.businessName}</span>
      </div>

      <header className="detail-header">
        <div>
          <p className="eyebrow">{prospect.industry}</p>
          <h1>{prospect.decisionMaker || 'Decision maker'}</h1>
          <p className="lede">
            {prospect.jobTitle ? `${prospect.jobTitle} · ` : ''}
            {prospect.businessName}
            {prospect.address ? ` · ${prospect.address}` : ''}
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
              if (confirm(`Delete ${prospect.decisionMaker || prospect.businessName}?`)) {
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
          Lead status
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
          Priority
          <select
            className="field"
            value={prospect.priority}
            onChange={(e) =>
              updateProspect(prospect.id, {
                priority: e.target.value as ProspectPriority,
              })
            }
          >
            {PRIORITIES.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
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
        <label className="lbl">
          Job value
          <input
            className="field"
            type="number"
            min="0"
            step="100"
            value={prospect.estimatedJobValue ?? ''}
            onChange={(e) =>
              updateProspect(prospect.id, {
                estimatedJobValue: e.target.value === '' ? null : Number(e.target.value),
              })
            }
          />
        </label>
        <label className="lbl">
          Annual value
          <input
            className="field"
            type="number"
            min="0"
            step="100"
            value={prospect.estimatedAnnualValue ?? ''}
            onChange={(e) =>
              updateProspect(prospect.id, {
                estimatedAnnualValue:
                  e.target.value === '' ? null : Number(e.target.value),
              })
            }
          />
        </label>
        <div className="weighted">
          <span>Last contact</span>
          <strong>{formatDate(prospect.lastContactAt)}</strong>
        </div>
      </section>

      <div className="detail-stack">
        <section className="panel form-section">
          <h3>Company information</h3>
          <div className="form-grid">
            <label className="lbl">
              Company name
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
            <label className="lbl">
              Company website
              <input
                className="field"
                value={prospect.website}
                onChange={(e) => updateProspect(prospect.id, { website: e.target.value })}
              />
            </label>
            <label className="lbl">
              Company phone number
              <input
                className="field"
                value={prospect.companyPhone}
                onChange={(e) => updateProspect(prospect.id, { companyPhone: e.target.value })}
              />
            </label>
            <label className="lbl full">
              Company address
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
              State
              <input
                className="field"
                value={prospect.state || ''}
                maxLength={2}
                onChange={(e) => updateProspect(prospect.id, { state: e.target.value })}
              />
            </label>
            <label className="lbl">
              Lead source
              <select
                className="field"
                value={prospect.leadSourceId || ''}
                onChange={(e) =>
                  updateProspect(prospect.id, {
                    leadSourceId: e.target.value || null,
                  })
                }
              >
                <option value="">Unknown</option>
                {(reference?.leadSources ?? []).map((source) => (
                  <option key={source.id} value={source.id}>
                    {source.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </section>

        <section className="panel form-section">
          <h3>Decision maker</h3>
          <div className="form-grid">
            <label className="lbl">
              Full name
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
              Direct email address
              <input
                className="field"
                value={prospect.email}
                onChange={(e) => updateProspect(prospect.id, { email: e.target.value })}
              />
            </label>
            <label className="lbl">
              Direct phone number
              <input
                className="field"
                value={prospect.phone}
                onChange={(e) => updateProspect(prospect.id, { phone: e.target.value })}
              />
            </label>
            <label className="lbl">
              Extension
              <input
                className="field"
                value={prospect.phoneExt}
                onChange={(e) => updateProspect(prospect.id, { phoneExt: e.target.value })}
              />
            </label>
            <label className="lbl">
              Assistant / gatekeeper name
              <input
                className="field"
                value={prospect.assistantName}
                onChange={(e) =>
                  updateProspect(prospect.id, { assistantName: e.target.value })
                }
              />
            </label>
            <label className="lbl">
              Assistant phone
              <input
                className="field"
                value={prospect.assistantPhone}
                onChange={(e) =>
                  updateProspect(prospect.id, { assistantPhone: e.target.value })
                }
              />
            </label>
          </div>
        </section>

        <section className="panel form-section">
          <h3>Dates</h3>
          <div className="form-grid">
            <label className="lbl">
              Date added
              <input
                className="field"
                type="date"
                value={toDateInput(prospect.createdAt)}
                disabled
                readOnly
              />
            </label>
            <label className="lbl">
              First email date
              <input
                className="field"
                type="date"
                value={toDateInput(prospect.firstEmailAt)}
                onChange={(e) =>
                  updateProspect(prospect.id, {
                    firstEmailAt: fromDateInput(e.target.value),
                  })
                }
              />
            </label>
            <label className="lbl">
              First call date
              <input
                className="field"
                type="date"
                value={toDateInput(prospect.firstCallAt)}
                onChange={(e) =>
                  updateProspect(prospect.id, {
                    firstCallAt: fromDateInput(e.target.value),
                  })
                }
              />
            </label>
            <label className="lbl">
              Last contact date
              <input
                className="field"
                type="date"
                value={toDateInput(prospect.lastContactAt)}
                onChange={(e) =>
                  updateProspect(prospect.id, {
                    lastContactAt: fromDateInput(e.target.value),
                  })
                }
              />
            </label>
          </div>
        </section>

        <section className="panel form-section">
          <h3>Notes</h3>
          <div className="form-grid">
            <label className="lbl full">
              Property notes
              <textarea
                className="field"
                rows={2}
                value={prospect.propertyNotes}
                onChange={(e) =>
                  updateProspect(prospect.id, { propertyNotes: e.target.value })
                }
              />
            </label>
            <label className="lbl full">
              Conversation notes
              <textarea
                className="field"
                rows={2}
                value={prospect.conversationNotes}
                onChange={(e) =>
                  updateProspect(prospect.id, { conversationNotes: e.target.value })
                }
              />
            </label>
            <label className="lbl full">
              Pain points / opportunities
              <textarea
                className="field"
                rows={2}
                value={prospect.painPoints}
                onChange={(e) => updateProspect(prospect.id, { painPoints: e.target.value })}
              />
            </label>
            <label className="lbl full">
              Services discussed
              <textarea
                className="field"
                rows={2}
                value={prospect.servicesDiscussed}
                onChange={(e) =>
                  updateProspect(prospect.id, { servicesDiscussed: e.target.value })
                }
              />
            </label>
          </div>
        </section>

        <section className="panel form-section">
          <h3>Services of interest</h3>
          <div className="service-chips">
            {SERVICES.map((s) => (
              <button
                key={s.id}
                type="button"
                className={
                  prospect.servicesNeeded.includes(s.id) ? 'chip active' : 'chip'
                }
                onClick={() => toggleService(s.id)}
              >
                {s.label}
              </button>
            ))}
          </div>
        </section>

        <section className="panel form-section">
          <h3>Data quality</h3>
          <div className="form-grid">
            <label className="lbl">
              Email verified
              <select
                className="field"
                value={prospect.emailVerified ? 'yes' : 'no'}
                onChange={(e) =>
                  updateProspect(prospect.id, {
                    emailVerified: e.target.value === 'yes',
                  })
                }
              >
                <option value="no">No</option>
                <option value="yes">Yes</option>
              </select>
            </label>
            <label className="lbl">
              Decision maker confirmed
              <select
                className="field"
                value={prospect.decisionMakerConfirmed ? 'yes' : 'no'}
                onChange={(e) =>
                  updateProspect(prospect.id, {
                    decisionMakerConfirmed: e.target.value === 'yes',
                  })
                }
              >
                <option value="no">No</option>
                <option value="yes">Yes</option>
              </select>
            </label>
          </div>
          {prospect.website ? (
            <div className="link-row">
              <a href={prospect.website} target="_blank" rel="noreferrer">
                Open website
              </a>
            </div>
          ) : null}
        </section>

        <div className="detail-grid">
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
                placeholder="Add to timeline…"
              />
              <button type="submit" className="btn">
                Add to timeline
              </button>
            </form>
          </section>
        </div>

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
                  <span>
                    {formatDate(a.createdAt)}
                    {a.note ? ` · ${a.note}` : ''}
                  </span>
                </div>
              </li>
            ))}
            {attachments.length === 0 && <li className="empty">No attachments yet.</li>}
          </ul>
        </section>
      </div>

      <section className="panel">
        <div className="panel-head">
          <h2>Timeline</h2>
        </div>
        <Timeline events={timeline} />
      </section>

      <section className="panel" style={{ marginTop: '1rem' }}>
        <div className="panel-head">
          <h2>Sent emails</h2>
          <Link className="btn small secondary" to={`/emails?prospect=${prospect.id}`}>
            Draft email
          </Link>
        </div>
        {sentEmails.length === 0 ? (
          <p className="empty">No emails logged for this prospect.</p>
        ) : (
          <ul className="attach-list">
            {sentEmails.map((e) => (
              <li key={e.id}>
                <span className="pill email">email</span>
                <div>
                  <Link to={`/emails?sent=${e.id}&prospect=${prospect.id}`}>
                    <strong>{e.subject}</strong>
                  </Link>
                  <span>{formatDateTime(e.sentAt)}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
