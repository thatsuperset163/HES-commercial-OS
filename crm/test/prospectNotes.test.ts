import assert from 'node:assert/strict'
import test from 'node:test'
import { readProspectNotes, writeProspectNotes } from '../src/lib/prospectNotes.ts'

test('merges legacy split note fields into one blob', () => {
  const text = readProspectNotes({
    conversationNotes: 'Spoke with Pat',
    propertyNotes: 'Staining on north wall',
    painPoints: '',
    servicesDiscussed: 'Spoke with Pat',
  })
  assert.equal(text, 'Spoke with Pat\n\nStaining on north wall')
})

test('writeProspectNotes clears split fields', () => {
  const patch = writeProspectNotes('One place for everything')
  assert.equal(patch.conversationNotes, 'One place for everything')
  assert.equal(patch.propertyNotes, '')
  assert.equal(patch.painPoints, '')
  assert.equal(patch.servicesDiscussed, '')
})
