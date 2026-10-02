import type { Page } from './PageTree'

export function clonePage(source: Page): Page {
  const groupIds = new Map<string, string>()
  const copyGroupId = (id: string) => {
    if (!groupIds.has(id)) groupIds.set(id, crypto.randomUUID())
    return groupIds.get(id)!
  }
  return {
    id: crypto.randomUUID(),
    title: `${source.title.slice(0, 71)} (koopia)`,
    parentId: source.id,
    ...(source.notes !== undefined ? { notes: source.notes } : {}),
    strokes: source.strokes.map(stroke => ({
      ...stroke,
      id: crypto.randomUUID(),
      points: stroke.points.map(point => ({ ...point })),
      ...(stroke.groupId ? { groupId: copyGroupId(stroke.groupId) } : {}),
    })),
  }
}

export function insertCopyBelow(pages: Page[], sourceId: string, copy: Page): Page[] {
  const index = pages.findIndex(page => page.id === sourceId)
  if (index < 0) return pages
  return [...pages.slice(0, index + 1), copy, ...pages.slice(index + 1)]
}
