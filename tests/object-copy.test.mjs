import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createTemplate } from '../src/templates.ts'
import { cloneStrokes, snapshotSelection } from '../src/object-copy.ts'

test('joonistatud grupp kopeeritakse tervikuna uute ID-de ja sõltumatute punktidega', () => {
  const group = createTemplate('search', 100, 150, '#fff')
  const other = createTemplate('button', 20, 30, '#fff')
  const selected = snapshotSelection([...group, ...other], group.map(s => s.id))
  assert.equal(selected.length, group.length)
  assert.deepEqual(snapshotSelection([...group, ...other], [group[1].id]).map(s => s.id), [group[1].id], 'vormi sees valitud üksikut elementi saab üksi kopeerida')
  const copy = cloneStrokes(selected)
  assert.ok(copy.every((s, i) => s.id !== selected[i].id))
  assert.ok(copy.every(s => s.groupId === copy[0].groupId && s.groupId !== group[0].groupId))
  assert.equal(copy[0].points[0].x, group[0].points[0].x + 24)
  assert.equal(copy[0].points[0].y, group[0].points[0].y + 24)
  copy[0].points[0].x = 999
  assert.equal(group[0].points[0].x, 100)
  assert.equal(selected[0].points[0].x, 100)
})
test('lukud, tekst ja üksikjoon säilivad ning iga kleepimine teeb uued ID-d', () => {
  const line = { id: 'original', tool: 'line', color: '#fff', size: 3,
    points: [{ x: 4, y: 8, pressure: .5 }, { x: 25, y: 40, pressure: 1 }], locked: true }
  const snapshot = snapshotSelection([line], [line.id])
  const first = cloneStrokes(snapshot, 48, 48)
  const second = cloneStrokes(snapshot, 72, 72)
  assert.notEqual(first[0].id, second[0].id)
  assert.equal(first[0].locked, true)
  assert.equal(first[0].points[0].pressure, .5)
  assert.equal(second[0].points[0].x, 76)
  assert.deepEqual(snapshotSelection([line], []), [])
})
