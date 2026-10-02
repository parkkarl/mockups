import type { Stroke } from './canvas'

// Valimine võib tabada kujundi sisemust; kustutamine peab tabama nähtavat piirjoont.
export function touchesRectangleOutline(stroke: Stroke, point: { x: number; y: number }, tolerance: number): boolean {
  if (stroke.points.length < 2 || stroke.size <= 0) return false
  const a = stroke.points[0], b = stroke.points[stroke.points.length - 1]
  const left = Math.min(a.x, b.x), right = Math.max(a.x, b.x)
  const top = Math.min(a.y, b.y), bottom = Math.max(a.y, b.y)
  const radius = Math.min(stroke.radius ?? 0, (right - left) / 2, (bottom - top) / 2)
  // Ümardatud ristküliku märgiga kaugus: null on piirjoon, negatiivne on sisemus.
  const qx = Math.abs(point.x - (left + right) / 2) - (right - left) / 2 + radius
  const qy = Math.abs(point.y - (top + bottom) / 2) - (bottom - top) / 2 + radius
  const distance = Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - radius
  return Math.abs(distance) <= tolerance + stroke.size / 2
}
