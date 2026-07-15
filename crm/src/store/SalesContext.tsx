import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type {
  Attachment,
  EmailTemplate,
  PipelineStage,
  Prospect,
  SalesState,
  Task,
  TaskKind,
  TimelineEvent,
  TimelineEventType,
} from '../types'
import { STAGES } from '../types'
import { uid } from '../lib/dates'
import { loadState, resetState, saveState } from '../lib/storage'

function stageLabel(stage: PipelineStage) {
  return STAGES.find((s) => s.id === stage)?.label ?? stage
}

function makeTimeline(
  prospectId: string,
  type: TimelineEventType,
  title: string,
  body = '',
  extraSearch = '',
  meta?: TimelineEvent['meta'],
): TimelineEvent {
  const searchableText = [title, body, extraSearch, type, prospectId]
    .join(' ')
    .toLowerCase()
  return {
    id: uid('tl'),
    prospectId,
    type,
    title,
    body,
    searchableText,
    meta,
    createdAt: new Date().toISOString(),
  }
}

type ProspectInput = Omit<Prospect, 'id' | 'createdAt' | 'updatedAt'>

interface SalesContextValue {
  state: SalesState
  resetDemo: () => void
  upsertProspect: (p: ProspectInput | Prospect) => Prospect
  updateProspect: (id: string, patch: Partial<Prospect>) => void
  deleteProspect: (id: string) => void
  setStage: (id: string, stage: PipelineStage, note?: string) => void
  addTask: (input: {
    prospectId: string
    title: string
    kind: TaskKind
    dueAt: string
    salesRep?: string
  }) => Task
  completeTask: (taskId: string, logTimeline?: boolean) => void
  deleteTask: (taskId: string) => void
  logEvent: (input: {
    prospectId: string
    type: TimelineEventType
    title: string
    body?: string
    touchContact?: boolean
  }) => TimelineEvent
  logCall: (prospectId: string, body?: string, voicemail?: boolean) => void
  addAttachment: (input: Omit<Attachment, 'id' | 'createdAt'>) => Attachment
  deleteAttachment: (id: string) => void
  saveTemplate: (t: Omit<EmailTemplate, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }) => EmailTemplate
  deleteTemplate: (id: string) => void
  markEmailSent: (input: {
    prospectId: string
    subject: string
    body: string
    templateId?: string | null
  }) => void
  searchAll: (query: string) => {
    prospects: Prospect[]
    tasks: Task[]
    timeline: TimelineEvent[]
  }
}

const SalesContext = createContext<SalesContextValue | null>(null)

