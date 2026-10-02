import { test } from 'node:test'
import assert from 'node:assert/strict'
import { terminalClipboardAction, terminalPasteText } from '../src/terminal-shortcuts.ts'
test('pildi kleepimine lisab failitee; tavaline tekst säilib muutmata', () => {
  assert.equal(terminalPasteText('C:\\project\\attachments\\clipboard.png', null), 'C:\\project\\attachments\\clipboard.png')
  assert.equal(terminalPasteText('C:/My project/image.png', 'other text'), '"C:/My project/image.png"')
  assert.equal(terminalPasteText(null, 'Loe seda\nsiis vasta'), 'Loe seda\nsiis vasta')
  assert.equal(terminalPasteText(null, null), '')
})
const key = (value, extra = {}) => ({ key: value, ctrlKey: false, metaKey: false, shiftKey: false, altKey: false, ...extra })

test('terminali teksti kleepimine toetab Ctrl+V, Ctrl+Shift+V ja Shift+Insert', () => {
  assert.equal(terminalClipboardAction(key('v', { ctrlKey: true }), false), 'paste')
  assert.equal(terminalClipboardAction(key('V', { ctrlKey: true, shiftKey: true }), false), 'paste')
  assert.equal(terminalClipboardAction(key('Insert', { shiftKey: true }), false), 'paste')
  assert.equal(terminalClipboardAction(key('v', { metaKey: true }), false), 'paste')
  assert.equal(terminalClipboardAction(key('v'), false), null)
})
test('Ctrl+C kopeerib valiku, kuid valikuta katkestab terminalis jooksva käsu', () => {
  assert.equal(terminalClipboardAction(key('c', { ctrlKey: true }), true), 'copy')
  assert.equal(terminalClipboardAction(key('c', { ctrlKey: true }), false), null)
  assert.equal(terminalClipboardAction(key('v', { ctrlKey: true, altKey: true }), false), null)
})
