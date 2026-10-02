import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isFullscreenShortcut } from '../src/fullscreen.ts'
const key = (overrides = {}) => ({ key: 'F11', repeat: false, ctrlKey: false, metaKey: false, altKey: false, shiftKey: false, ...overrides })
test('F11 lülitab täisekraani üks kord vajutuse kohta ka terminali fookuses', () => {
  assert.equal(isFullscreenShortcut(key()), true)
  assert.equal(isFullscreenShortcut(key({ repeat: true })), false)
  for (const modifier of ['ctrlKey', 'metaKey', 'altKey', 'shiftKey'])
    assert.equal(isFullscreenShortcut(key({ [modifier]: true })), false)
  assert.equal(isFullscreenShortcut(key({ key: 'F10' })), false)
})
