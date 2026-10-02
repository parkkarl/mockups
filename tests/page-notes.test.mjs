import { test } from 'node:test'
import assert from 'node:assert/strict'
import { withPageNotes } from '../src/page-notes.ts'

test('lehe märkmed salvestuvad ainult selle lehe juurde ja mahuvad projektifaili', () => {
  const pages = [
    { id: 'one', title: 'Üks', parentId: null, strokes: [] },
    { id: 'two', title: 'Kaks', parentId: null, notes: 'Varem', strokes: [] },
  ]
  const result = withPageNotes(pages, 'one', 'Kirjuta\nsiia')
  assert.equal(result[0].notes, 'Kirjuta\nsiia')
  assert.equal(JSON.parse(JSON.stringify(result))[0].notes, 'Kirjuta\nsiia')
  assert.strictEqual(result[1], pages[1])
  assert.equal(pages[0].notes, undefined)
  assert.equal(withPageNotes(result, 'one', 'a'.repeat(10001))[0].notes.length, 10000)
})
