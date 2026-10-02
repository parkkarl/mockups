import type { ShapePoint } from './shapes'

// Geomeetriline haakumine töötab nii otse joonistatud kui automaatselt tuvastatud kujunditega.
type SnapStroke = { tool: string; points: ShapePoint[] }
const RANGE = 18
const LINE_RANGE = 26
const range = (a: number, b: number) => [Math.min(a, b), Math.max(a, b)] as const
const overlap = (a: number, b: number, c: number, d: number) => Math.min(b, d) - Math.max(a, c)
const rect = (s: SnapStroke) => {
  if (s.tool !== 'rectangle' || s.points.length < 2) return null
  const [left, right] = range(s.points[0].x, s.points[s.points.length - 1].x)
  const [top, bottom] = range(s.points[0].y, s.points[s.points.length - 1].y)
  return { left, right, top, bottom }
}
type Rect = NonNullable<ReturnType<typeof rect>>

function snapRectangle<T extends SnapStroke>(stroke: T, others: Rect[]): T {
  const bounds = rect(stroke)
  if (!bounds || bounds.right - bounds.left < 20 || bounds.bottom - bounds.top < 20) return stroke
  let { left, right, top, bottom } = bounds
  let nearestX = RANGE + 1, nearestY = RANGE + 1
  let xNeighbor: Rect | null = null, yNeighbor: Rect | null = null
  for (const other of others) {
    const yOverlap = overlap(top, bottom, other.top, other.bottom)
    const xOverlap = overlap(left, right, other.left, other.right)
    if (yOverlap >= Math.max(12, Math.min(bottom - top, other.bottom - other.top) * .2)) {
      // Ainult teise kujundi VÄLISKÜLGE: ei hüppa juhuslikult sisemistele servadele.
      const gapLeft = Math.abs(left - other.right)
      if (right > other.right + 12 && gapLeft < nearestX) { nearestX = gapLeft; xNeighbor = other; left = other.right }
      const gapRight = Math.abs(right - other.left)
      if (left < other.left - 12 && gapRight < nearestX) { nearestX = gapRight; xNeighbor = other; right = other.left }
    }
    if (xOverlap >= Math.max(12, Math.min(right - left, other.right - other.left) * .2)) {
      const gapTop = Math.abs(top - other.bottom)
      if (bottom > other.bottom + 12 && gapTop < nearestY) { nearestY = gapTop; yNeighbor = other; top = other.bottom }
      const gapBottom = Math.abs(bottom - other.top)
      if (top < other.top - 12 && gapBottom < nearestY) { nearestY = gapBottom; yNeighbor = other; bottom = other.top }
    }
    // Ka olemasoleva kujundi SEES võivad küljed teadlikult sama serva jagada.
    const inside = left >= other.left - RANGE && right <= other.right + RANGE &&
      top >= other.top - RANGE && bottom <= other.bottom + RANGE &&
      right - left < other.right - other.left - 12 && bottom - top < other.bottom - other.top - 12
    if (inside) {
      for (const [edge, target, apply] of [
        [left, other.left, (n: number) => { left = n; xNeighbor = other }],
        [right, other.right, (n: number) => { right = n; xNeighbor = other }],
      ] as const) {
        const gap = Math.abs(edge - target)
        if (gap < nearestX && gap <= RANGE) { nearestX = gap; apply(target) }
      }
      for (const [edge, target, apply] of [
        [top, other.top, (n: number) => { top = n; yNeighbor = other }],
        [bottom, other.bottom, (n: number) => { bottom = n; yNeighbor = other }],
      ] as const) {
        const gap = Math.abs(edge - target)
        if (gap < nearestY && gap <= RANGE) { nearestY = gap; apply(target) }
      }
    }
  }
  // Kui küljed puutuvad, joondame ka peaaegu kokkulangevad nurgad.
  if (xNeighbor) {
    if (Math.abs(top - xNeighbor.top) <= RANGE && xNeighbor.top < bottom - 20) top = xNeighbor.top
    if (Math.abs(bottom - xNeighbor.bottom) <= RANGE && xNeighbor.bottom > top + 20) bottom = xNeighbor.bottom
  }
  if (yNeighbor) {
    if (Math.abs(left - yNeighbor.left) <= RANGE && yNeighbor.left < right - 20) left = yNeighbor.left
    if (Math.abs(right - yNeighbor.right) <= RANGE && yNeighbor.right > left + 20) right = yNeighbor.right
  }
  if (left >= right - 8 || top >= bottom - 8) return stroke
  const [a, b] = stroke.points
  const points = [{ ...a, x: a.x <= b.x ? left : right, y: a.y <= b.y ? top : bottom },
    { ...b, x: a.x <= b.x ? right : left, y: a.y <= b.y ? bottom : top }]
  return { ...stroke, points }
}

function intersections(a: ShapePoint, b: ShapePoint, r: Rect) {
  const dx = b.x - a.x, dy = b.y - a.y
  const hits: { t: number; x: number; y: number }[] = []
  if (Math.abs(dx) > 1e-6) for (const x of [r.left, r.right]) {
    const t = (x - a.x) / dx, y = a.y + t * dy
    if (y >= r.top - 1e-6 && y <= r.bottom + 1e-6) hits.push({ t, x, y })
  }
  if (Math.abs(dy) > 1e-6) for (const y of [r.top, r.bottom]) {
    const t = (y - a.y) / dy, x = a.x + t * dx
    if (x >= r.left - 1e-6 && x <= r.right + 1e-6) hits.push({ t, x, y })
  }
  hits.sort((p, q) => p.t - q.t)
  const unique = hits.filter((hit, i) => !i || Math.abs(hit.t - hits[i - 1].t) > 1e-5)
  if (unique.length < 2) return []
  const mid = (unique[0].t + unique[unique.length - 1].t) / 2
  const x = a.x + mid * dx, y = a.y + mid * dy
  // Puutujat või joont piki serva ei tohi pidada läbivaks jooneks.
  if (x <= r.left + 1e-5 || x >= r.right - 1e-5 || y <= r.top + 1e-5 || y >= r.bottom - 1e-5) return []
  return unique.filter(hit => hit.t >= -LINE_RANGE / Math.hypot(dx, dy) && hit.t <= 1 + LINE_RANGE / Math.hypot(dx, dy))
}

function snapLine<T extends SnapStroke>(stroke: T, others: Rect[]): T {
  if (stroke.points.length !== 2) return stroke
  const [a, b] = stroke.points
  if (Math.hypot(b.x - a.x, b.y - a.y) < 25) return stroke
  let start = a, end = b, startDist = LINE_RANGE + 1, endDist = LINE_RANGE + 1
  for (const other of others) {
    for (const hit of intersections(a, b, other)) {
      const da = Math.hypot(hit.x - a.x, hit.y - a.y), db = Math.hypot(hit.x - b.x, hit.y - b.y)
      if (da < startDist) { startDist = da; start = { ...a, x: hit.x, y: hit.y } }
      if (db < endDist) { endDist = db; end = { ...b, x: hit.x, y: hit.y } }
    }
  }
  if (Math.hypot(end.x - start.x, end.y - start.y) < 15) return stroke
  return { ...stroke, points: [start, end] }
}

export function snapStroke<T extends SnapStroke>(stroke: T, existing: SnapStroke[]): T {
  if (stroke.tool !== 'line' && stroke.tool !== 'rectangle') return stroke
  const others = existing.map(rect).filter((r): r is Rect => r !== null)
  return stroke.tool === 'rectangle' ? snapRectangle(stroke, others) : snapLine(stroke, others)
}
