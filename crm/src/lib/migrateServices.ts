import type { ServiceType, SalesState } from '../types'
import { SERVICES } from '../types'

const VALID = new Set(SERVICES.map((s) => s.id))

/** Map legacy service IDs → current three-service catalog. */
const LEGACY_SERVICE_MAP: Record<string, ServiceType> = {
  pressure_washing: 'pressure_washing',
  window_cleaning: 'window_cleaning',
  junk_removal: 'junk_removal',
  soft_washing: 'pressure_washing',
  gutter_cleaning: 'pressure_washing',
  exterior_maintenance: 'junk_removal',
}

/** Original demo seed prospect IDs — always strip so fake CRM data stays gone. */
const DEMO_PROSPECT_IDS = new Set([
  'p1',
  'p2',
  'p3',
  'p4',
  'p5',
  'p6',
  'p7',
  'p8',
])

export function migrateService(id: string): ServiceType | null {
  if (VALID.has(id as ServiceType)) return id as ServiceType
  return LEGACY_SERVICE_MAP[id] ?? null
}

export function migrateServicesNeeded(services: string[] | undefined): ServiceType[] {
  const next: ServiceType[] = []
  for (const raw of services ?? []) {
    const mapped = migrateService(String(raw))
    if (mapped && !next.includes(mapped)) next.push(mapped)
  }
  return next.length > 0 ? next : ['pressure_washing']
}

function stripDemoRecords(state: SalesState): SalesState {
  const prospects = state.prospects.filter((p) => !DEMO_PROSPECT_IDS.has(p.id))
  const keepIds = new Set(prospects.map((p) => p.id))
  return {
    ...state,
    prospects,
    tasks: (state.tasks ?? []).filter((t) => keepIds.has(t.prospectId)),
    timeline: (state.timeline ?? []).filter((e) => keepIds.has(e.prospectId)),
    sentEmails: (state.sentEmails ?? []).filter((e) =>
      keepIds.has(e.prospectId),
    ),
    attachments: (state.attachments ?? []).filter((a) =>
      keepIds.has(a.prospectId),
    ),
  }
}

/** Normalize persisted state so old service IDs never break the UI. */
export function migrateState(state: SalesState): SalesState {
  const stripped = stripDemoRecords(state)
  return {
    ...stripped,
    prospects: stripped.prospects.map((p) => ({
      ...p,
      servicesNeeded: migrateServicesNeeded(
        p.servicesNeeded as unknown as string[],
      ),
    })),
  }
}
