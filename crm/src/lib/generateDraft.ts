import type { PipelineStage, Prospect, TaskKind } from '../types.ts'
import {
  followUpBody,
  followUpSubject,
  serviceLabels,
  withEmailSignature,
} from './templates.ts'

export type DraftIntent =
  | 'first_outreach'
  | 'follow_up'
  | 'proposal'
  | 'site_visit'
  | 'call'
  | 'general'

export interface GeneratedDraft {
  intent: DraftIntent
  kind: TaskKind
  channel: 'email' | 'call' | 'visit' | 'quote'
  to: string
  toName: string
  phone: string
  subject: string
  body: string
  /** Opens Gmail compose in the browser with To / subject / body filled. */
  gmailHref: string
  contextLines: string[]
  missing: string[]
}

function firstName(fullName: string) {
  const part = fullName.trim().split(/\s+/)[0]
  return part || 'there'
}

function locationLine(p: Prospect) {
  const bits = [p.address, p.city, p.state].map((x) => x?.trim()).filter(Boolean)
  if (bits.length) return bits.join(', ')
  return ''
}

function servicesLine(p: Prospect) {
  const labeled = serviceLabels(p.servicesNeeded)
  if (labeled) return labeled
  if (p.servicesDiscussed.trim()) return p.servicesDiscussed.trim()
  return 'pressure washing, window cleaning, and junk removal'
}

function propertyNeedLine(p: Prospect) {
  const chunks = [p.propertyNotes, p.painPoints, p.servicesDiscussed]
    .map((x) => x.trim())
    .filter(Boolean)
  return chunks[0] || ''
}

function intentFromAction(
  kind: TaskKind,
  stage: PipelineStage,
  hasPriorEmail: boolean,
): DraftIntent {
  if (kind === 'quote' || stage === 'proposal_sent') return 'proposal'
  if (kind === 'visit' || stage === 'site_visit_scheduled') return 'site_visit'
  if (kind === 'call') return 'call'
  if (stage === 'not_contacted' && !hasPriorEmail) return 'first_outreach'
  if (hasPriorEmail || stage === 'email_sent' || stage === 'follow_up_due') {
    return 'follow_up'
  }
  return 'general'
}

function buildContextLines(p: Prospect): string[] {
  const lines: string[] = []
  if (p.decisionMaker) {
    lines.push(
      p.jobTitle
        ? `${p.decisionMaker} · ${p.jobTitle}`
        : p.decisionMaker,
    )
  }
  if (p.businessName) lines.push(p.businessName)
  if (p.industry) lines.push(p.industry)
  const loc = locationLine(p)
  if (loc) lines.push(loc)
  if (p.email) lines.push(p.email)
  const phone = p.phone || p.companyPhone
  if (phone) lines.push(phone)
  const services = serviceLabels(p.servicesNeeded)
  if (services) lines.push(`Services: ${services}`)
  if (p.propertyNotes.trim()) lines.push(`Property: ${p.propertyNotes.trim()}`)
  if (p.painPoints.trim()) lines.push(`Pain points: ${p.painPoints.trim()}`)
  if (p.conversationNotes.trim()) {
    lines.push(`Conversation: ${p.conversationNotes.trim()}`)
  }
  return lines
}

function buildMissing(p: Prospect, channel: GeneratedDraft['channel']): string[] {
  const missing: string[] = []
  if (channel === 'email' && !p.email.trim()) missing.push('email address')
  if (channel === 'call' && !(p.phone || p.companyPhone).trim()) {
    missing.push('phone number')
  }
  if (!p.decisionMaker.trim()) missing.push('decision maker name')
  if (!p.businessName.trim()) missing.push('company name')
  if (!p.servicesNeeded.length && !p.servicesDiscussed.trim() && !p.propertyNotes.trim()) {
    missing.push('services / property needs')
  }
  return missing
}

