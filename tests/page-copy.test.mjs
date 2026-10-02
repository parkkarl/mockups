import { test } from 'node:test'
import assert from 'node:assert/strict'
import { clonePage, insertCopyBelow } from '../src/page-copy.ts'
import { createTemplate } from '../src/templates.ts'

test('kopeeritud leht sisaldab sõltumatut joonistust koos gruppide ja lukkudega', () => {
  const strokes = createTemplate('page', 25, 30, '#66e2b8').map(s => ({ ...s, locked: true }))
  const original = { id: 'first', title: 'Avaleht', parentId: 'folder', notes: 'Tee menüü\nLisa otsing', strokes }
  const copy = clonePage(original)
  assert.equal(copy.title, 'Avaleht (koopia)')
  assert.equal(copy.parentId, original.id)
  assert.equal(copy.notes, original.notes)
  assert.equal(JSON.parse(JSON.stringify(copy)).notes, original.notes)
  assert.notEqual(copy.id, original.id)
  assert.equal(copy.strokes.length, strokes.length)
  assert.ok(copy.strokes.every(s => s.locked && s.groupId === copy.strokes[0].groupId))
  assert.notEqual(copy.strokes[0].groupId, strokes[0].groupId)
  assert.ok(copy.strokes.every((s, i) => s.id !== strokes[i].id))
  copy.strokes[0].points[0].x = 999
  assert.equal(strokes[0].points[0].x, 25)
})
test('koopia lisatakse originaallehe alamleheks ning vana leht jääb muutmata', () => {
  const parent = { id: 'one', title: 'Esimene', parentId: null, strokes: [] }
  const child = { id: 'child', title: 'Alamleht', parentId: 'one', strokes: [] }
  const next = { id: 'two', title: 'Teine', parentId: null, strokes: [] }
  const pages = [parent, child, next]
  const copy = clonePage(parent)
  assert.deepEqual(insertCopyBelow(pages, parent.id, copy), [parent, copy, child, next])
  assert.equal(copy.parentId, parent.id)
  assert.equal(clonePage(child).parentId, child.id, 'alamlehe koopia saab selle lehe lapseks')
  assert.deepEqual(pages, [parent, child, next])
})
