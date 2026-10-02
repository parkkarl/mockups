import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createTemplate } from '../src/templates.ts'
import { clearUnlocked, deleteSelectedUnlocked, isStrokeLocked, lockTargets, toggleSelectionLock, translateSelectedUnlocked } from '../src/locking.ts'
import { withinSelection } from '../src/selection.ts'
const pt = (x, y) => ({ x, y, pressure: 1 })
const line = { id: 'other', tool: 'line', color: '#fff', size: 2, points: [pt(100, 200), pt(180, 220)] }
test('lukustamine laieneb kogu mallile ning jääb JSON-is alles', () => {
  const template = createTemplate('page', 80, 70, '#66e2b8')
  const all = [...template, line]
  const selected = [template[1].id]
  assert.equal(lockTargets(all, selected).length, template.length)
  const locked = toggleSelectionLock(all, selected)
  assert.ok(locked.slice(0, -1).every(s => s.locked))
  assert.ok(!locked.at(-1).locked)
  assert.ok(isStrokeLocked(locked[0], locked))
  assert.ok(JSON.parse(JSON.stringify(locked))[0].locked)
  assert.deepEqual(deleteSelectedUnlocked(locked, locked.map(s => s.id)), locked.slice(0, -1))
  assert.deepEqual(clearUnlocked(locked), locked.slice(0, -1))
  const moved = translateSelectedUnlocked(locked, locked.map(s => s.id), 30, 40)
  assert.deepEqual(moved.slice(0, -1), locked.slice(0, -1), 'lukus mall ei liigu')
  assert.equal(moved.at(-1).points[0].x, line.points[0].x + 30)
  assert.ok(toggleSelectionLock(locked, selected).slice(0, -1).every(s => !s.locked))
})
test('osaliselt lukustatud grupi ülejäänud osad ei ole kustutatavad', () => {
  const group = createTemplate('search', 0, 0, '#fff')
  const partly = group.map((s, i) => i ? s : { ...s, locked: true })
  assert.ok(partly.every(s => isStrokeLocked(s, partly)))
  assert.deepEqual(clearUnlocked(partly), partly)
})
test('läbipaistva raami sisemusest tehtud valik ei kaasa raami', () => {
  const page = createTemplate('page', 20, 30, '#fff')
  const outer = page.at(-1)
  assert.equal(withinSelection(outer, pt(150, 200), pt(200, 250)), false)
  assert.equal(withinSelection(outer, pt(15, 20), pt(40, 50)), true)
})
