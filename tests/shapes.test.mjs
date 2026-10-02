import { test } from 'node:test'
import assert from 'node:assert/strict'
import { recognizeAttachedRectangle, recognizeShape, straightenStroke } from '../src/shapes.ts'
const pt = (x, y) => ({ x, y, pressure: 1 })
function polygon(corners, count = 25, jitter = 0) {
  return corners.flatMap((a, i) => {
    const b = corners[(i + 1) % corners.length]
    return Array.from({ length: count }, (_, j) => {
      const t = j / count, noise = jitter * Math.sin(j * 1.7 + i * 3)
      return pt(a[0] + (b[0] - a[0]) * t + noise, a[1] + (b[1] - a[1]) * t - noise)
    })
  }).concat(pt(...corners[0]))
}
test('käsitsi joonistatud ristkülik silutakse', () => {
  const shape = recognizeShape(polygon([[100, 100], [300, 100], [300, 220], [100, 220]], 35, 2))
  assert.equal(shape?.tool, 'rectangle')
  assert.equal(shape?.points.length, 2)
})
test('ellips silutakse', () => {
  const points = Array.from({ length: 101 }, (_, i) => {
    const a = i / 100 * Math.PI * 2
    return pt(300 + 105 * Math.cos(a) + Math.sin(a * 9), 220 + 62 * Math.sin(a) + Math.cos(a * 7))
  })
  assert.equal(recognizeShape(points)?.tool, 'ellipse')
})
test('avatud sirge silutakse', () => {
  const points = Array.from({ length: 50 }, (_, i) => pt(60 + i * 5, 40 + i * 2 + Math.sin(i) * 2))
  assert.equal(recognizeShape(points)?.tool, 'line')
})
test('kolmnurk silutakse', () => {
  const shape = recognizeShape(polygon([[100, 100], [270, 105], [170, 250]], 30, 1.5))
  assert.equal(shape?.tool, 'triangle')
  assert.equal(shape?.points.length, 3)
})
test('foto moodi L-tõmme täiendab sisemise ruudu puuduvaid külgi', () => {
  const outer = { tool: 'rectangle', points: [pt(38, 52), pt(124, 157)] }
  const path = polygon([[87, 45], [86, 101], [43, 111]], 25, 1).slice(0, 50).concat(pt(43, 111))
  assert.equal(recognizeShape(path), null)
  const shape = recognizeAttachedRectangle(path, [outer])
  assert.equal(shape?.tool, 'rectangle')
  assert.deepEqual(shape?.points.map(({ x, y }) => [x, y]), [[38, 52], [87, 111]])
  assert.equal(recognizeAttachedRectangle(path, []), null)
})
test('järgmine L ühendab kahe eri ristküliku servad (pildi näide)', () => {
  const outer = { tool: 'rectangle', points: [pt(347.33, 161.33), pt(466, 278)] }
  const upper = { tool: 'rectangle', points: [pt(466, 161.33), pt(422.67, 210.67)] }
  const path = [
    ...Array.from({ length: 30 }, (_, i) => pt(425.33 + Math.sin(i) * .5, 210 + i * 37 / 29)),
    ...Array.from({ length: 34 }, (_, i) => pt(425.33 + i * 40.67 / 33, 247 - i * 2 / 33)),
  ]
  assert.equal(recognizeShape(path), null)
  const shape = recognizeAttachedRectangle(path, [outer, upper])
  assert.equal(shape?.tool, 'rectangle')
  assert.deepEqual(shape?.points.map(({ x, y }) => [x, y]), [[466, 210.67], [425.33, 245]])
  assert.equal(recognizeAttachedRectangle(path, [upper]), null)
  assert.equal(recognizeAttachedRectangle(path, [outer]), null)
})
test('Automaatkujud sirgendab ka lühikese ja kõvera avatud kriipsu', () => {
  const curved = [pt(10, 15), pt(18, 28), pt(28, 32), pt(45, 21)]
  assert.equal(recognizeShape(curved), null)
  assert.deepEqual(straightenStroke(curved), { tool: 'line', points: [pt(10, 15), pt(45, 21)] })
  assert.deepEqual(straightenStroke([pt(3, 3), pt(10, 8)]), { tool: 'line', points: [pt(3, 3), pt(10, 8)] })
  assert.equal(straightenStroke([pt(5, 5)]), null)
  assert.equal(straightenStroke([pt(5, 5), pt(50, 5), pt(50, 50), pt(7, 7)]), null)
})
test('U-tõmme kasutab olemasolevat ülemist serva', () => {
  const outer = { tool: 'rectangle', points: [pt(40, 50), pt(250, 250)] }
  const path = [pt(80, 53), ...Array.from({ length: 10 }, (_, i) => pt(80, 60 + i * 8)),
    ...Array.from({ length: 10 }, (_, i) => pt(90 + i * 10, 140)),
    ...Array.from({ length: 10 }, (_, i) => pt(180, 130 - i * 8)), pt(180, 53)]
  assert.equal(recognizeAttachedRectangle(path, [outer])?.tool, 'rectangle')
})
test('lähedane kritseldus ei muutu kinnitatud kujundiks', () => {
  const outer = { tool: 'rectangle', points: [pt(38, 52), pt(124, 157)] }
  const path = [pt(87, 53), pt(100, 85), pt(60, 70), pt(90, 120), pt(43, 111)]
  assert.equal(recognizeAttachedRectangle(path, [outer]), null)
})
test('väike joon, laine ja kritseldus jäävad muutmata', () => {
  assert.equal(recognizeShape(Array.from({ length: 20 }, (_, i) => pt(i, i))), null)
  assert.equal(recognizeShape(Array.from({ length: 70 }, (_, i) => pt(i * 4, 100 + 35 * Math.sin(i * .3)))), null)
  assert.equal(recognizeShape(Array.from({ length: 150 }, (_, i) => pt(200 + i * .6 * Math.cos(i * .2), 150 + i * .5 * Math.sin(i * .2)))), null)
})
