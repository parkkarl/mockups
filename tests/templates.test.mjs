import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createTemplate, templateOptions } from '../src/templates.ts'
import { boundsOf } from '../src/selection.ts'

test('kõik valmiskujundid on eraldi grupeeritud ja lõuendi piires', () => {
  for (const option of templateOptions) {
    const strokes = createTemplate(option.id, 100, 90, '#66e2b8', new Date(2026, 8, 1))
    assert.ok(strokes.length >= 2, option.id)
    assert.equal(new Set(strokes.map(s => s.id)).size, strokes.length)
    assert.equal(new Set(strokes.map(s => s.groupId)).size, 1)
    for (const stroke of strokes) {
      const box = boundsOf(stroke)
      assert.ok(box.left >= 100 && box.top >= 90, option.id)
      assert.ok(box.right <= 100 + option.width + 10 && box.bottom <= 90 + option.height + 10, option.id)
    }
  }
  assert.notEqual(createTemplate('card', 0, 0, '#fff')[0].groupId, createTemplate('card', 0, 0, '#fff')[0].groupId)
})
test('lehekülje alus vastab tühja brauseriakna maketile', () => {
  const page = createTemplate('page', 20, 30, '#66e2b8')
  assert.ok(page.every(s => !s.fill), 'mall ei tohi ühtegi täidet lisada')
  assert.ok(page.some(s => s.tool === 'rectangle' && s.radius === 9 && s.outlineOnly))
  assert.ok(page.some(s => s.tool === 'rectangle' && s.radius === 17 && s.outlineOnly))
  assert.ok(page.some(s => s.tool === 'text' && s.text === 'Moqups'))
  assert.ok(page.some(s => s.tool === 'text' && s.text === 'www.moqups.com'))
  assert.equal(page.at(-1).color, '#111111')
  assert.equal(page.at(-1).tool, 'rectangle')
  assert.ok(!page.some(s => s.text === 'Lehe pealkiri'))
})
test('otsing, profiil ja valikukast vastavad näidatud makettidele', () => {
  const search = createTemplate('search', 0, 0, '#66e2b8')
  assert.ok(search.some(s => s.tool === 'rectangle' && s.radius === 26 && !s.fill && s.outlineOnly))
  assert.ok(search.some(s => s.tool === 'text' && s.text === 'Search'))
  assert.ok(search.some(s => s.tool === 'ellipse' && !s.fill))
  const avatar = createTemplate('avatar', 0, 0, '#66e2b8')
  assert.equal(avatar.filter(s => s.tool === 'ellipse').length, 3)
  const select = createTemplate('select', 0, 0, '#66e2b8')
  assert.ok(select.some(s => s.tool === 'text' && s.text === 'Select'))
  assert.ok(select.some(s => s.tool === 'line' && s.points.length === 3 && !s.fill))
})
test('kõik kaheksa komponenti on läbipaistvad teemaga kohanduvad wireframe-kujundid', () => {
  for (const kind of ['search', 'avatar', 'select', 'button', 'input', 'checkbox', 'toggle', 'navbar']) {
    const strokes = createTemplate(kind, 0, 0, '#ef6a76')
    assert.ok(strokes.every(s => !s.fill && s.size > 0 && s.color === '#111111'), kind)
    assert.ok(strokes.filter(s => ['rectangle', 'ellipse'].includes(s.tool)).every(s => s.outlineOnly), kind)
  }
})
test('kalendri kuupäevad on kuu pikkuse ja nädalapäevaga kooskõlas', () => {
  const calendar = createTemplate('calendar', 0, 0, '#fff', new Date(2026, 1, 1)) // veebruar 2026: 28 päeva
  const dates = calendar.filter(s => s.tool === 'text' && /^\d+$/.test(s.text ?? ''))
  assert.equal(dates.length, 28)
  assert.equal(dates[0].text, '1')
  assert.equal(dates[0].points[0].x, 13 + 6 * 80) // 1. veebruar on pühapäev
  assert.equal(dates.at(-1).text, '28')
})