export function SalesProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SalesState>(() => loadState())

  useEffect(() => {
    saveState(state)
  }, [state])

  const touchProspect = useCallback(
    (prospects: Prospect[], id: string, patch: Partial<Prospect> = {}) =>
      prospects.map((p) =>
        p.id === id
          ? { ...p, ...patch, updatedAt: new Date().toISOString() }
          : p,
      ),
    [],
  )

  const upsertProspect = useCallback((p: ProspectInput | Prospect) => {
    const now = new Date().toISOString()
    if ('id' in p && p.id) {
      const updated = { ...p, updatedAt: now } as Prospect
      setState((s) => ({
        ...s,
        prospects: s.prospects.map((x) => (x.id === updated.id ? updated : x)),
      }))
      return updated
    }
    const created: Prospect = {
      ...(p as ProspectInput),
      id: uid('p'),
      createdAt: now,
      updatedAt: now,
    }
    const event = makeTimeline(
      created.id,
      'other',
      'Prospect created',
      created.businessName,
      `${created.businessName} ${created.city} ${created.decisionMaker}`,
    )
    setState((s) => ({
      ...s,
      prospects: [created, ...s.prospects],
      timeline: [event, ...s.timeline],
    }))
    return created
  }, [])

  const updateProspect = useCallback((id: string, patch: Partial<Prospect>) => {
    setState((s) => ({
      ...s,
      prospects: s.prospects.map((p) =>
        p.id === id ? { ...p, ...patch, updatedAt: new Date().toISOString() } : p,
      ),
    }))
  }, [])

  const deleteProspect = useCallback((id: string) => {
    setState((s) => ({
      prospects: s.prospects.filter((p) => p.id !== id),
      tasks: s.tasks.filter((t) => t.prospectId !== id),
      timeline: s.timeline.filter((e) => e.prospectId !== id),
      sentEmails: s.sentEmails.filter((e) => e.prospectId !== id),
      attachments: s.attachments.filter((a) => a.prospectId !== id),
      templates: s.templates,
    }))
  }, [])

  const setStage = useCallback(
    (id: string, stage: PipelineStage, note = '') => {
      setState((s) => {
        const prev = s.prospects.find((p) => p.id === id)
        if (!prev || prev.stage === stage) return s
        const event = makeTimeline(
          id,
          'stage_change',
          stageLabel(stage),
          note || `Moved from ${stageLabel(prev.stage)} to ${stageLabel(stage)}`,
          `${prev.businessName} ${stage}`,
          { from: prev.stage, to: stage },
        )
        return {
          ...s,
          prospects: touchProspect(s.prospects, id, {
            stage,
            ...(stage === 'won' || stage === 'lost'
              ? { nextFollowUpAt: null, probability: stage === 'won' ? 100 : 0 }
              : {}),
          }),
          timeline: [event, ...s.timeline],
        }
      })
    },
    [touchProspect],
  )

  const addTask = useCallback(
    (input: {
      prospectId: string
      title: string
      kind: TaskKind
      dueAt: string
      salesRep?: string
    }) => {
      const prospect = state.prospects.find((p) => p.id === input.prospectId)
      const task: Task = {
        id: uid('t'),
        prospectId: input.prospectId,
        title: input.title,
        kind: input.kind,
        dueAt: input.dueAt,
        done: false,
        completedAt: null,
        salesRep: input.salesRep || prospect?.salesRep || 'Will',
        createdAt: new Date().toISOString(),
      }
      const event = makeTimeline(
        input.prospectId,
        'task_created',
        'Task created',
        input.title,
        `${prospect?.businessName ?? ''} ${input.kind}`,
      )
      setState((s) => ({
        ...s,
        tasks: [task, ...s.tasks],
        timeline: [event, ...s.timeline],
      }))
      return task
    },
    [state.prospects],
  )

  const completeTask = useCallback((taskId: string, logTimeline = true) => {
    setState((s) => {
      const task = s.tasks.find((t) => t.id === taskId)
      if (!task || task.done) return s
      const now = new Date().toISOString()
      const prospect = s.prospects.find((p) => p.id === task.prospectId)
      const event = logTimeline
        ? makeTimeline(
            task.prospectId,
            'task_completed',
            'Task completed',
            task.title,
            `${prospect?.businessName ?? ''} ${task.kind}`,
          )
        : null
      return {
        ...s,
        tasks: s.tasks.map((t) =>
          t.id === taskId ? { ...t, done: true, completedAt: now } : t,
        ),
        timeline: event ? [event, ...s.timeline] : s.timeline,
      }
    })
  }, [])

  const deleteTask = useCallback((taskId: string) => {
    setState((s) => ({ ...s, tasks: s.tasks.filter((t) => t.id !== taskId) }))
  }, [])

  const logEvent = useCallback(
    (input: {
      prospectId: string
      type: TimelineEventType
      title: string
      body?: string
      touchContact?: boolean
    }) => {
      const prospect = state.prospects.find((p) => p.id === input.prospectId)
      const event = makeTimeline(
        input.prospectId,
        input.type,
        input.title,
        input.body ?? '',
        `${prospect?.businessName ?? ''} ${prospect?.decisionMaker ?? ''}`,
      )
      setState((s) => ({
        ...s,
        timeline: [event, ...s.timeline],
        prospects: touchProspect(s.prospects, input.prospectId, {
          ...(input.touchContact !== false
            ? { lastContactAt: event.createdAt }
            : {}),
        }),
      }))
      return event
    },
    [state.prospects, touchProspect],
  )

  const logCall = useCallback(
    (prospectId: string, body = '', voicemail = false) => {
      setState((s) => {
        const prospect = s.prospects.find((p) => p.id === prospectId)
        if (!prospect) return s
        const type = voicemail ? 'voicemail' : 'call'
        const title = voicemail ? 'Left Voicemail' : 'Called'
        const event = makeTimeline(
          prospectId,
          type,
          title,
          body,
          `${prospect.businessName} ${prospect.decisionMaker}`,
        )
        let stage = prospect.stage
        if (
          !voicemail &&
          ['not_researched', 'research_complete', 'email_sent'].includes(prospect.stage)
        ) {
          stage = 'called'
        }
        return {
          ...s,
          timeline: [event, ...s.timeline],
          prospects: touchProspect(s.prospects, prospectId, {
            lastContactAt: event.createdAt,
            stage,
          }),
        }
      })
    },
    [touchProspect],
  )

  const addAttachment = useCallback((input: Omit<Attachment, 'id' | 'createdAt'>) => {
    const attachment: Attachment = {
      ...input,
      id: uid('a'),
      createdAt: new Date().toISOString(),
    }
    const event = makeTimeline(
      input.prospectId,
      'attachment',
      `Added ${input.kind}`,
      input.name,
      input.note,
    )
    setState((s) => ({
      ...s,
      attachments: [attachment, ...s.attachments],
      timeline: [event, ...s.timeline],
    }))
    return attachment
  }, [])

  const deleteAttachment = useCallback((id: string) => {
    setState((s) => ({
      ...s,
      attachments: s.attachments.filter((a) => a.id !== id),
    }))
  }, [])

  const saveTemplate = useCallback(
    (t: Omit<EmailTemplate, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }) => {
      const now = new Date().toISOString()
      if (t.id) {
        const updated: EmailTemplate = {
          id: t.id,
          name: t.name,
          subject: t.subject,
          body: t.body,
          createdAt:
            state.templates.find((x) => x.id === t.id)?.createdAt ?? now,
          updatedAt: now,
        }
        setState((s) => ({
          ...s,
          templates: s.templates.map((x) => (x.id === updated.id ? updated : x)),
        }))
        return updated
      }
      const created: EmailTemplate = {
        id: uid('tpl'),
        name: t.name,
        subject: t.subject,
        body: t.body,
        createdAt: now,
        updatedAt: now,
      }
      setState((s) => ({ ...s, templates: [created, ...s.templates] }))
      return created
    },
    [state.templates],
  )

  const deleteTemplate = useCallback((id: string) => {
    setState((s) => ({
      ...s,
      templates: s.templates.filter((t) => t.id !== id),
    }))
  }, [])

  const markEmailSent = useCallback(
    (input: {
      prospectId: string
      subject: string
      body: string
      templateId?: string | null
    }) => {
      setState((s) => {
        const prospect = s.prospects.find((p) => p.id === input.prospectId)
        if (!prospect) return s
        const sentAt = new Date().toISOString()
        const sent = {
          id: uid('se'),
          prospectId: input.prospectId,
          templateId: input.templateId ?? null,
          subject: input.subject,
          body: input.body,
          sentAt,
        }
        const event = makeTimeline(
          input.prospectId,
          'email',
          'Email Sent',
          input.subject,
          `${prospect.businessName} ${input.body}`,
        )
        let stage = prospect.stage
        if (prospect.stage === 'not_researched' || prospect.stage === 'research_complete') {
          stage = 'email_sent'
        } else if (prospect.stage === 'called') {
          stage = 'follow_up_1'
        } else if (prospect.stage === 'follow_up_1') {
          stage = 'follow_up_2'
        }
        return {
          ...s,
          sentEmails: [sent, ...s.sentEmails],
          timeline: [event, ...s.timeline],
          prospects: touchProspect(s.prospects, input.prospectId, {
            lastContactAt: sentAt,
            stage,
          }),
        }
      })
    },
    [touchProspect],
  )

  const searchAll = useCallback(
    (query: string) => {
      const q = query.trim().toLowerCase()
      if (!q) {
        return { prospects: [], tasks: [], timeline: [] }
      }
      const prospects = state.prospects.filter((p) =>
        [
          p.businessName,
          p.industry,
          p.city,
          p.decisionMaker,
          p.email,
          p.phone,
          p.notes,
          p.address,
          p.jobTitle,
        ]
          .join(' ')
          .toLowerCase()
          .includes(q),
      )
      const tasks = state.tasks.filter((t) => {
        const p = state.prospects.find((x) => x.id === t.prospectId)
        return `${t.title} ${t.kind} ${p?.businessName ?? ''}`.toLowerCase().includes(q)
      })
      const timeline = state.timeline.filter((e) => e.searchableText.includes(q))
      return { prospects, tasks, timeline }
    },
    [state],
  )

  const resetDemo = useCallback(() => setState(resetState()), [])

  const value = useMemo(
    () => ({
      state,
      resetDemo,
      upsertProspect,
      updateProspect,
      deleteProspect,
      setStage,
      addTask,
      completeTask,
      deleteTask,
      logEvent,
      logCall,
      addAttachment,
      deleteAttachment,
      saveTemplate,
      deleteTemplate,
      markEmailSent,
      searchAll,
    }),
    [
      state,
      resetDemo,
      upsertProspect,
      updateProspect,
      deleteProspect,
      setStage,
      addTask,
      completeTask,
      deleteTask,
      logEvent,
      logCall,
      addAttachment,
      deleteAttachment,
      saveTemplate,
      deleteTemplate,
      markEmailSent,
      searchAll,
    ],
  )

  return <SalesContext.Provider value={value}>{children}</SalesContext.Provider>
}

export function useSales() {
  const ctx = useContext(SalesContext)
  if (!ctx) throw new Error('useSales must be used within SalesProvider')
  return ctx
}
