import type { Prospect } from '../types.ts'

/** Single notes blob for UI — merges legacy split fields when present. */
export function readProspectNotes(p: Pick<
  Prospect,
  'conversationNotes' | 'propertyNotes' | 'painPoints' | 'servicesDiscussed'
>): string {
  const parts = [
    p.conversationNotes,
    p.propertyNotes,
    p.painPoints,
    p.servicesDiscussed,
  ]
    .map((s) => s.trim())
    .filter(Boolean)
  const unique: string[] = []
  for (const part of parts) {
    if (!unique.includes(part)) unique.push(part)
  }
  return unique.join('\n\n')
}

/** Persist one notes field; clear the old split columns so they don't reappear. */
export function writeProspectNotes(value: string): Pick<
  Prospect,
  'conversationNotes' | 'propertyNotes' | 'painPoints' | 'servicesDiscussed'
> {
  return {
    conversationNotes: value,
    propertyNotes: '',
    painPoints: '',
    servicesDiscussed: '',
  }
}
