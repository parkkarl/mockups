import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createTemplate } from '../src/templates.ts'
import { ungroupableIds, ungroupSelected } from '../src/ungroup.ts'
import { deleteSelectedUnlocked } from '../src/locking.ts'

test('sisselogimisvormi eraldamisel saab ühe välja või teksti kustutada', () => {
  const login = createTemplate('login', 20, 30, '#fff')
  const other = createTemplate('card', 100, 400, '#fff')
  const all = [...login, ...other]
  const groups = ungroupableIds(all, [login[1].id])
  assert.equal(groups.size, login.length)
  const separate = ungroupSelected(all, [login[1].id])
  assert.ok(separate.slice(0, login.length).every(s => !s.groupId))
  assert.deepEqual(separate.slice(login.length), other)
  const removed = deleteSelectedUnlocked(separate, [login[1].id])
  assert.equal(removed.length, all.length - 1)
  assert.ok(removed.some(s => s.id === login[0].id))
  assert.equal(login[0].groupId, login[1].groupId, 'algset vormi ei muudetud')
})
test('lukus vormi ei saa lahti võtta enne luku avamist', () => {
  const login = createTemplate('login', 0, 0, '#fff')
  const locked = login.map((s, i) => i === 0 ? { ...s, locked: true } : s)
  assert.equal(ungroupableIds(locked, [locked[1].id]).size, 0)
  assert.deepEqual(ungroupSelected(locked, [locked[1].id]), locked)
})
