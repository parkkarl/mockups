import { test } from 'node:test'
import assert from 'node:assert/strict'
import { validImageSource, imageStroke, prepareImages, cachedImage } from '../src/images.ts'
import { parseAgentEdit, applyAgentEdit } from '../src/agent-commands.ts'
import { boundsOf } from '../src/selection.ts'
import { resizeSelected, selectionBounds } from '../src/resize.ts'
import { clonePage } from '../src/page-copy.ts'

const source = 'data:image/png;base64,aGVsbG8='
test('piltide käsukanal lubab ainult kohalikke rasterandmeid ja korrektseid asukohti', () => {
  assert.equal(validImageSource(source), true)
  assert.equal(validImageSource('https://example.com/image.png'), false)
  assert.equal(validImageSource('data:image/svg+xml;base64,aGVsbG8='), false)
  const request = { pageId: 'page', action: 'import-image', path: 'C:\\Users\\parkk\\Desktop\\goldstock.png', x: -100, y: 50, width: 1440 }
  assert.deepEqual(parseAgentEdit(JSON.stringify(request)), request)
  for (const extra of [{ path: '' }, { width: -1 }, { x: '100' }, { y: null }])
    assert.throws(() => parseAgentEdit(JSON.stringify({ ...request, ...extra })), /import-image/)
})
test('imporditud pilt säilib projektis, kopeerimisel ja proportsionaalsel venitamisel', async () => {
  const previous = globalThis.Image
  globalThis.Image = class {
    naturalWidth = 1440; naturalHeight = 900
    set src(value) { queueMicrotask(() => this.onload()) }
  }
  try {
    const image = await imageStroke(source, 10, 20, 720)
    assert.deepEqual(boundsOf(image), { left: 10, top: 20, right: 730, bottom: 470 })
    const added = applyAgentEdit([], { pageId: 'page', action: 'add', strokes: [image] })
    await prepareImages(added)
    assert.ok(cachedImage(source))
    assert.equal(JSON.parse(JSON.stringify(added))[0].imageSource, source)
    const copy = clonePage({ id: 'page', title: 'Pilt', parentId: null, strokes: added })
    assert.equal(copy.strokes[0].imageSource, source)
    assert.notEqual(copy.strokes[0].id, image.id)
    const stretched = resizeSelected(added, [image.id], 'se', selectionBounds(added, [image.id]), 720, 450)
    assert.equal(boundsOf(stretched[0]).right, 1450)
    assert.equal(stretched[0].imageSource, source)
    assert.throws(() => applyAgentEdit([], { pageId: 'page', action: 'add', strokes: [{ ...image, imageSource: 'https://example.com/a.png' }] }), /korrektset/)
  } finally { globalThis.Image = previous }
})
