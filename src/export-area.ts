import type { Stroke } from './canvas'
import { boundsOf } from './selection.ts'

// Pildifail hõlmab kõiki jooni, kuid väga suurel lõuendil vähendatakse üksnes PNG eraldusvõimet.
export function exportArea(strokes: Stroke[]): { x: number; y: number; width: number; height: number; scale: number } {
  let left = 0, top = 0, right = 1520, bottom = 920
  for (const stroke of strokes) {
    const bounds = boundsOf(stroke)
    if (!bounds) continue
    left = Math.min(left, bounds.left); top = Math.min(top, bounds.top)
    right = Math.max(right, bounds.right); bottom = Math.max(bottom, bounds.bottom)
  }
  const x = left < 0 ? Math.floor((left - 80) / 40) * 40 : 0
  const y = top < 0 ? Math.floor((top - 80) / 40) * 40 : 0
  const width = Math.max(1600, Math.ceil((right - x + 80) / 40) * 40)
  const height = Math.max(1000, Math.ceil((bottom - y + 80) / 40) * 40)
  const scale = Math.min(1, 8192 / width, 8192 / height, Math.sqrt(16_000_000 / (width * height)))
  return { x, y, width, height, scale }
}