function emailBodies(p: Prospect, intent: DraftIntent, lastBody?: string) {
  const name = firstName(p.decisionMaker)
  const company = p.businessName || 'your property'
  const services = servicesLine(p)
  const need = propertyNeedLine(p)
  const loc = locationLine(p)
  const role = p.jobTitle.trim()
  const roleBit = role ? ` as ${role}` : ''

  if (intent === 'proposal') {
    return {
      subject: `Following up on the proposal for ${company}`,
      body: withEmailSignature(`Hi ${name},

Wanted to follow up on the proposal for ${company}${loc ? ` (${loc})` : ''}.

${need ? `Based on what we discussed — ${need} — ` : ''}I'm happy to walk through scope, timing, or adjust anything so it fits your team.

Would a quick call this week work to finalize next steps?`),
    }
  }

  if (intent === 'site_visit') {
    return {
      subject: `Site visit for ${company}`,
      body: withEmailSignature(`Hi ${name},

Confirming a site visit for ${company}${loc ? ` at ${loc}` : ''} so we can look at ${services.toLowerCase()} in person.

${need ? `I noted: ${need}. ` : ''}If that still works, reply with the best day/time and any gate or access details.

Looking forward to walking the property with you.`),
    }
  }

  if (intent === 'follow_up') {
    return {
      subject: followUpSubject(`Exterior cleaning for ${company}`),
      body: lastBody?.trim()
        ? followUpBody(p, lastBody)
        : withEmailSignature(`Hi ${name},

Just following up on ${services.toLowerCase()} for ${company}${loc ? ` in ${loc}` : ''}.

${need ? `From the notes I have: ${need}. ` : ''}Happy to answer questions on scope, timing, or a quick site look — whatever is easiest on your end.

If now isn't the right time, tell me when to check back.`),
    }
  }

  if (intent === 'call') {
    return {
      subject: `Quick call about ${company}`,
      body: withEmailSignature(`Hi ${name},

I tried reaching you about ${services.toLowerCase()} for ${company}${loc ? ` (${loc})` : ''}.

${need ? `I wanted to discuss: ${need}. ` : ''}If email is easier, reply here with a good time to connect — or call me anytime.

Thanks,`),
    }
  }

  // first_outreach / general
  return {
    subject: `${services} for ${company}`,
    body: withEmailSignature(`Hi ${name},

This is William Harris with Harris Exterior Solutions. We help commercial properties stay clean and presentable with pressure washing, window cleaning, and junk removal.

I'd like to connect with you${roleBit} about ${services.toLowerCase()} for ${company}${loc ? ` at ${loc}` : ''}.
${need ? `\nFrom what I can see / what we discussed: ${need}.\n` : ''}
Would a short call this week work to see if we're a fit?`),
  }
}

function callScript(p: Prospect): string {
  const name = firstName(p.decisionMaker)
  const company = p.businessName || 'the property'
  const services = servicesLine(p)
  const need = propertyNeedLine(p)
  const loc = locationLine(p)
  const lines = [
    `Call ${p.decisionMaker || 'decision maker'} at ${company}`,
    p.jobTitle ? `Role: ${p.jobTitle}` : '',
    `Phone: ${p.phone || p.companyPhone || 'no phone on file'}`,
    loc ? `Location: ${loc}` : '',
    '',
    'Opening:',
    `Hi ${name}, this is William with Harris Exterior Solutions. I'm calling about ${services.toLowerCase()} for ${company}.`,
    '',
    need ? `Talking point: ${need}` : 'Talking point: ask what exterior cleaning needs they have right now.',
    p.conversationNotes.trim()
      ? `Prior conversation: ${p.conversationNotes.trim()}`
      : '',
    '',
    'Ask:',
    '- Who handles vendors / budgets for exterior work?',
    '- Any staining, windows, dumpster pads, or sidewalks that need attention?',
    '- Good next step: site visit or short quote?',
    '',
    'Close: confirm follow-up date and best email.',
  ]
  return lines.filter((line, i, arr) => !(line === '' && arr[i - 1] === '')).join('\n')
}

