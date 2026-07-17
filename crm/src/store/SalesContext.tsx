import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
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
import { CURRENT_SALES_STATE_SCHEMA_VERSION, STAGES } from '../types'
import { uid } from '../lib/dates'
import {
  extractLegacyAuxState,
  loadState,
  loadStateFromCloud,
  resetState,
  saveLegacyAuxToCloud,
  saveState,
  saveStateToCloud,
} from '../lib/storage'
import {
  probeSalesV2,
  salesApi,
  type BootstrapData,
  type DashboardSummary,
  type ReferenceData,
} from '../lib/salesApi'
import {
  PIPELINE_TO_V2,
  activityToTimeline,
  assistantPayloadFromProspect,
  companyPayloadFromProspect,
  contactPayloadFromProspect,
  opportunityPayloadFromProspect,
  opportunityToProspect,
  splitProspectPatch,
  taskFromV2,
  taskTypeToV2,
} from '../lib/v2Adapter'
import {
  boardStageId,
  pipelineForBoardMove,
  type BoardStageId,
} from '../lib/pipelineBoard'

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

export type CloudSyncStatus = 'local' | 'loading' | 'synced' | 'offline' | 'error'
export type SalesApiMode = 'legacy' | 'v2'

interface SalesContextValue {
  state: SalesState
  ready: boolean
  cloudStatus: CloudSyncStatus
  apiMode: SalesApiMode
  dashboard: DashboardSummary | null
  reference: ReferenceData | null
  refreshDashboard: () => Promise<void>
  ensureProspectDetail: (id: string) => Promise<void>
  resetDemo: () => void
  upsertProspect: (p: ProspectInput | Prospect) => Promise<Prospect>
  updateProspect: (id: string, patch: Partial<Prospect>) => void
  deleteProspect: (id: string) => void
  setStage: (id: string, stage: PipelineStage, note?: string) => void
  moveBoardStage: (id: string, stageId: string) => void
  addTask: (input: {
    prospectId: string
    title: string
    kind: TaskKind
    dueAt: string
    salesRep?: string
  }) => Task
  completeTask: (taskId: string, logTimeline?: boolean) => void
  rescheduleTask: (taskId: string, dueAt: string) => void
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
  saveTemplate: (
    t: Omit<EmailTemplate, 'id' | 'createdAt' | 'updatedAt'> & { id?: string },
  ) => EmailTemplate
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

async function loadV2Workspace(bootstrap: BootstrapData): Promise<{
  state: SalesState
  dashboard: DashboardSummary
  reference: ReferenceData
}> {
  const [opps, tasks, activities, legacy] = await Promise.all([
    salesApi.listOpportunities({ page: 1, pageSize: 100, sort: 'updated_at', direction: 'desc' }),
    salesApi.listTasks({ page: 1, pageSize: 100, sort: 'due_at', direction: 'asc' }),
    salesApi.listActivities({ page: 1, pageSize: 100, sort: 'occurred_at', direction: 'desc' }),
    loadStateFromCloud(),
  ])

  const prospects =
    opps.ok
      ? opps.data.data.map((row) => opportunityToProspect(row))
      : []

  const mappedTasks =
    tasks.ok
      ? tasks.data.data.map(taskFromV2).filter((t): t is Task => Boolean(t))
      : []

  const timeline =
    activities.ok
      ? activities.data.data
          .map(activityToTimeline)
          .filter((e): e is TimelineEvent => Boolean(e))
      : []

  const aux =
    legacy.ok && legacy.state
      ? extractLegacyAuxState(legacy.state)
      : extractLegacyAuxState(loadState())

  return {
    dashboard: bootstrap.dashboard,
    reference: bootstrap.reference,
    state: {
      schemaVersion: CURRENT_SALES_STATE_SCHEMA_VERSION,
      prospects,
      tasks: mappedTasks,
      timeline,
      templates: aux.templates,
      sentEmails: aux.sentEmails,
      attachments: aux.attachments,
    },
  }
}

export function SalesProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SalesState>(() => loadState())
  const [ready, setReady] = useState(false)
  const [cloudStatus, setCloudStatus] = useState<CloudSyncStatus>('loading')
  const [apiMode, setApiMode] = useState<SalesApiMode>('legacy')
  const [dashboard, setDashboard] = useState<DashboardSummary | null>(null)
  const [reference, setReference] = useState<ReferenceData | null>(null)
  const skipNextCloudSave = useRef(true)
  const saveTimer = useRef<number | null>(null)
  const cloudEnabled = useRef(false)
  const apiModeRef = useRef<SalesApiMode>('legacy')
  const saveErrorAlerted = useRef(false)
  const stateRef = useRef(state)
  const detailLoading = useRef(new Set<string>())

