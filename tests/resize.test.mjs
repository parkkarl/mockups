import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createTemplate } from '../src/templates.ts'
import { handlePoint, resizeSelected, selectionBounds } from '../src/resize.ts'
import { exportArea } from '../src/export-area.ts'

test('brauserialuse alumine serv pikeneb ülaosa venitamata ja lõuend muutub keritavaks', () => {
  const page = createTemplate('page', 100, 120, '#66e2b8')
  const ids = page.map(s => s.id)
  const box = selectionBounds(page, ids)
  const next = resizeSelected(page, ids, 's', box, 0, 2300)
  const frame = next.find(s => s.outlineOnly && s.tool === 'rectangle' && s.color === '#111111')
  assert.equal(frame.points[0].y, 120)
  assert.equal(frame.points[1].y, 120 + 600 + 2300)
  for (const stroke of page.filter(s => s.id !== frame.id))
    assert.deepEqual(next.find(s => s.id === stroke.id).points, stroke.points)
  assert.ok(exportArea(next).height > 3000)
  assert.equal(exportArea(page).height, 1000)
})
test('vana sinise raamiga brauserialust saab endiselt pikendada', () => {
  const page = createTemplate('page', 100, 120, '#111111').map(s => s.color === '#111111' && s.tool === 'rectangle' ? { ...s, color: '#1e70eb' } : s)
  const next = resizeSelected(page, page.map(s => s.id), 's', selectionBounds(page, page.map(s => s.id)), 0, 500)
  assert.equal(next.find(s => s.color === '#1e70eb').points[1].y, 1220)
})
test('nurgast skaleerimine muudab mõlemat mõõdet, küljest ainult üht', () => {
  const strokes = createTemplate('search', 50, 80, '#fff')
  const ids = strokes.map(s => s.id)
  const box = selectionBounds(strokes, ids)
  const corner = resizeSelected(strokes, ids, 'se', box, 150, 52)
  assert.equal(selectionBounds(corner, ids).right - box.left, 450)
  assert.equal(selectionBounds(corner, ids).bottom - box.top, 104)
  const side = resizeSelected(strokes, ids, 's', box, 0, 70)
  assert.equal(selectionBounds(side, ids).right, box.right)
  assert.equal(selectionBounds(side, ids).bottom, box.bottom + 70)
  assert.deepEqual(handlePoint(box, 's'), { x: 200, y: 132 })
})
test('muutmata objekt jääb paigale ja raami mõõdud ei lähe miinusesse', () => {
  const page = createTemplate('page', 100, 120, '#fff')
  const other = createTemplate('button', 200, 200, '#fff')
  const ids = page.map(s => s.id)
  const next = resizeSelected([...page, ...other], ids, 's', selectionBounds(page, ids), 0, -9999)
  assert.deepEqual(next.slice(page.length), other)
  assert.ok(selectionBounds(next, ids).bottom - selectionBounds(next, ids).top >= 120)
})