function visitBrief(p: Prospect): string {
  const company = p.businessName || 'Property'
  const loc = locationLine(p)
  const need = propertyNeedLine(p)
  const services = servicesLine(p)
  return [
    `Site visit — ${company}`,
    loc ? `Address: ${loc}` : 'Address: add on prospect card',
    `Contact: ${p.decisionMaker || '—'} · ${p.phone || p.companyPhone || 'no phone'}`,
    `Focus: ${services}`,
    need ? `Notes: ${need}` : 'Notes: capture photos, access, and problem areas on site.',
    p.conversationNotes.trim()
      ? `Conversation: ${p.conversationNotes.trim()}`
      : '',
  ]
    .filter(Boolean)
    .join('\n')
}

/** Gmail web compose — uses the Google account already signed into the browser. */
export function gmailComposeHref(to: string, subject: string, body: string) {
  if (!to.trim()) return ''
  const params = new URLSearchParams({
    view: 'cm',
    fs: '1',
    to: to.trim(),
    su: subject,
    body,
  })
  return `https://mail.google.com/mail/?${params.toString()}`
}

/** Build a ready-to-send outreach draft from the prospect card. */
export function generateActionDraft(
  prospect: Prospect,
  kind: TaskKind = 'email',
  options?: { lastEmailBody?: string; lastEmailSubject?: string },
): GeneratedDraft {
  const hasPriorEmail = Boolean(options?.lastEmailBody || options?.lastEmailSubject)
  const intent = intentFromAction(kind, prospect.stage, hasPriorEmail)
  const channel: GeneratedDraft['channel'] =
    kind === 'call'
      ? 'call'
      : kind === 'visit'
        ? 'visit'
        : kind === 'quote'
          ? 'quote'
          : 'email'

  const to = prospect.email.trim()
  const phone = (prospect.phone || prospect.companyPhone).trim()
  const contextLines = buildContextLines(prospect)
  const missing = buildMissing(prospect, channel === 'quote' ? 'email' : channel)

  if (channel === 'call') {
    const script = callScript(prospect)
    const email = emailBodies(prospect, 'call')
    return {
      intent,
      kind,
      channel,
      to,
      toName: prospect.decisionMaker,
      phone,
      subject: `Call script — ${prospect.businessName}`,
      body: script,
      gmailHref: gmailComposeHref(to, email.subject, email.body),
      contextLines,
      missing,
    }
  }

  if (channel === 'visit') {
    const brief = visitBrief(prospect)
    const email = emailBodies(prospect, 'site_visit')
    return {
      intent,
      kind,
      channel,
      to,
      toName: prospect.decisionMaker,
      phone,
      subject: `Site visit — ${prospect.businessName}`,
      body: brief,
      gmailHref: gmailComposeHref(to, email.subject, email.body),
      contextLines,
      missing,
    }
  }

  const emailIntent: DraftIntent =
    channel === 'quote' ? 'proposal' : intent === 'call' ? 'follow_up' : intent
  const drafted = emailBodies(prospect, emailIntent, options?.lastEmailBody)
  const subject =
    emailIntent === 'follow_up' && options?.lastEmailSubject
      ? followUpSubject(options.lastEmailSubject)
      : drafted.subject

  return {
    intent: emailIntent,
    kind,
    channel: channel === 'quote' ? 'quote' : 'email',
    to,
    toName: prospect.decisionMaker,
    phone,
    subject,
    body: drafted.body,
    gmailHref: gmailComposeHref(to, subject, drafted.body),
    contextLines,
    missing,
  }
}

export function generateEmailPath(
  prospectId: string,
  kind: TaskKind = 'email',
) {
  const params = new URLSearchParams({
    prospect: prospectId,
    generate: '1',
    kind,
  })
  return `/emails?${params.toString()}`
}

export function actionGenerateLabel(kind: TaskKind) {
  switch (kind) {
    case 'email':
      return 'Generate email'
    case 'call':
      return 'Generate call script'
    case 'visit':
      return 'Generate visit brief'
    case 'quote':
      return 'Generate proposal email'
    default:
      return 'Generate'
  }
}
