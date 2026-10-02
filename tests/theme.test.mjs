import { test } from 'node:test'
import assert from 'node:assert/strict'
import { displayColor, INK } from '../src/theme.ts'

test('must põhivärv kuvatakse heledal musta ja tumedal valgena', () => {
  for (const color of [INK, '#000000', '#66e2b8', '#f5f7f0', '#1e70eb']) {
    assert.equal(displayColor(color, 'light'), INK)
    assert.equal(displayColor(color, 'dark'), '#f5f5f5')
  }
})
test('muud värvid säilivad teema vahetamisel; malli tekst on loetav', () => {
  assert.equal(displayColor('#ef6a76', 'dark'), '#ef6a76')
  assert.equal(displayColor('#ffffff', 'light'), '#ffffff')
  assert.equal(displayColor('#e8f3ee', 'light'), INK)
  assert.equal(displayColor('#e8f3ee', 'dark'), '#f5f5f5')
})
