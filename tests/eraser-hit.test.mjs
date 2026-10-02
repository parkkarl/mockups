import { test } from 'node:test'
import assert from 'node:assert/strict'
import { touchesRectangleOutline } from '../src/eraser-hit.ts'

const rectangle = { tool: 'rectangle', size: 2, points: [{ x: 100, y: 100 }, { x: 400, y: 400 }] }
test('ruudu sisemuses kustutamine ei taba raami, serval kustutamine tabab', () => {
  assert.equal(touchesRectangleOutline(rectangle, { x: 200, y: 200 }, 16), false)
  for (const point of [{ x: 100, y: 220 }, { x: 400, y: 220 }, { x: 220, y: 100 }, { x: 220, y: 400 }])
    assert.equal(touchesRectangleOutline(rectangle, point, 16), true)
  assert.equal(touchesRectangleOutline(rectangle, { x: 80, y: 80 }, 16), false)
  assert.equal(touchesRectangleOutline({ ...rectangle, points: [...rectangle.points].reverse() }, { x: 200, y: 200 }, 16), false)
})
test('ümardatud nurk arvestab tegelikku piirjoont ja joone paksust', () => {
  const rounded = { ...rectangle, radius: 50 }
  assert.equal(touchesRectangleOutline(rounded, { x: 100, y: 100 }, 2), false)
  assert.equal(touchesRectangleOutline(rounded, { x: 150, y: 100 }, 2), true)
  assert.equal(touchesRectangleOutline({ ...rectangle, size: 20 }, { x: 108, y: 200 }, 1), true)
})
