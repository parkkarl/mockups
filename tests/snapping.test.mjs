import { test } from 'node:test'
import assert from 'node:assert/strict'
import { snapStroke } from '../src/snapping.ts'
const p = (x, y) => ({ x, y, pressure: 1 })
const shape = (tool, a, b) => ({ tool, points: [p(...a), p(...b)], id: 'fresh' })
const square = shape('rectangle', [100, 100], [300, 300])
test('naaberristkülik liitub küljega ning joondab ülanurga', () => {
  const adjacent = shape('rectangle', [312, 108], [490, 301])
  const snapped = snapStroke(adjacent, [square])
  assert.deepEqual(snapped.points.map(({ x, y }) => [x, y]), [[300, 100], [490, 300]])
  assert.equal(adjacent.points[0].x, 312, 'sisend jääb muutmata')
})
test('sisemine ristkülik haakub olemasoleva ülemise ja vasaku servaga', () => {
  const outer = shape('rectangle', [38, 52], [124, 157])
  const inner = shape('rectangle', [87, 45], [43, 111])
  assert.deepEqual(snapStroke(inner, [outer]).points.map(({ x, y }) => [x, y]), [[87, 52], [38, 111]])
  const centered = shape('rectangle', [70, 78], [94, 125])
  assert.deepEqual(snapStroke(centered, [outer]), centered)
})
test('pööratud joonistussuunaga ristkülik liitub vasaku küljega', () => {
  const snapped = snapStroke(shape('rectangle', [103, 300], [-50, 100]), [square])
  assert.equal(snapped.points[0].x, 100)
})
test('lähestikused, kuid mitte kattuvad servad ei tõmba külge', () => {
  const far = shape('rectangle', [321, 100], [450, 300])
  const above = shape('rectangle', [304, -150], [440, -20])
  assert.deepEqual(snapStroke(far, [square]), far)
  assert.deepEqual(snapStroke(above, [square]), above)
})
test('läbi ristküliku tõmmatud joone mõlemad otsad haakuvad piirile', () => {
  const line = shape('line', [108, 200], [291, 200])
  assert.deepEqual(snapStroke(line, [square]).points.map(({ x, y }) => [x, y]), [[100, 200], [300, 200]])
  const outside = shape('line', [88, 200], [312, 200])
  assert.deepEqual(snapStroke(outside, [square]).points.map(({ x, y }) => [x, y]), [[100, 200], [300, 200]])
})
test('diagonaalne joon ja üks lähedane ots snapivad', () => {
  const diagonal = shape('line', [108, 108], [290, 290])
  assert.deepEqual(snapStroke(diagonal, [square]).points.map(({ x, y }) => [x, y]), [[100, 100], [300, 300]])
  const oneEnd = shape('line', [115, 200], [230, 200])
  assert.deepEqual(snapStroke(oneEnd, [square]).points.map(({ x, y }) => [x, y]), [[100, 200], [230, 200]])
})
test('kauge, paralleelne ja vabakäejoon jäävad muutmata', () => {
  for (const s of [shape('line', [70, 200], [330, 200]), shape('line', [100, 100], [300, 100]),
    shape('line', [330, 200], [430, 200]), shape('pen', [108, 200], [291, 200])]) {
    assert.deepEqual(snapStroke(s, [square]), s)
  }
})
