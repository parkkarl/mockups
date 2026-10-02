import { test } from 'node:test'
import assert from 'node:assert/strict'
import { TOOL_KEYS, TOGGLE_KEYS, toolForShortcut, toggleForShortcut } from '../src/tool-shortcuts.ts'

const event = (key, overrides = {}) => ({ key, ctrlKey: false, metaKey: false, altKey: false, ...overrides })

test('esimesed neli tööriista valitakse klahvidega 1–4', () => {
  for (const [key, tool] of [['1', 'select'], ['2', 'pen'], ['3', 'highlighter'], ['4', 'eraser']]) {
    assert.equal(TOOL_KEYS[tool], key)
    assert.equal(toolForShortcut(event(key)), tool)
  }
  assert.equal(toolForShortcut(event('5')), null)
  assert.equal(toolForShortcut(event('h')), null, 'eemaldatud käetööriistal pole enam kiirklahvi')
  assert.equal(toolForShortcut(event('2', { ctrlKey: true })), null)
  assert.equal(toolForShortcut(event('3', { altKey: true })), null)
  assert.equal(toolForShortcut(event('4', { metaKey: true })), null)
  assert.equal(toolForShortcut(event('p')), 'pen', 'teised vanad tähtklahvid jäävad tööle')
})

test('Q, W ja E lülitavad vastavad kolm seadet; E ei vali kustukummi', () => {
  for (const [key, toggle] of [['q', 'automaticShapes'], ['w', 'autoSnap'], ['e', 'penOnly']]) {
    assert.equal(TOGGLE_KEYS[toggle].toLowerCase(), key)
    assert.equal(toggleForShortcut(event(key)), toggle)
    assert.equal(toggleForShortcut(event(key.toUpperCase())), toggle)
    assert.equal(toggleForShortcut(event(key, { ctrlKey: true })), null)
    assert.equal(toggleForShortcut(event(key, { metaKey: true })), null)
    assert.equal(toggleForShortcut(event(key, { altKey: true })), null)
  }
  assert.equal(toolForShortcut(event('e')), null)
  assert.equal(toolForShortcut(event('4')), 'eraser')
})
