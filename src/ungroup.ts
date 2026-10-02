import type { Stroke } from './canvas'
import { isStrokeLocked } from './locking.ts'

export function ungroupableIds(strokes: Stroke[], selectedIds: string[]): Set<string> {
  const selected = new Set(selectedIds)
  const groups = new Set(strokes.filter(s => selected.has(s.id) && s.groupId && !isStrokeLocked(s, strokes)).map(s => s.groupId))
  return new Set(strokes.filter(s => s.groupId && groups.has(s.groupId)).map(s => s.id))
}

export function ungroupSelected(strokes: Stroke[], selectedIds: string[]): Stroke[] {
  const ids = ungroupableIds(strokes, selectedIds)
  return strokes.map(stroke => {
    if (!ids.has(stroke.id)) return stroke
    const separate = { ...stroke }
    delete separate.groupId
    return separate
  })
}
