import type { Stroke } from './canvas'

// Kui kasvõi üks malli osa on lukus, käsitleme kogu grupeeritud objekti lukustatuna.
export function isStrokeLocked(stroke: Stroke, all: Stroke[]): boolean {
  return stroke.locked === true || Boolean(stroke.groupId && all.some(item => item.groupId === stroke.groupId && item.locked))
}
export function lockTargets(all: Stroke[], ids: string[]): Stroke[] {
  const selected = new Set(ids)
  const groups = new Set(all.filter(item => selected.has(item.id) && item.groupId).map(item => item.groupId))
  return all.filter(item => selected.has(item.id) || (item.groupId && groups.has(item.groupId)))
}
export function toggleSelectionLock(all: Stroke[], ids: string[]): Stroke[] {
  const targets = new Set(lockTargets(all, ids).map(item => item.id))
  if (!targets.size) return all
  const lock = all.some(item => targets.has(item.id) && !item.locked)
  return all.map(item => targets.has(item.id) ? { ...item, locked: lock } : item)
}
export function deleteSelectedUnlocked(all: Stroke[], ids: string[]): Stroke[] {
  const selected = new Set(ids)
  return all.filter(item => !selected.has(item.id) || isStrokeLocked(item, all))
}
export function clearUnlocked(all: Stroke[]): Stroke[] {
  return all.filter(item => isStrokeLocked(item, all))
}
export function translateSelectedUnlocked(all: Stroke[], ids: string[], dx: number, dy: number): Stroke[] {
  const selected = new Set(ids)
  return all.map(item => selected.has(item.id) && !isStrokeLocked(item, all)
    ? { ...item, points: item.points.map(point => ({ ...point, x: point.x + dx, y: point.y + dy })) }
    : item)
}
