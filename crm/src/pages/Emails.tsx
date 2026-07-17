import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useSales } from '../store/SalesContext'
import {
  followUpBody,
  followUpSubject,
  withEmailSignature,
  EMAIL_SIGNATURE,
  serviceLabels,
} from '../lib/templates'
import {
  actionGenerateLabel,
  generateActionDraft,
  gmailComposeHref,
  HES_OUTREACH_GMAIL,
} from '../lib/generateDraft'
import {
  formatDate,
  formatDateTime,
  isOverdue,
  isToday,
} from '../lib/dates'
import { STAGES, type Prospect, type TaskKind } from '../types'
import './Emails.css'

function followUpLabel(nextFollowUpAt: string | null) {
  if (!nextFollowUpAt) return 'No follow-up scheduled'
  if (isOverdue(nextFollowUpAt)) return `Overdue · was ${formatDate(nextFollowUpAt)}`
  if (isToday(nextFollowUpAt)) return `Due today · ${formatDate(nextFollowUpAt)}`
  return `Scheduled · ${formatDate(nextFollowUpAt)}`
}

function asTaskKind(value: string | null): TaskKind {
  if (
    value === 'call' ||
    value === 'email' ||
    value === 'visit' ||
    value === 'quote' ||
    value === 'other'
  ) {
    return value
  }
  return 'email'
}

function suggestedNextStep(p: Prospect, hasSentEmail: boolean) {
  if (isOverdue(p.nextFollowUpAt)) {
    return 'Follow-up is overdue — send or call today.'
  }
  if (isToday(p.nextFollowUpAt)) {
    return 'Follow-up due today — finish this touch, then set the next date.'
  }
  switch (p.stage) {
    case 'not_contacted':
      return hasSentEmail
        ? 'First email logged — call if no reply in 2–3 days.'
        : 'Send first outreach, then schedule a follow-up call.'
    case 'email_sent':
    case 'follow_up_due':
      return 'Call the decision maker and confirm interest or timing.'
    case 'called':
    case 'left_voicemail':
      return 'Send a short email referencing the call and propose a site visit.'
    case 'spoke_with_dm':
    case 'interested':
      return 'Book a site visit or send a rough scope based on their notes.'
    case 'site_visit_scheduled':
      return 'Confirm access details and prep the visit brief.'
    case 'proposal_sent':
      return 'Follow up on the proposal — ask what would make a yes easy.'
    case 'future_opportunity':
      return 'Light nurture now; set a future check-in date.'
    default:
      return 'Use the draft, then log the send and set the next follow-up.'
  }
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="brief-fact">
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  )
}