  useEffect(() => {
    stateRef.current = state
  }, [state])

  useEffect(() => {
    apiModeRef.current = apiMode
  }, [apiMode])

  const markError = useCallback(() => {
    setCloudStatus('error')
  }, [])
  const markSynced = useCallback(() => setCloudStatus('synced'), [])

  const refreshDashboard = useCallback(async () => {
    if (apiModeRef.current !== 'v2') return
    const result = await salesApi.dashboard()
    if (result.ok) setDashboard(result.data)
  }, [])

  const ensureProspectDetail = useCallback(async (id: string) => {
    if (apiModeRef.current !== 'v2' || !id || detailLoading.current.has(id)) return
    detailLoading.current.add(id)
    try {
      const current = stateRef.current.prospects.find((p) => p.id === id)
      const companyId = current?.companyId || id

      const [opp, company, tasks, activities] = await Promise.all([
        salesApi.getOpportunity(id),
        salesApi.getCompany(companyId),
        salesApi.listTasks({
          opportunityId: id,
          page: 1,
          pageSize: 100,
          sort: 'due_at',
          direction: 'asc',
        }),
        salesApi.listActivities({
          opportunityId: id,
          page: 1,
          pageSize: 100,
          sort: 'occurred_at',
          direction: 'desc',
        }),
      ])

      if (!opp.ok) return

      const companyRow = company.ok ? company.data : null
      const contacts = companyRow?.contacts ?? []
      const primary =
        contacts.find((c) => c.id === opp.data.primary_contact_id) ||
        contacts.find((c) => c.is_primary) ||
        null
      const assistant =
        contacts.find(
          (c) =>
            c.contact_type === 'gatekeeper' ||
            (!c.is_primary && c.id !== primary?.id),
        ) || null

      const prospect = opportunityToProspect(opp.data, {
        company: companyRow,
        primary,
        assistant,
      })

      const mappedTasks =
        tasks.ok
          ? tasks.data.data.map(taskFromV2).filter((t): t is Task => Boolean(t))
          : []
      const mappedTimeline =
        activities.ok
          ? activities.data.data
              .map(activityToTimeline)
              .filter((e): e is TimelineEvent => Boolean(e))
          : []

      setState((s) => ({
        ...s,
        prospects: s.prospects.some((p) => p.id === id)
          ? s.prospects.map((p) => (p.id === id ? { ...p, ...prospect } : p))
          : [prospect, ...s.prospects],
        tasks: [
          ...mappedTasks,
          ...s.tasks.filter(
            (t) => t.prospectId !== id && !mappedTasks.some((m) => m.id === t.id),
          ),
        ],
        timeline: [
          ...mappedTimeline,
          ...s.timeline.filter(
            (e) =>
              e.prospectId !== id && !mappedTimeline.some((m) => m.id === e.id),
          ),
        ],
      }))
    } finally {
      detailLoading.current.delete(id)
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    async function hydrate() {
      const v2 = await probeSalesV2()
      if (cancelled) return

      if (v2.available) {
        try {
          const workspace = await loadV2Workspace(v2.bootstrap)
          if (cancelled) return
          const local = loadState()
          const cloudCount = workspace.state.prospects.length
          const localCount = local.prospects.length

          // Never replace a browser full of prospects with an empty cloud
          // snapshot — that silently deleted people's work.
          let nextState = workspace.state
          if (cloudCount === 0 && localCount > 0) {
            nextState = {
              ...workspace.state,
              prospects: local.prospects,
              tasks: local.tasks.length ? local.tasks : workspace.state.tasks,
              timeline: local.timeline.length
                ? local.timeline
                : workspace.state.timeline,
              templates: workspace.state.templates.length
                ? workspace.state.templates
                : local.templates,
              sentEmails: workspace.state.sentEmails.length
                ? workspace.state.sentEmails
                : local.sentEmails,
              attachments: workspace.state.attachments.length
                ? workspace.state.attachments
                : local.attachments,
            }
            window.setTimeout(() => {
              window.alert(
                `Cloud has 0 prospects but this browser still has ${localCount}. ` +
                  `Keeping your local copies on screen. Check the sync pill — ` +
                  `if it is not "Cloud: Sales v2", prospects are not durable yet. ` +
                  `Re-save each important prospect after cloud is green, or contact support to migrate.`,
              )
            }, 600)
          }

          cloudEnabled.current = true
          apiModeRef.current = 'v2'
          setApiMode('v2')
          setDashboard(workspace.dashboard)
          setReference(workspace.reference)
          setState(nextState)
          saveState(nextState)
          setCloudStatus('synced')
          setReady(true)
          window.setTimeout(() => {
            skipNextCloudSave.current = false
          }, 0)
          return
        } catch {
          // fall through to legacy
        }
      }

      const cloud = await loadStateFromCloud()
      if (cancelled) return

      apiModeRef.current = 'legacy'
      setApiMode('legacy')
      setDashboard(null)
      setReference(null)

      if (cloud.ok && cloud.state) {
        cloudEnabled.current = true
        setState(cloud.state)
        saveState(cloud.state)
        setCloudStatus('synced')
      } else if (cloud.ok && !cloud.state) {
        cloudEnabled.current = true
        const local = loadState()
        setState(local)
        const pushed = await saveStateToCloud(local)
        setCloudStatus(pushed ? 'synced' : 'error')
      } else if (!cloud.ok && cloud.reason === 'supabase_not_configured') {
        cloudEnabled.current = false
        setCloudStatus('local')
        window.setTimeout(() => {
          window.alert(
            'Sales cloud is not configured on this deployment. ' +
              'Prospects will only save in this browser and can disappear. ' +
              'Add SUPABASE_SERVICE_ROLE_KEY on Vercel and redeploy.',
          )
        }, 600)
      } else {
        cloudEnabled.current = false
        setCloudStatus('offline')
      }

      setReady(true)
      window.setTimeout(() => {
        skipNextCloudSave.current = false
      }, 0)
    }

    void hydrate()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    saveState(state)
    if (!ready || skipNextCloudSave.current || !cloudEnabled.current) return

    if (saveTimer.current) window.clearTimeout(saveTimer.current)
    saveTimer.current = window.setTimeout(() => {
      const saver =
        apiModeRef.current === 'v2' ? saveLegacyAuxToCloud : saveStateToCloud
      void saver(state).then((ok) => {
        if (ok) {
          setCloudStatus('synced')
          saveErrorAlerted.current = false
          return
        }
        setCloudStatus('error')
        if (!saveErrorAlerted.current) {
          saveErrorAlerted.current = true
          window.alert(
            'Cloud save failed. Your latest edits may only be on this device. ' +
              'Check the sync pill and try again after confirming Supabase env vars on Vercel.',
          )
        }
      })
    }, 500)

    return () => {
      if (saveTimer.current) window.clearTimeout(saveTimer.current)
    }
  }, [state, ready])

  const touchProspect = useCallback(
    (prospects: Prospect[], id: string, patch: Partial<Prospect> = {}) =>
      prospects.map((p) =>
        p.id === id
          ? { ...p, ...patch, updatedAt: new Date().toISOString() }
          : p,
      ),
    [],
  )

  const upsertProspect = useCallback(async (p: ProspectInput | Prospect) => {
    const now = new Date().toISOString()
    if ('id' in p && p.id) {
      const updated = { ...p, updatedAt: now } as Prospect
      setState((s) => ({
        ...s,
        prospects: s.prospects.map((x) => (x.id === updated.id ? updated : x)),
      }))
      if (apiModeRef.current === 'v2') {
        const companyId = updated.companyId || updated.id
        const splits = splitProspectPatch(updated)
        const ops: Promise<{ ok: boolean }>[] = []
        if (Object.keys(splits.company).length) {
          ops.push(salesApi.updateCompany(companyId, splits.company))
        }
        if (updated.primaryContactId && Object.keys(splits.contact).length) {
          ops.push(
            salesApi.updateContact(updated.primaryContactId, splits.contact),
          )
        }
      if (Object.keys(splits.opportunity).length) {
        ops.push(salesApi.updateOpportunity(updated.id, splits.opportunity))
      }
      if (updated.servicesNeeded) {
        ops.push(
          salesApi.replaceOpportunityServices(updated.id, updated.servicesNeeded),
        )
      }
      const results = await Promise.all(ops)
        if (results.some((r) => !r.ok)) markError()
        else {
          markSynced()
          void refreshDashboard()
        }
      }
      return updated
    }

    if (apiModeRef.current === 'v2') {
      const draft: Prospect = {
        ...(p as ProspectInput),
        id: uid('p'),
        createdAt: now,
        updatedAt: now,
      }

      const companyRes = await salesApi.createCompany(
        companyPayloadFromProspect(draft),
      )
      if (!companyRes.ok) {
        markError()
        throw new Error(companyRes.message)
      }
      const companyId = companyRes.data.id

      let primaryContactId: string | null = null
      if (draft.decisionMaker.trim()) {
        const contactRes = await salesApi.createContact(
          contactPayloadFromProspect(companyId, draft, {
            isPrimary: true,
            contactType: 'decision_maker',
          }),
        )
        if (contactRes.ok) primaryContactId = contactRes.data.id
      }

      let assistantContactId: string | undefined
      if (draft.assistantName.trim()) {
        const assistantRes = await salesApi.createContact(
          assistantPayloadFromProspect(companyId, draft),
        )
        if (assistantRes.ok) assistantContactId = assistantRes.data.id
      }

      const oppRes = await salesApi.createOpportunity(
        opportunityPayloadFromProspect(companyId, primaryContactId, draft),
      )
      if (!oppRes.ok) {
        markError()
        throw new Error(oppRes.message)
      }

      const created = opportunityToProspect(oppRes.data, {
        company: companyRes.data,
        primary: primaryContactId
          ? {
              id: primaryContactId,
              company_id: companyId,
              full_name: draft.decisionMaker,
              job_title: draft.jobTitle || null,
              email: draft.email || null,
              phone: draft.phone || null,
              phone_ext: draft.phoneExt || null,
              contact_type: 'decision_maker',
              is_primary: true,
              email_verified: draft.emailVerified,
              decision_maker_confirmed: draft.decisionMakerConfirmed,
              notes: null,
              created_at: now,
              updated_at: now,
              archived_at: null,
            }
          : null,
        assistant: assistantContactId
          ? {
              id: assistantContactId,
              company_id: companyId,
              full_name: draft.assistantName,
              job_title: null,
              email: null,
              phone: draft.assistantPhone || null,
              phone_ext: null,
              contact_type: 'gatekeeper',
              is_primary: false,
              email_verified: false,
              decision_maker_confirmed: false,
              notes: null,
              created_at: now,
              updated_at: now,
              archived_at: null,
            }
          : null,
      })
      if (draft.servicesNeeded.length) {
        const servicesRes = await salesApi.replaceOpportunityServices(
          created.id,
          draft.servicesNeeded,
        )
        if (servicesRes.ok) {
          created.servicesNeeded = draft.servicesNeeded
        }
      } else {
        created.servicesNeeded = []
      }

      const event = makeTimeline(
        created.id,
        'other',
        'Prospect created',
        created.businessName,
        `${created.businessName} ${created.city} ${created.decisionMaker}`,
      )

      await salesApi.createActivity({
        opportunity_id: created.id,
        company_id: companyId,
        contact_id: primaryContactId,
        activity_type: 'prospect_created',
        subject: 'Prospect created',
        body: created.businessName,
      })

      setState((s) => ({
        ...s,
        prospects: [created, ...s.prospects],
        timeline: [event, ...s.timeline],
      }))
      markSynced()
      void refreshDashboard()
      return created
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
  }, [markError, markSynced, refreshDashboard])

  const updateProspect = useCallback((id: string, patch: Partial<Prospect>) => {
    setState((s) => ({
      ...s,
      prospects: s.prospects.map((p) =>
        p.id === id ? { ...p, ...patch, updatedAt: new Date().toISOString() } : p,
      ),
    }))

    if (apiModeRef.current !== 'v2') return

    void (async () => {
      const current = stateRef.current.prospects.find((p) => p.id === id)
      if (!current) return
      const merged = { ...current, ...patch }
      const companyId = merged.companyId || id
      const splits = splitProspectPatch(patch)
      const ops: Promise<{ ok: boolean }>[] = []

      if (Object.keys(splits.company).length) {
        ops.push(salesApi.updateCompany(companyId, splits.company))
      }
      if (Object.keys(splits.contact).length) {
        if (merged.primaryContactId) {
          ops.push(salesApi.updateContact(merged.primaryContactId, splits.contact))
        } else if (merged.decisionMaker?.trim()) {
          const created = await salesApi.createContact(
            contactPayloadFromProspect(companyId, merged, {
              isPrimary: true,
              contactType: 'decision_maker',
            }),
          )
          if (created.ok) {
            setState((s) => ({
              ...s,
              prospects: s.prospects.map((p) =>
                p.id === id ? { ...p, primaryContactId: created.data.id } : p,
              ),
            }))
          } else {
            markError()
          }
        }
      }
      if (Object.keys(splits.assistant).length) {
        if (merged.assistantContactId) {
          ops.push(
            salesApi.updateContact(merged.assistantContactId, splits.assistant),
          )
        } else if (merged.assistantName?.trim()) {
          const created = await salesApi.createContact(
            assistantPayloadFromProspect(companyId, merged),
          )
          if (created.ok) {
            setState((s) => ({
              ...s,
              prospects: s.prospects.map((p) =>
                p.id === id ? { ...p, assistantContactId: created.data.id } : p,
              ),
            }))
          }
        }
      }
      if (Object.keys(splits.opportunity).length) {
        ops.push(salesApi.updateOpportunity(id, splits.opportunity))
      }
      if (patch.servicesNeeded !== undefined) {
        ops.push(
          salesApi.replaceOpportunityServices(id, patch.servicesNeeded),
        )
      }

      const results = await Promise.all(ops)
      if (results.some((r) => !r.ok)) markError()
      else {
        markSynced()
        void refreshDashboard()
      }
    })()
  }, [markError, markSynced, refreshDashboard])

  const deleteProspect = useCallback((id: string) => {
    const current = stateRef.current.prospects.find((p) => p.id === id)
    setState((s) => ({
      ...s,
      prospects: s.prospects.filter((p) => p.id !== id),
      tasks: s.tasks.filter((t) => t.prospectId !== id),
      timeline: s.timeline.filter((e) => e.prospectId !== id),
      sentEmails: s.sentEmails.filter((e) => e.prospectId !== id),
      attachments: s.attachments.filter((a) => a.prospectId !== id),
    }))

    if (apiModeRef.current !== 'v2') return
    void (async () => {
      const companyId = current?.companyId || id
      const results = await Promise.all([
        salesApi.archiveOpportunity(id),
        salesApi.archiveCompany(companyId),
      ])
      if (results.some((r) => !r.ok)) markError()
      else {
        markSynced()
        void refreshDashboard()
      }
    })()
  }, [markError, markSynced, refreshDashboard])

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
            opportunityStageId: PIPELINE_TO_V2[stage].stage_id,
            ...(stage === 'won' || stage === 'lost' ? { nextFollowUpAt: null } : {}),
          }),
          timeline: [event, ...s.timeline],
        }
      })

      if (apiModeRef.current !== 'v2') return
      void (async () => {
        const mapped = PIPELINE_TO_V2[stage]
        const current = stateRef.current.prospects.find((p) => p.id === id)
        const opp = await salesApi.updateOpportunity(id, {
          stage_id: mapped.stage_id,
          lead_status: mapped.lead_status,
          next_follow_up_at:
            stage === 'won' || stage === 'lost' ? null : undefined,
          closed_at:
            stage === 'won' || stage === 'lost'
              ? new Date().toISOString()
              : null,
        })
        await salesApi.createActivity({
          opportunity_id: id,
          company_id: current?.companyId || id,
          activity_type: 'stage_change',
          subject: stageLabel(stage),
          body:
            note ||
            `Moved from ${stageLabel(current?.stage ?? 'not_contacted')} to ${stageLabel(stage)}`,
          metadata: { from: current?.stage ?? null, to: stage },
        })
        if (!opp.ok) markError()
        else {
          markSynced()
          void refreshDashboard()
        }
      })()
    },
    [touchProspect, markError, markSynced, refreshDashboard],
  )

  const moveBoardStage = useCallback(
    (id: string, stageId: string) => {
      const target = stageId as BoardStageId
      const allowed = [
        'prospecting',
        'discovery',
        'site_visit',
        'proposal',
        'negotiation',
        'won',
        'lost',
      ]
      if (!allowed.includes(target)) return

      setState((s) => {
        const prev = s.prospects.find((p) => p.id === id)
        if (!prev) return s
        if (boardStageId(prev) === target) return s
        const mapped = pipelineForBoardMove(prev.stage, target)
        const label =
          target.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
        const event = makeTimeline(
          id,
          'stage_change',
          label,
          `Moved to ${label}`,
          `${prev.businessName} ${target}`,
          { from: boardStageId(prev), to: target },
        )
        return {
          ...s,
          prospects: touchProspect(s.prospects, id, {
            stage: mapped.stage,
            opportunityStageId: target,
            ...(target === 'won' || target === 'lost'
              ? { nextFollowUpAt: null }
              : {}),
          }),
          timeline: [event, ...s.timeline],
        }
      })

      if (apiModeRef.current !== 'v2') return
      void (async () => {
        const current = stateRef.current.prospects.find((p) => p.id === id)
        const mapped = pipelineForBoardMove(
          current?.stage ?? 'not_contacted',
          target,
        )
        const opp = await salesApi.updateOpportunity(id, {
          stage_id: target,
          lead_status: mapped.lead_status,
          next_follow_up_at:
            target === 'won' || target === 'lost' ? null : undefined,
          closed_at:
            target === 'won' || target === 'lost'
              ? new Date().toISOString()
              : null,
        })
        await salesApi.createActivity({
          opportunity_id: id,
          company_id: current?.companyId || id,
          activity_type: 'stage_change',
          subject: `Moved to ${target}`,
          body: `Pipeline stage set to ${target}`,
          metadata: { to: target },
        })
        if (!opp.ok) markError()
        else {
          markSynced()
          void refreshDashboard()
        }
      })()
    },
    [touchProspect, markError, markSynced, refreshDashboard],
  )

  const addTask = useCallback(
    (input: {
      prospectId: string
      title: string
      kind: TaskKind
      dueAt: string
      salesRep?: string
    }) => {
      const prospect = stateRef.current.prospects.find(
        (p) => p.id === input.prospectId,
      )
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

      if (apiModeRef.current === 'v2') {
        void (async () => {
          const created = await salesApi.createTask({
            opportunity_id: input.prospectId,
            company_id: prospect?.companyId || input.prospectId,
            contact_id: prospect?.primaryContactId || null,
            title: input.title,
            task_type: taskTypeToV2(input.kind),
            status: 'open',
            due_at: input.dueAt,
            priority: prospect?.priority || 'medium',
          })
          await salesApi.createActivity({
            opportunity_id: input.prospectId,
            company_id: prospect?.companyId || input.prospectId,
            activity_type: 'task_created',
            subject: 'Task created',
            body: input.title,
          })
          if (!created.ok) {
            markError()
            return
          }
          setState((s) => ({
            ...s,
            tasks: s.tasks.map((t) =>
              t.id === task.id
                ? {
                    ...t,
                    id: created.data.id,
                    done: created.data.status === 'completed',
                    completedAt: created.data.completed_at,
                  }
                : t,
            ),
          }))
          markSynced()
          void refreshDashboard()
        })()
      }

      return task
    },
    [markError, markSynced, refreshDashboard],
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

    if (apiModeRef.current !== 'v2') return
    void (async () => {
      const task = stateRef.current.tasks.find((t) => t.id === taskId)
      const result = await salesApi.updateTask(taskId, { status: 'completed' })
      if (logTimeline && task) {
        await salesApi.createActivity({
          opportunity_id: task.prospectId,
          activity_type: 'task_completed',
          subject: 'Task completed',
          body: task.title,
        })
      }
      if (!result.ok) markError()
      else {
        markSynced()
        void refreshDashboard()
      }
    })()
  }, [markError, markSynced, refreshDashboard])

  const rescheduleTask = useCallback(
    (taskId: string, dueAt: string) => {
      setState((s) => ({
        ...s,
        tasks: s.tasks.map((t) => (t.id === taskId ? { ...t, dueAt } : t)),
      }))
      if (apiModeRef.current !== 'v2') return
      void (async () => {
        const result = await salesApi.updateTask(taskId, { due_at: dueAt })
        if (!result.ok) markError()
        else {
          markSynced()
          void refreshDashboard()
        }
      })()
    },
    [markError, markSynced, refreshDashboard],
  )

  const deleteTask = useCallback((taskId: string) => {
    setState((s) => ({ ...s, tasks: s.tasks.filter((t) => t.id !== taskId) }))
    if (apiModeRef.current !== 'v2') return
    void (async () => {
      const result = await salesApi.updateTask(taskId, { status: 'cancelled' })
      if (!result.ok) markError()
      else markSynced()
    })()
  }, [markError, markSynced])

  const logEvent = useCallback(
    (input: {
      prospectId: string
      type: TimelineEventType
      title: string
      body?: string
      touchContact?: boolean
    }) => {
      const prospect = stateRef.current.prospects.find(
        (p) => p.id === input.prospectId,
      )
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

      if (apiModeRef.current === 'v2') {
        void (async () => {
          const activity = await salesApi.createActivity({
            opportunity_id: input.prospectId,
            company_id: prospect?.companyId || input.prospectId,
            contact_id: prospect?.primaryContactId || null,
            activity_type: input.type,
            subject: input.title,
            body: input.body ?? '',
          })
          if (input.touchContact !== false) {
            await salesApi.updateOpportunity(input.prospectId, {
              last_contact_at: event.createdAt,
            })
          }
          if (!activity.ok) markError()
          else markSynced()
        })()
      }

      return event
    },
    [touchProspect, markError, markSynced],
  )

  const logCall = useCallback(
    (prospectId: string, body = '', voicemail = false) => {
      const existing = stateRef.current.prospects.find((p) => p.id === prospectId)
      if (!existing) return

      let stage: PipelineStage = existing.stage
      if (voicemail && existing.stage === 'not_contacted') {
        stage = 'left_voicemail'
      } else if (
        !voicemail &&
        ['not_contacted', 'email_sent', 'follow_up_due'].includes(existing.stage)
      ) {
        stage = 'called'
      }
      const occurredAt = new Date().toISOString()
      const mapped = PIPELINE_TO_V2[stage]

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
        return {
          ...s,
          timeline: [event, ...s.timeline],
          prospects: touchProspect(s.prospects, prospectId, {
            lastContactAt: occurredAt,
            firstCallAt: prospect.firstCallAt || occurredAt,
            stage,
          }),
        }
      })

      if (apiModeRef.current !== 'v2') return
      void (async () => {
        const prospect = stateRef.current.prospects.find((p) => p.id === prospectId)
        const activity = await salesApi.createActivity({
          opportunity_id: prospectId,
          company_id: prospect?.companyId || prospectId,
          contact_id: prospect?.primaryContactId || null,
          activity_type: voicemail ? 'voicemail' : 'call',
          subject: voicemail ? 'Left Voicemail' : 'Called',
          body,
          direction: 'outbound',
          occurred_at: occurredAt,
        })
        const opp = await salesApi.updateOpportunity(prospectId, {
          last_contact_at: occurredAt,
          first_call_at: existing.firstCallAt || occurredAt,
          stage_id: mapped.stage_id,
          lead_status: mapped.lead_status,
        })
        if (!activity.ok || !opp.ok) markError()
        else {
          markSynced()
          void refreshDashboard()
        }
      })()
    },
    [touchProspect, markError, markSynced, refreshDashboard],
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

    if (apiModeRef.current === 'v2') {
      void salesApi.createActivity({
        opportunity_id: input.prospectId,
        activity_type: 'attachment',
        subject: `Added ${input.kind}`,
        body: input.name,
        metadata: { kind: input.kind, url: input.url, note: input.note },
      })
    }

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
            stateRef.current.templates.find((x) => x.id === t.id)?.createdAt ?? now,
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
    [],
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
      const existing = stateRef.current.prospects.find(
        (p) => p.id === input.prospectId,
      )
      if (!existing) return

      let stage: PipelineStage = existing.stage
      if (existing.stage === 'not_contacted') {
        stage = 'email_sent'
      } else if (existing.stage === 'called' || existing.stage === 'left_voicemail') {
        stage = 'follow_up_due'
      }
      const sentAt = new Date().toISOString()
      const mapped = PIPELINE_TO_V2[stage]

      setState((s) => {
        const prospect = s.prospects.find((p) => p.id === input.prospectId)
        if (!prospect) return s
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
        return {
          ...s,
          sentEmails: [sent, ...s.sentEmails],
          timeline: [event, ...s.timeline],
          prospects: touchProspect(s.prospects, input.prospectId, {
            lastContactAt: sentAt,
            firstEmailAt: prospect.firstEmailAt || sentAt,
            stage,
          }),
        }
      })

      if (apiModeRef.current !== 'v2') return
      void (async () => {
        const prospect = stateRef.current.prospects.find(
          (p) => p.id === input.prospectId,
        )
        const activity = await salesApi.createActivity({
          opportunity_id: input.prospectId,
          company_id: prospect?.companyId || input.prospectId,
          contact_id: prospect?.primaryContactId || null,
          activity_type: 'email_sent',
          subject: input.subject,
          body: input.body,
          direction: 'outbound',
          occurred_at: sentAt,
        })
        const opp = await salesApi.updateOpportunity(input.prospectId, {
          last_contact_at: sentAt,
          first_email_at: existing.firstEmailAt || sentAt,
          stage_id: mapped.stage_id,
          lead_status: mapped.lead_status,
        })
        if (!activity.ok || !opp.ok) markError()
        else {
          markSynced()
          void refreshDashboard()
        }
      })()
    },
    [touchProspect, markError, markSynced, refreshDashboard],
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
          p.state,
          p.decisionMaker,
          p.email,
          p.phone,
          p.propertyNotes,
          p.conversationNotes,
          p.painPoints,
          p.servicesDiscussed,
          p.assistantName,
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

  const resetDemo = useCallback(() => {
    if (apiModeRef.current === 'v2') {
      // Do not wipe normalized cloud data from the demo reset control.
      void loadV2Workspace({
        reference: reference ?? {
          users: [],
          leadSources: [],
          opportunityStages: [],
          services: [],
          tags: [],
        },
        dashboard: dashboard ?? {
          metrics: {
            todaysFollowUps: 0,
            overdueFollowUps: 0,
            newProspectsThisWeek: 0,
            openPipelineJobValue: 0,
            openPipelineAnnualValue: 0,
            wonCount: 0,
            lostCount: 0,
          },
          upcomingTasks: [],
          recentActivities: [],
          largestOpportunities: [],
          newestCompanies: [],
          generatedAt: new Date().toISOString(),
        },
      }).then((workspace) => {
        setState(workspace.state)
        setDashboard(workspace.dashboard)
        setReference(workspace.reference)
        setCloudStatus('synced')
      })
      return
    }
    const next = resetState()
    setState(next)
    if (cloudEnabled.current) {
      void saveStateToCloud(next).then((ok) => setCloudStatus(ok ? 'synced' : 'error'))
    }
  }, [dashboard, reference])

  const value = useMemo(
    () => ({
      state,
      ready,
      cloudStatus,
      apiMode,
      dashboard,
      reference,
      refreshDashboard,
      ensureProspectDetail,
      resetDemo,
      upsertProspect,
      updateProspect,
      deleteProspect,
      setStage,
      moveBoardStage,
      addTask,
      completeTask,
      rescheduleTask,
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
      ready,
      cloudStatus,
      apiMode,
      dashboard,
      reference,
      refreshDashboard,
      ensureProspectDetail,
      resetDemo,
      upsertProspect,
      updateProspect,
      deleteProspect,
      setStage,
      moveBoardStage,
      addTask,
      completeTask,
      rescheduleTask,
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
