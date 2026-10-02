import { test } from 'node:test'
import assert from 'node:assert/strict'
import { applyAgentEdit, parseAgentEdit } from '../src/agent-commands.ts'
import { createTemplate } from '../src/templates.ts'
const pt = (x, y) => ({ x, y, pressure: 1 })
const box = { id: 'new-rectangle', tool: 'rectangle', color: '#66e2b8', size: 3, points: [pt(50, 70), pt(400, 500)] }
const pageId = 'aabb-1234'
test('Claude saab aktiivsele lehele lisada, muuta ja eemaldada objekti', () => {
  const added = applyAgentEdit([], parseAgentEdit(JSON.stringify({ pageId, action: 'add', strokes: [box] })))
  assert.deepEqual(added, [box])
  const changed = { ...box, points: [pt(80, 90), pt(450, 520)] }
  assert.deepEqual(applyAgentEdit(added, { pageId, action: 'replace', strokes: [changed] }), [changed])
  assert.deepEqual(applyAgentEdit([changed], { pageId, action: 'delete', ids: [box.id] }), [])
  assert.equal(parseAgentEdit('\uFEFF{"pageId":"aabb-1234","action":"delete","ids":["x"]}').action, 'delete')
})
test('vigased ja lukustatud muudatused lükatakse tagasi ilma algseid objekte muutmata', () => {
  const locked = createTemplate('search', 0, 0, '#fff').map((s, i) => i === 0 ? { ...s, locked: true } : s)
  assert.throws(() => applyAgentEdit(locked, { pageId, action: 'delete', ids: [locked[1].id] }), /Lukustatud/)
  assert.throws(() => applyAgentEdit(locked, { pageId, action: 'replace', strokes: [{ ...locked[1], color: '#facb70' }] }), /Lukustatud/)
  assert.deepEqual(applyAgentEdit([], { pageId, action: 'add', strokes: [{ ...box, points: [pt(-10000, 30), pt(400, 9000)] }] })[0].points[0], pt(-10000, 30))
  assert.throws(() => applyAgentEdit([], { pageId, action: 'add', strokes: [{ ...box, points: [pt(-10000001, 30), pt(400, 500)] }] }), /korrektset/)
  assert.throws(() => applyAgentEdit([box], { pageId, action: 'add', strokes: [box] }), /juba kasutusel/)
  assert.throws(() => parseAgentEdit('{"action":"add"}'), /Vigane/)
  assert.equal(locked[1].color, '#111111')
})
