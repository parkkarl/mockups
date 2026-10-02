import { test } from 'node:test'
import assert from 'node:assert/strict'
import { boundsOf, selectionForClick, withinSelection } from '../src/selection.ts'
import { deleteSelectedUnlocked, translateSelectedUnlocked } from '../src/locking.ts'
const pt = (x, y) => ({ x, y, pressure: 1 })
const rectangle = (id, x1, y1, x2, y2) => ({ id, tool: 'rectangle', points: [pt(x1, y1), pt(x2, y2)], color: '#fff', size: 4 })
test('lohistatud valik hõlmab ainult alas puudutatud jooniseid', () => {
  const first = rectangle('login', 100, 100, 200, 200)
  const second = rectangle('home', 230, 120, 300, 180)
  const far = rectangle('far', 600, 600, 700, 700)
  const selected = [first, second, far].filter(s => withinSelection(s, pt(170, 90), pt(250, 210))).map(s => s.id)
  assert.deepEqual(selected, ['login', 'home'])
  assert.deepEqual(boundsOf(rectangle('reverse', 200, 200, 100, 100)), boundsOf(first))
})
test('esimene klõps valib vormi, järgmine sama vormi üksiku osa', () => {
  const group = [
    { id: 'border', groupId: 'login', tool: 'rectangle', points: [], size: 2, color: '#fff' },
    { id: 'field', groupId: 'login', tool: 'rectangle', points: [], size: 2, color: '#fff' },
    { id: 'label', groupId: 'login', tool: 'text', text: 'Parool', points: [], size: 16, color: '#fff' },
  ]
  const first = selectionForClick(group, group[1], [])
  assert.deepEqual(first.ids, ['border', 'field', 'label'])
  assert.equal(first.drillId, null)
  const second = selectionForClick(group, group[2], first.ids)
  assert.deepEqual(second.ids, first.ids, 'lohistamine saab endiselt tervet vormi liigutada')
  assert.equal(second.drillId, 'label')
  assert.deepEqual(deleteSelectedUnlocked(group, [second.drillId]).map(s => s.id), ['border', 'field'], 'üksiku osa kustutamine jätab vormi alles')
  assert.deepEqual(selectionForClick(group, group[1], ['label']).ids, ['field'])
  assert.deepEqual(selectionForClick(group, group[1], [], false, true).ids, ['field'])
})
test('mitme objekti lohistamine säilitab valiku ja liigutab kõiki valitud objekte', () => {
  const first = rectangle('first', 100, 100, 200, 200)
  const second = rectangle('second', 230, 120, 300, 180)
  const far = rectangle('far', 600, 600, 700, 700)
  const all = [first, second, far]
  const selection = selectionForClick(all, first, ['first', 'second'])
  assert.deepEqual(selection, { ids: ['first', 'second'], drillId: null })
  const moved = translateSelectedUnlocked(all, selection.ids, 50, 30)
  assert.equal(moved[0].points[0].x, 150)
  assert.equal(moved[1].points[0].x, 280)
  assert.strictEqual(moved[2], far)
  assert.deepEqual(selectionForClick(all, first, selection.ids, true).ids, ['second'])
  assert.deepEqual(selectionForClick(all, first, selection.ids, false, true).ids, ['first'])
})
test('mitme grupi valik ei kitsene grupi elemendiks', () => {
  const a = { ...rectangle('a', 0, 0, 100, 100), groupId: 'group' }
  const b = { ...rectangle('b', 10, 10, 30, 30), groupId: 'group' }
  const other = rectangle('other', 200, 0, 300, 100)
  assert.deepEqual(selectionForClick([a, b, other], b, ['a', 'b', 'other']), { ids: ['a', 'b', 'other'], drillId: null })
})
test('tekst on valitav koos kujunditega', () => {
  const text = { id: 'text', tool: 'text', text: 'Sisselogimine\nAvaleht', points: [pt(320, 120)], color: '#fff', size: 20 }
  assert.equal(withinSelection(text, pt(310, 110), pt(430, 180)), true)
  assert.equal(withinSelection(text, pt(480, 240), pt(500, 300)), false)
  assert.equal(boundsOf(text).top, 120)
})
