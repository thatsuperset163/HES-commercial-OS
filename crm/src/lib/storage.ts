import type { SalesState } from '../types'
import { SEED } from '../data/seed'
import { migrateState } from './migrateServices'

const STORAGE_KEY = 'hes-sales-os-v1'

export function loadState(): SalesState {
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

export function saveState(state: SalesState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(migrateState(state)))
}

export function resetState(): SalesState {
  const next = structuredClone(SEED)
  saveState(next)
  return next
}
