import type { Stroke } from './canvas'
export function snapshotSelection(strokes: Stroke[], ids: string[]): Stroke[] {
  const selected = new Set(ids)
  return strokes.filter(s => selected.has(s.id)).map(s => ({ ...s, points: s.points.map(point => ({ ...point })) }))
}

export function cloneStrokes(strokes: Stroke[], dx = 24, dy = 24): Stroke[] {
  const groups = new Map<string, string>()
  const cloneGroup = (id: string) => {
    if (!groups.has(id)) groups.set(id, crypto.randomUUID())
    return groups.get(id)!
  }
  return strokes.map(stroke => ({
    ...stroke,
    id: crypto.randomUUID(),
    ...(stroke.groupId ? { groupId: cloneGroup(stroke.groupId) } : {}),
    points: stroke.points.map(point => ({ ...point, x: point.x + dx, y: point.y + dy })),
  }))
}
