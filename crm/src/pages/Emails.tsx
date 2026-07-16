import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useSales } from '../store/SalesContext'
import { followUpBody, followUpSubject, personalize, withEmailSignature, defaultTemplateBody, EMAIL_SIGNATURE, serviceLabels } from '../lib/templates'
import {
  formatDate,
  formatDateTime,
  isOverdue,
  isToday,
} from '../lib/dates'
import { STAGES } from '../types'
import './Emails.css'

function followUpLabel(nextFollowUpAt: string | null) {
  if (!nextFollowUpAt) return 'No follow-up scheduled'
  if (isOverdue(nextFollowUpAt)) return `Overdue · was ${formatDate(nextFollowUpAt)}`
  if (isToday(nextFollowUpAt)) return `Due today · ${formatDate(nextFollowUpAt)}`
  return `Scheduled · ${formatDate(nextFollowUpAt)}`
}

export function Emails() {
  const { state, saveTemplate, deleteTemplate, markEmailSent } = useSales()
  const [params, setParams] = useSearchParams()
  const initialProspect = params.get('prospect') ?? state.prospects[0]?.id ?? ''
  const initialSent = params.get('sent')

  const [prospectId, setProspectId] = useState(initialProspect)
  const [templateId, setTemplateId] = useState(state.templates[0]?.id ?? '')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState(() =>
    params.get('prospect') && !params.get('sent') ? EMAIL_SIGNATURE : '',
  )
  const [editingId, setEditingId] = useState<string | null>(null)
  const [tplName, setTplName] = useState('')
  const [tplSubject, setTplSubject] = useState('')
  const [tplBody, setTplBody] = useState('')
  const [copied, setCopied] = useState(false)
  const [logged, setLogged] = useState(false)
  const [selectedSentId, setSelectedSentId] = useState<string | null>(initialSent)

  const prospect = useMemo(
    () => state.prospects.find((p) => p.id === prospectId),
    [state.prospects, prospectId],
  )

  const lastSent = useMemo(
    () => state.sentEmails.find((e) => e.prospectId === prospectId),
    [state.sentEmails, prospectId],
  )

  const selectedSent = useMemo(
    () => state.sentEmails.find((e) => e.id === selectedSentId) ?? null,
    [state.sentEmails, selectedSentId],
  )

  const selectedProspect = useMemo(
    () =>
      selectedSent
        ? state.prospects.find((p) => p.id === selectedSent.prospectId)
        : null,
    [selectedSent, state.prospects],
  )

  function openSent(id: string) {
    setSelectedSentId(id)
    const next = new URLSearchParams(params)
    next.set('sent', id)
    setParams(next, { replace: true })
  }

  function closeSent() {
    setSelectedSentId(null)
    const next = new URLSearchParams(params)
    next.delete('sent')
    setParams(next, { replace: true })
  }

  function applyTemplate(id: string) {
    const tpl = state.templates.find((t) => t.id === id)
    if (!tpl || !prospect) return
    setTemplateId(id)
    setSubject(personalize(tpl.subject, prospect))
    setBody(personalize(tpl.body, prospect))
    setCopied(false)
    setLogged(false)
  }

  function generateFollowUp() {
    if (!prospect) return
    setSubject(followUpSubject(lastSent?.subject ?? `Exterior cleaning for ${prospect.businessName}`))
    setBody(followUpBody(prospect, lastSent?.body))
    setTemplateId('')
    setCopied(false)
    setLogged(false)
  }

  function startEdit(id?: string) {
    if (id) {
      const tpl = state.templates.find((t) => t.id === id)
      if (!tpl) return
      setEditingId(id)
      setTplName(tpl.name)
      setTplSubject(tpl.subject)
      setTplBody(withEmailSignature(tpl.body))
    } else {
      setEditingId('new')
      setTplName('')
      setTplSubject('Exterior cleaning for {{businessName}}')
      setTplBody(defaultTemplateBody())
    }
  }

  function saveTpl(e: React.FormEvent) {
    e.preventDefault()
    const saved = saveTemplate({
      id: editingId === 'new' ? undefined : editingId ?? undefined,
      name: tplName,
      subject: tplSubject,
      body: withEmailSignature(tplBody),
    })
    setEditingId(null)
    setTemplateId(saved.id)
  }

  return (
    <div className="page emails-page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Outreach</p>
          <h1>Emails</h1>
          <p className="lede">
            Templates, personalized drafts, follow-ups — then log what you sent.
          </p>
        </div>
      </header>

      <div className="emails-layout">
        <section className="panel">
          <div className="panel-head">
            <h2>Templates</h2>
            <button type="button" className="btn small secondary" onClick={() => startEdit()}>
              New
            </button>
          </div>
          <ul className="tpl-list">
            {state.templates.map((t) => (
              <li key={t.id}>
                <button type="button" className="tpl-btn" onClick={() => applyTemplate(t.id)}>
                  <strong>{t.name}</strong>
                  <span>{t.subject}</span>
                </button>
                <div className="tpl-actions">
                  <button type="button" className="btn ghost small" onClick={() => startEdit(t.id)}>
                    Edit
                  </button>
                  <button
                    type="button"
                    className="btn ghost small"
                    onClick={() => deleteTemplate(t.id)}
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>

          {editingId && (
            <form className="tpl-edit" onSubmit={saveTpl}>
              <label className="lbl">
                Name
                <input className="field" value={tplName} onChange={(e) => setTplName(e.target.value)} required />
              </label>
              <label className="lbl">
                Subject
                <input className="field" value={tplSubject} onChange={(e) => setTplSubject(e.target.value)} required />
              </label>
              <label className="lbl">
                Body (use {'{{businessName}}'}, {'{{decisionMaker}}'}, {'{{services}}'}, {'{{signature}}'}, …)
                <textarea className="field" rows={8} value={tplBody} onChange={(e) => setTplBody(e.target.value)} required />
              </label>
              <div className="modal-actions">
                <button type="button" className="btn secondary" onClick={() => setEditingId(null)}>
                  Cancel
                </button>
                <button type="submit" className="btn">
                  Save template
                </button>
              </div>
            </form>
          )}
        </section>

        <section className="panel composer">
          <div className="composer-top">
            <label className="lbl">
              Prospect
              <select
                className="field"
                value={prospectId}
                onChange={(e) => setProspectId(e.target.value)}
              >
                {state.prospects
                  .filter((p) => p.stage !== 'lost')
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.businessName} — {p.decisionMaker}
                    </option>
                  ))}
              </select>
            </label>
            <div className="composer-actions">
              <button
                type="button"
                className="btn secondary"
                disabled={!prospect || !templateId}
                onClick={() => applyTemplate(templateId)}
              >
                Apply template
              </button>
              <button type="button" className="btn secondary" disabled={!prospect} onClick={generateFollowUp}>
                Generate follow-up
              </button>
            </div>
          </div>

          {prospect && (
            <p className="prospect-snap muted">
              {prospect.email || 'No email on file'} · {prospect.city} ·{' '}
              {serviceLabels(prospect.servicesNeeded)}
            </p>
          )}

          <label className="lbl">
            Subject
            <input className="field" value={subject} onChange={(e) => setSubject(e.target.value)} />
          </label>
          <label className="lbl">
            Body
            <textarea
              className="field"
              rows={14}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Select a template or generate a follow-up."
            />
          </label>

          <div className="composer-foot">
            <button
              type="button"
              className="btn secondary"
              disabled={!body}
              onClick={async () => {
                await navigator.clipboard.writeText(
                  subject ? `${subject}\n\n${body}` : body,
                )
                setCopied(true)
              }}
            >
              {copied ? 'Copied' : 'Copy'}
            </button>
            <button
              type="button"
              className="btn"
              disabled={!prospect || !body}
              onClick={() => {
                markEmailSent({
                  prospectId: prospect!.id,
                  subject: subject || '(no subject)',
                  body: withEmailSignature(body),
                  templateId: templateId || null,
                })
                setLogged(true)
                setBody(withEmailSignature(body))
              }}
            >
              {logged ? 'Logged as sent' : 'Mark sent'}
            </button>
          </div>
        </section>
      </div>

      <section className="panel">
        {selectedSent && selectedProspect ? (
          <>
            <div className="panel-head">
              <h2>Sent email</h2>
              <button type="button" className="btn small secondary" onClick={closeSent}>
                Back to list
              </button>
            </div>
            <div className="sent-detail">
              <dl className="sent-meta">
                <div>
                  <dt>Recipient</dt>
                  <dd>{selectedProspect.decisionMaker || '—'}</dd>
                </div>
                <div>
                  <dt>Email</dt>
                  <dd>{selectedProspect.email || 'No email on file'}</dd>
                </div>
                <div>
                  <dt>Company</dt>
                  <dd>
                    <Link to={`/prospects/${selectedProspect.id}`}>
                      {selectedProspect.businessName}
                    </Link>
                  </dd>
                </div>
                <div>
                  <dt>Date sent</dt>
                  <dd>{formatDateTime(selectedSent.sentAt)}</dd>
                </div>
                <div>
                  <dt>Pipeline stage</dt>
                  <dd>
                    {STAGES.find((s) => s.id === selectedProspect.stage)?.label ??
                      selectedProspect.stage}
                  </dd>
                </div>
                <div>
                  <dt>Follow-up</dt>
                  <dd>{followUpLabel(selectedProspect.nextFollowUpAt)}</dd>
                </div>
              </dl>

              <div className="sent-subject">
                <span className="lbl">Subject</span>
                <strong>{selectedSent.subject}</strong>
              </div>

              <div className="sent-body-block">
                <span className="lbl">Email body</span>
                <pre className="sent-body">{selectedSent.body}</pre>
              </div>

              <div className="sent-notes-block">
                <span className="lbl">Prospect notes</span>
                <p className="sent-notes">
                  {[
                    selectedProspect.propertyNotes,
                    selectedProspect.conversationNotes,
                    selectedProspect.painPoints,
                  ]
                    .map((n) => n.trim())
                    .filter(Boolean)
                    .join('\n\n') || 'No notes on this prospect.'}
                </p>
              </div>

              <div className="sent-detail-actions">
                <Link
                  className="btn secondary"
                  to={`/prospects/${selectedProspect.id}`}
                >
                  Open prospect
                </Link>
                <button
                  type="button"
                  className="btn"
                  onClick={() => {
                    setProspectId(selectedProspect.id)
                    setSubject(
                      followUpSubject(
                        selectedSent.subject ||
                          `Exterior cleaning for ${selectedProspect.businessName}`,
                      ),
                    )
                    setBody(followUpBody(selectedProspect, selectedSent.body))
                    setTemplateId('')
                    setCopied(false)
                    setLogged(false)
                    closeSent()
                  }}
                >
                  Draft follow-up
                </button>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="panel-head">
              <h2>Sent emails</h2>
            </div>
            <ul className="sent-list">
              {state.sentEmails.map((e) => {
                const p = state.prospects.find((x) => x.id === e.prospectId)
                return (
                  <li key={e.id}>
                    <button
                      type="button"
                      className="sent-row"
                      onClick={() => openSent(e.id)}
                    >
                      <strong>{e.subject}</strong>
                      <span>
                        {p?.businessName ?? 'Prospect'}
                        {p?.decisionMaker ? ` · ${p.decisionMaker}` : ''}
                        {' · '}
                        {formatDateTime(e.sentAt)}
                      </span>
                    </button>
                  </li>
                )
              })}
              {state.sentEmails.length === 0 && (
                <li className="empty">No emails logged yet.</li>
              )}
            </ul>
          </>
        )}
      </section>
    </div>
  )
}
