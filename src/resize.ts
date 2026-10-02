import type { Stroke } from './canvas'
import { boundsOf } from './selection.ts'
import type { Bounds } from './selection'
import { INK } from './theme.ts'

export type ResizeHandle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w'
export const handles: ResizeHandle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']
export function selectionBounds(strokes: Stroke[], ids: string[]): Bounds | null {
  const chosen = new Set(ids)
  const boxes = strokes.filter(s => chosen.has(s.id)).map(boundsOf).filter((b): b is Bounds => b !== null)
  if (!boxes.length) return null
  return { left: Math.min(...boxes.map(b => b.left)), top: Math.min(...boxes.map(b => b.top)),
    right: Math.max(...boxes.map(b => b.right)), bottom: Math.max(...boxes.map(b => b.bottom)) }
}
export function handlePoint(b: Bounds, handle: ResizeHandle): { x: number; y: number } {
  return { x: handle.includes('w') ? b.left : handle.includes('e') ? b.right : (b.left + b.right) / 2,
    y: handle.includes('n') ? b.top : handle.includes('s') ? b.bottom : (b.top + b.bottom) / 2 }
}
export function resizeSelected(strokes: Stroke[], ids: string[], handle: ResizeHandle, bounds: Bounds, dx: number, dy: number): Stroke[] {
  const chosen = new Set(ids)
  const group = strokes.filter(s => chosen.has(s.id))
  const browserFrame = group.find(s => s.tool === 'rectangle' && s.groupId && (s.color === '#1e70eb' || (s.outlineOnly && s.color === INK && group.some(member => member.groupId === s.groupId && member.tool === 'text' && member.text === 'www.moqups.com'))) && s.points.length >= 2)
  const browserBottom = Boolean(browserFrame && group.every(s => s.groupId === browserFrame.groupId) && handle.includes('s'))
  const left = handle.includes('w') ? Math.min(bounds.right - 24, bounds.left + dx) : bounds.left
  const right = handle.includes('e') ? Math.max(bounds.left + 24, bounds.right + dx) : bounds.right
  const top = handle.includes('n') ? Math.min(bounds.bottom - 24, bounds.top + dy) : bounds.top
  const bottom = handle.includes('s') ? Math.max(bounds.top + (browserBottom ? 120 : 24), bounds.bottom + dy) : bounds.bottom
  const sx = (right - left) / Math.max(1, bounds.right - bounds.left)
  const sy = (bottom - top) / Math.max(1, bounds.bottom - bounds.top)
  return strokes.map(s => {
    if (!chosen.has(s.id)) return s
    const points = s.points.map((p, i) => ({ ...p,
      x: left + (p.x - bounds.left) * sx,
      y: browserBottom ? (s === browserFrame && i === s.points.length - 1 ? bottom : p.y) : top + (p.y - bounds.top) * sy }))
    // Brauseri lehe kõrguse muutmine pikendab ainult välisraami, mitte vahelehte ega aadressiriba.
    const fontScale = !browserBottom && handle.length === 2 ? Math.sqrt(sx * sy) : 1
    return { ...s, points, ...(s.tool === 'text' ? { size: Math.max(8, s.size * fontScale) } : {}),
      ...(s.radius && fontScale !== 1 ? { radius: Math.max(1, s.radius * fontScale) } : {}) }
  })
}
