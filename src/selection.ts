import type { Stroke, Point } from './canvas'

export type Bounds = { left: number; top: number; right: number; bottom: number }
export function boundsOf(stroke: Stroke): Bounds | null {
  if (!stroke.points.length) return null
  if (stroke.tool === 'text') {
    const { x, y } = stroke.points[0]
    const lines = (stroke.text ?? '').split('\n')
    const font = stroke.size || 20
    return { left: x, top: y, right: x + Math.max(12, ...lines.map(line => line.length * font * .62)), bottom: y + Math.max(1, lines.length) * font * 1.35 }
  }
  const xs = stroke.points.map(p => p.x), ys = stroke.points.map(p => p.y)
  return { left: Math.min(...xs), top: Math.min(...ys), right: Math.max(...xs), bottom: Math.max(...ys) }
}
// Esimene klõps valib grupi. Järgmine klõps valitud grupis avab ühe elemendi;
// lohistamisel jääb seni valitud grupp alles, et seda saaks endiselt tervikuna liigutada.
export function selectionForClick(strokes: Stroke[], found: Stroke, selectedIds: string[], shift = false, alt = false): { ids: string[]; drillId: string | null } {
  const group = found.groupId ? strokes.filter(s => s.groupId === found.groupId).map(s => s.id) : [found.id]
  const active = group.some(id => selectedIds.includes(id))
  if (found.groupId && group.length > 1 && !shift && !alt && group.length === selectedIds.length && group.every(id => selectedIds.includes(id)))
    return { ids: selectedIds, drillId: found.id }
  // Juba valitud objekti lohistamine säilitab kogu mitmikvaliku.
  if (!shift && !alt && selectedIds.length > 1 && selectedIds.includes(found.id))
    return { ids: selectedIds, drillId: null }
  const members = found.groupId && !alt && (shift || !active) ? group : [found.id]
  const allSelected = members.every(id => selectedIds.includes(id))
  return { ids: shift ? (allSelected ? selectedIds.filter(id => !members.includes(id)) : [...new Set([...selectedIds, ...members])]) : members,
    drillId: null }
}
export function withinSelection(stroke: Stroke, a: Point, b: Point) {
  const box = boundsOf(stroke)
  if (!box) return false
  const left = Math.min(a.x, b.x), right = Math.max(a.x, b.x)
  const top = Math.min(a.y, b.y), bottom = Math.max(a.y, b.y)
  if (box.right < left || box.left > right || box.bottom < top || box.top > bottom) return false
  // Läbipaistva raami sees lohistatud valik ei haara suurt brauserialust kaasa.
  if (stroke.outlineOnly && stroke.tool === 'rectangle' &&
    left > box.left && right < box.right && top > box.top && bottom < box.bottom) return false
  return true
}
