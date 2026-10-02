import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isFingerPointer, panBy, pinchViewport, screenToWorld, worldToScreen, zoomAt } from '../src/viewport.ts'
import { exportArea } from '../src/export-area.ts'

const close = (a, b) => assert.ok(Math.abs(a - b) < 0.00001, `${a} ≠ ${b}`)

test('suum säilitab kursori all oleva maailmapunkti ning lubab liikumist negatiivsele lõuendile', () => {
  const start = { x: -230, y: 117, zoom: 1 }
  const anchor = { x: 246, y: 182 }
  const target = screenToWorld(start, anchor)
  const result = zoomAt(start, 2, anchor)
  close(screenToWorld(result, anchor).x, target.x)
  close(screenToWorld(result, anchor).y, target.y)
  close(worldToScreen(result, target).x, anchor.x)
  close(panBy(start, 100, 40).x, -330)
  assert.equal(zoomAt(start, 100, anchor).zoom, 8)
  assert.equal(zoomAt(start, 0, anchor).zoom, .15)
})

test('kahe sõrme näpistus suumib ja liigutab keskpunkti; pliiats ei käivita žesti', () => {
  assert.equal(isFingerPointer('touch'), true)
  assert.equal(isFingerPointer('pen'), false)
  assert.equal(isFingerPointer('mouse'), false)
  const start = { x: 0, y: 0, zoom: 1 }
  const next = pinchViewport(start, [{ x: 100, y: 200 }, { x: 200, y: 200 }], [{ x: 110, y: 200 }, { x: 310, y: 200 }])
  close(next.zoom, 2)
  close(screenToWorld(next, { x: 210, y: 200 }).x, 150)
})

test('lõpmatu lõuendi PNG hõlmab ka negatiivseid ja 8000st suuremaid koordinaate', () => {
  const page = [{ tool: 'line', size: 3, points: [{ x: -500, y: -210, pressure: 1 }, { x: 10000, y: 25000, pressure: 1 }] }]
  const area = exportArea(page)
  assert.ok(area.x < -500 && area.y < -210)
  assert.ok(area.x + area.width > 10000 && area.y + area.height > 25000)
  assert.ok(area.width * area.scale <= 8192 && area.height * area.scale <= 8192)
  assert.ok(area.width * area.height * area.scale ** 2 <= 16_000_001)
})
