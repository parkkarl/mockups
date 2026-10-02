import { test } from 'node:test'
import assert from 'node:assert/strict'
import { allowsTextEditing, penTipContact, stylusEraser, stylusSelect } from '../src/pen-input.ts'
test('pika vajutuse jaoks peab pliiatsiots puudutama ekraani, hõljumine ei loe', () => {
  assert.equal(penTipContact({ pointerType: 'pen', pressure: 0, buttons: 2 }), false)
  assert.equal(penTipContact({ pointerType: 'pen', pressure: .3, buttons: 2 }), true)
  assert.equal(penTipContact({ pointerType: 'pen', pressure: 0, buttons: 3 }), true)
  assert.equal(penTipContact({ pointerType: 'mouse', pressure: .5, buttons: 1 }), false)
})
test('tekstiredaktor avaneb ainult hiirega, mitte pliiatsi ega puute topeltklõpsuga', () => {
  assert.equal(allowsTextEditing('mouse'), true)
  assert.equal(allowsTextEditing('mouse', 'mouse'), true)
  assert.equal(allowsTextEditing('pen'), false, 'ka MouseEvent-iks teisendatud pliiatsiklõps')
  assert.equal(allowsTextEditing('pen', 'mouse'), false)
  assert.equal(allowsTextEditing('mouse', 'pen'), false)
  assert.equal(allowsTextEditing('touch'), false)
  assert.equal(allowsTextEditing(''), false)
})
test('pliiatsi paremklõps valib ajutiselt, kustutamissignaal kustutab', () => {
  for (const [button, buttons] of [[2, 2], [-1, 3], [-1, 2]]) {
    assert.equal(stylusSelect({ pointerType: 'pen', button, buttons }), true)
    assert.equal(stylusEraser({ pointerType: 'pen', button, buttons }), false)
  }
  assert.equal(stylusSelect({ pointerType: 'pen', button: -1, buttons: 1 }), false)
  assert.equal(stylusSelect({ pointerType: 'mouse', button: 2, buttons: 2 }), false)
  assert.equal(stylusSelect({ pointerType: 'pen', button: 5, buttons: 32 }), false)
  for (const [button, buttons] of [[5, 32], [-1, 33]])
    assert.equal(stylusEraser({ pointerType: 'pen', button, buttons }), true)
  assert.equal(stylusEraser({ pointerType: 'pen', button: 0, buttons: 1 }), false)
  assert.equal(stylusEraser({ pointerType: 'mouse', button: 2, buttons: 2 }), false)
  assert.equal(stylusEraser({ pointerType: 'touch', button: 0, buttons: 1 }), false)
})