export function Emails() {
  const { state, markEmailSent, logCall } = useSales()
  const [params, setParams] = useSearchParams()
  const initialProspect = params.get('prospect') ?? state.prospects[0]?.id ?? ''
  const initialSent = params.get('sent')
  const shouldGenerate = params.get('generate') === '1'
  const generateKind = asTaskKind(params.get('kind'))

  const [prospectId, setProspectId] = useState(initialProspect)
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState(() =>
    params.get('prospect') && !params.get('sent') && !shouldGenerate
      ? EMAIL_SIGNATURE
      : '',
  )
  const [draftMeta, setDraftMeta] = useState<ReturnType<
    typeof generateActionDraft
  > | null>(null)
  const [copied, setCopied] = useState(false)
  const [logged, setLogged] = useState(false)
  const [selectedSentId, setSelectedSentId] = useState<string | null>(initialSent)

  const prospect = useMemo(
    () => state.prospects.find((p) => p.id === prospectId),
    [state.prospects, prospectId],
  )

  const prospectSent = useMemo(
    () =>
      state.sentEmails
        .filter((e) => e.prospectId === prospectId)
        .sort((a, b) => b.sentAt.localeCompare(a.sentAt)),
    [state.sentEmails, prospectId],
  )

  const lastSent = prospectSent[0]

  const recentActivity = useMemo(
    () =>
      state.timeline
        .filter((e) => e.prospectId === prospectId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, 5),
    [state.timeline, prospectId],
  )

  const openTasks = useMemo(
    () =>
      state.tasks
        .filter((t) => t.prospectId === prospectId && !t.done)
        .sort((a, b) => a.dueAt.localeCompare(b.dueAt))
        .slice(0, 3),
    [state.tasks, prospectId],
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

  function fillFromProspect(nextProspectId: string, kind: TaskKind = 'email') {
    const p = state.prospects.find((x) => x.id === nextProspectId)
    if (!p) return
    const prior = state.sentEmails.find((e) => e.prospectId === nextProspectId)
    const draft = generateActionDraft(p, kind, {
      lastEmailBody: prior?.body,
      lastEmailSubject: prior?.subject,
    })
    setProspectId(nextProspectId)
    setDraftMeta(draft)
    setSubject(draft.subject)
    setBody(draft.body)
    setCopied(false)
    setLogged(false)
  }

  useEffect(() => {
    if (!shouldGenerate || !initialProspect) return
    fillFromProspect(initialProspect, generateKind)
    const next = new URLSearchParams(params)
    next.delete('generate')
    setParams(next, { replace: true })
    // Only auto-run when arriving from Today / generate link.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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

  const isScript =
    draftMeta?.channel === 'call' || draftMeta?.channel === 'visit'
  const composerTitle = isScript
    ? draftMeta?.channel === 'call'
      ? 'Call script'
      : 'Visit brief'
    : 'Email draft'

  const gmailHref =
    !isScript && prospect?.email
      ? gmailComposeHref(prospect.email, subject, body)
      : ''

  const location = prospect
    ? [prospect.address, prospect.city, prospect.state].filter(Boolean).join(', ')
    : ''

  return (
    <div className="page emails-page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Outreach</p>
          <h1>Emails</h1>
          <p className="lede">
            Generate from the prospect brief, open in Gmail as {HES_OUTREACH_GMAIL},
            then mark sent.
          </p>
        </div>
      </header>

      <div className="emails-layout">
        <section className="panel brief-panel">
          <div className="panel-head">
            <h2>Prospect brief</h2>
            {prospect && (
              <Link className="btn small secondary" to={`/prospects/${prospect.id}`}>
                Edit card
              </Link>
            )}
          </div>

          <label className="lbl">
            Who are you writing?
            <select
              className="field"
              value={prospectId}
              onChange={(e) => {
                setProspectId(e.target.value)
                setDraftMeta(null)
                setLogged(false)
                setCopied(false)
              }}
            >
              {state.prospects
                .filter((p) => p.stage !== 'lost')
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.businessName} — {p.decisionMaker || 'No decision maker'}
                  </option>
                ))}
            </select>
          </label>

          {!prospect ? (
            <p className="empty">Select a prospect to see their brief.</p>
          ) : (
            <>
              <div className="brief-hero">
                <strong>{prospect.decisionMaker || 'Decision maker needed'}</strong>
                <span>
                  {prospect.jobTitle ? `${prospect.jobTitle} · ` : ''}
                  {prospect.businessName}
                </span>
                <span className="brief-stage">
                  {STAGES.find((s) => s.id === prospect.stage)?.label ?? prospect.stage}
                  {' · '}
                  {prospect.priority} priority
                </span>
              </div>

              <dl className="brief-facts">
                <Fact label="Email">
                  {prospect.email ? (
                    <a href={`mailto:${prospect.email}`}>{prospect.email}</a>
                  ) : (
                    <em>Missing — add on prospect card</em>
                  )}
                </Fact>
                <Fact label="Phone">
                  {prospect.phone || prospect.companyPhone ? (
                    <a
                      href={`tel:${(prospect.phone || prospect.companyPhone).replace(/\D/g, '')}`}
                    >
                      {prospect.phone || prospect.companyPhone}
                    </a>
                  ) : (
                    <em>Missing</em>
                  )}
                </Fact>
                <Fact label="Company">{prospect.businessName || '—'}</Fact>
                {prospect.industry && <Fact label="Industry">{prospect.industry}</Fact>}
                {location && <Fact label="Location">{location}</Fact>}
                {serviceLabels(prospect.servicesNeeded) && (
                  <Fact label="Services">
                    {serviceLabels(prospect.servicesNeeded)}
                  </Fact>
                )}
                <Fact label="Follow-up">{followUpLabel(prospect.nextFollowUpAt)}</Fact>
                <Fact label="Last contact">
                  {prospect.lastContactAt
                    ? formatDate(prospect.lastContactAt)
                    : 'Never contacted'}
                </Fact>
              </dl>

              <div className="brief-block">
                <h3>What to do next</h3>
                <p>{suggestedNextStep(prospect, Boolean(lastSent))}</p>
              </div>

              {(prospect.propertyNotes.trim() ||
                prospect.painPoints.trim() ||
                prospect.conversationNotes.trim() ||
                prospect.servicesDiscussed.trim()) && (
                <div className="brief-block">
                  <h3>From the card</h3>
                  {prospect.propertyNotes.trim() && (
                    <p>
                      <span>Property</span>
                      {prospect.propertyNotes}
                    </p>
                  )}
                  {prospect.painPoints.trim() && (
                    <p>
                      <span>Needs</span>
                      {prospect.painPoints}
                    </p>
                  )}
                  {prospect.servicesDiscussed.trim() && (
                    <p>
                      <span>Discussed</span>
                      {prospect.servicesDiscussed}
                    </p>
                  )}
                  {prospect.conversationNotes.trim() && (
                    <p>
                      <span>Conversation</span>
                      {prospect.conversationNotes}
                    </p>
                  )}
                </div>
              )}

              {lastSent && (
                <div className="brief-block">
                  <h3>Last email</h3>
                  <button
                    type="button"
                    className="brief-last-email"
                    onClick={() => openSent(lastSent.id)}
                  >
                    <strong>{lastSent.subject}</strong>
                    <span>{formatDateTime(lastSent.sentAt)}</span>
                  </button>
                </div>
              )}

              {openTasks.length > 0 && (
                <div className="brief-block">
                  <h3>Open tasks</h3>
                  <ul className="brief-list">
                    {openTasks.map((t) => (
                      <li key={t.id}>
                        <strong>{t.title}</strong>
                        <span>
                          {t.kind} · {formatDate(t.dueAt)}
                          {isOverdue(t.dueAt) ? ' · overdue' : ''}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {recentActivity.length > 0 && (
                <div className="brief-block">
                  <h3>Recent activity</h3>
                  <ul className="brief-list">
                    {recentActivity.map((e) => (
                      <li key={e.id}>
                        <strong>{e.title}</strong>
                        <span>
                          {e.type} · {formatDateTime(e.createdAt)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </section>

        <section className="panel composer">
          <div className="panel-head">
            <h2>{composerTitle}</h2>
          </div>

          <div className="composer-actions">
            <button
              type="button"
              className="btn"
              disabled={!prospect}
              onClick={() => prospect && fillFromProspect(prospect.id, 'email')}
            >
              {actionGenerateLabel('email')}
            </button>
            <button
              type="button"
              className="btn secondary"
              disabled={!prospect}
              onClick={() => prospect && fillFromProspect(prospect.id, 'call')}
            >
              {actionGenerateLabel('call')}
            </button>
            <button
              type="button"
              className="btn secondary"
              disabled={!prospect}
              onClick={() => prospect && fillFromProspect(prospect.id, 'quote')}
            >
              {actionGenerateLabel('quote')}
            </button>
          </div>

          {prospect && (
            <p className="composer-to">
              To:{' '}
              {prospect.email ? (
                <a
                  href={gmailComposeHref(prospect.email, subject || '', body || '')}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {prospect.email}
                </a>
              ) : (
                <em>No email on file</em>
              )}
              {prospect.decisionMaker
                ? ` · ${prospect.decisionMaker}`
                : ''}
              {` · ${prospect.businessName}`}
            </p>
          )}

          {draftMeta && draftMeta.missing.length > 0 && (
            <p className="draft-missing">
              Missing on card: {draftMeta.missing.join(', ')}. Draft still
              generated — fill those fields for better outreach.
            </p>
          )}

          {!isScript && (
            <label className="lbl">
              Subject
              <input
                className="field"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
              />
            </label>
          )}
          <label className="lbl">
            {isScript ? 'Script / brief' : 'Body'}
            <textarea
              className="field"
              rows={isScript ? 16 : 14}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Generate from the prospect brief."
            />
          </label>

          <div className="composer-foot">
            {gmailHref && (
              <a
                className="btn"
                href={gmailHref}
                target="_blank"
                rel="noopener noreferrer"
                title={`Opens Gmail as ${HES_OUTREACH_GMAIL}`}
              >
                Open in Gmail
              </a>
            )}
            {gmailHref && (
              <p className="gmail-from-note">
                Sends from <strong>{HES_OUTREACH_GMAIL}</strong> — stay signed into
                that Google account in this browser.
              </p>
            )}
            {isScript && draftMeta?.channel === 'call' && prospect && (
              <button
                type="button"
                className="btn"
                onClick={() =>
                  logCall(prospect.id, 'Call logged from generated script')
                }
              >
                Log call
              </button>
            )}
            <button
              type="button"
              className="btn secondary"
              disabled={!body}
              onClick={async () => {
                await navigator.clipboard.writeText(
                  !isScript && subject ? `${subject}\n\n${body}` : body,
                )
                setCopied(true)
              }}
            >
              {copied ? 'Copied' : 'Copy'}
            </button>
            {!isScript && (
              <button
                type="button"
                className="btn"
                disabled={!prospect || !body}
                onClick={() => {
                  markEmailSent({
                    prospectId: prospect!.id,
                    subject: subject || '(no subject)',
                    body: withEmailSignature(body),
                    templateId: null,
                  })
                  setLogged(true)
                  setBody(withEmailSignature(body))
                }}
              >
                {logged ? 'Logged as sent' : 'Mark sent'}
              </button>
            )}
          </div>
        </section>
      </div>

      <section className="panel">
        {selectedSent && selectedProspect ? (
          <>
            <div className="panel-head">
              <h2>Sent email</h2>
              <button
                type="button"
                className="btn small secondary"
                onClick={closeSent}
              >
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
                    setDraftMeta(null)
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
              <h2>
                {prospect
                  ? `Sent to ${prospect.decisionMaker || prospect.businessName}`
                  : 'Sent emails'}
              </h2>
            </div>
            <ul className="sent-list">
              {(prospect ? prospectSent : state.sentEmails).map((e) => {
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
              {(prospect ? prospectSent : state.sentEmails).length === 0 && (
                <li className="empty">No emails logged yet for this prospect.</li>
              )}
            </ul>
          </>
        )}
      </section>
    </div>
  )
}
