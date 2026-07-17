import type { SalesState } from '../types'
import { SEED } from '../data/seed'
import { migrateState } from './migrateServices'

const STORAGE_KEY = 'hes-sales-os-v1'

function localLoad(): SalesState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as SalesState
      return migrateState(parsed)
    }
  } catch {
    /* ignore corrupt */
  }
  return structuredClone(SEED)
}

function localSave(state: SalesState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(migrateState(state)))
}

/** Always keep a browser backup so offline / local still works. */
export function loadState(): SalesState {
  return localLoad()
}

export function saveState(state: SalesState) {
  localSave(state)
}

export function resetState(): SalesState {
  const next = structuredClone(SEED)
  localSave(next)
  return next
}

export type CloudLoadResult =
  | { ok: true; state: SalesState | null; updatedAt: string | null }
  | { ok: false; reason: string }

/** Load Sales OS state from HQ API → Supabase. */
export async function loadStateFromCloud(): Promise<CloudLoadResult> {
  try {
    const res = await fetch('/api/sales/state', {
      method: 'GET',
      credentials: 'same-origin',
      headers: { Accept: 'application/json' },
    })

    if (res.status === 503) {
      return { ok: false, reason: 'supabase_not_configured' }
    }

    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      return {
        ok: false,
        reason: String(body.message || body.reason || `http_${res.status}`),
      }
    }

    const body = (await res.json()) as {
      ok: boolean
      state?: SalesState | null
      updatedAt?: string | null
    }

    if (!body.ok) return { ok: false, reason: 'load_failed' }

    if (!body.state) return { ok: true, state: null, updatedAt: null }

    return {
      ok: true,
      state: migrateState(body.state),
      updatedAt: body.updatedAt ?? null,
    }
  } catch {
    return { ok: false, reason: 'network_error' }
  }
}

/** Persist Sales OS state to HQ API → Supabase (and local backup). */
export async function saveStateToCloud(state: SalesState): Promise<boolean> {
  const migrated = migrateState(state)
  localSave(migrated)

  try {
    const res = await fetch('/api/sales/state', {
      method: 'PUT',
      credentials: 'same-origin',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(migrated),
    })

    if (res.status === 503) return false
    return res.ok
  } catch {
    return false
  }
}

/**
 * In Sales v2 mode, CRM entities live in normalized tables.
 * Legacy blob still stores templates / sent emails / attachments.
 * Never send empty prospects — that used to wipe commercial_prospects.
 */
export function extractLegacyAuxState(state: SalesState): SalesState {
  return migrateState({
    schemaVersion: state.schemaVersion,
    prospects: [],
    tasks: [],
    timeline: [],
    templates: state.templates,
    sentEmails: state.sentEmails,
    attachments: state.attachments,
  })
}

export async function saveLegacyAuxToCloud(state: SalesState): Promise<boolean> {
  try {
    const res = await fetch('/api/sales/state', {
      method: 'PUT',
      credentials: 'same-origin',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        mode: 'aux',
        schemaVersion: state.schemaVersion,
        templates: state.templates,
        sentEmails: state.sentEmails,
        attachments: state.attachments,
      }),
    })
    if (res.status === 503) return false
    return res.ok
  } catch {
    return false
  }
}
