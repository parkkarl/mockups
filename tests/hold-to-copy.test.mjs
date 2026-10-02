import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHoldToCopy } from '../src/hold-to-copy.ts'

function setup() {
  let calls = 0, callback
  const hold = createHoldToCopy(() => calls++, cb => { callback = cb; return () => {} })
  return { hold, fire: () => callback(), calls: () => calls }
}
test('paigal hoitud pliiats tekitab ainult ühe koopia', () => {
  const s = setup()
  s.hold.start(1, { x: 100, y: 100 })
  s.hold.move(1, { x: 102, y: 103 })
  s.fire(); s.fire()
  assert.equal(s.calls(), 1)
})
test('liigutamine, vabastamine ja katkestamine tühistavad kopeerimise', () => {
  const s = setup()
  s.hold.start(1, { x: 100, y: 100 })
  s.hold.move(1, { x: 106, y: 100 })
  s.fire()
  assert.equal(s.calls(), 0)
  s.hold.start(1, { x: 100, y: 100 })
  s.hold.cancel(); s.fire()
  assert.equal(s.calls(), 0)
})
test('vana taimer ei kopeeri pärast uue vajutuse algust', () => {
  let count = 0
  const scheduled = []
  const hold = createHoldToCopy(() => count++, cb => { scheduled.push(cb); return () => {} })
  hold.start(1, { x: 0, y: 0 })
  hold.start(2, { x: 10, y: 10 })
  scheduled[0]()
  assert.equal(count, 0)
  scheduled[1]()
  assert.equal(count, 1)
})
