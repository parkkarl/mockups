// Puhas kujundituvastus: tundmatu tõmme jääb alati muutmata.
export type ShapePoint = { x: number; y: number; pressure: number }
export type RecognizedShape = { tool: 'line' | 'rectangle' | 'ellipse' | 'triangle'; points: ShapePoint[] }
const distance = (a: ShapePoint, b: ShapePoint) => Math.hypot(a.x - b.x, a.y - b.y)
const segmentDistance = (p: ShapePoint, a: ShapePoint, b: ShapePoint) => {
  const dx = b.x - a.x, dy = b.y - a.y
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1)))
  return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy)
}
const pt = (x: number, y: number): ShapePoint => ({ x, y, pressure: 1 })

// Ramer–Douglas–Peucker jätab suuremate suunamuutuste juures nurgad alles.
function simplify(points: ShapePoint[], epsilon: number): ShapePoint[] {
  if (points.length <= 2) return points
  let max = 0, index = 0
  for (let i = 1; i < points.length - 1; i++) {
    const d = segmentDistance(points[i], points[0], points[points.length - 1])
    if (d > max) { max = d; index = i }
  }
  if (max < epsilon) return [points[0], points[points.length - 1]]
  return [...simplify(points.slice(0, index + 1), epsilon).slice(0, -1), ...simplify(points.slice(index), epsilon)]
}

export function recognizeShape(raw: ShapePoint[]): RecognizedShape | null {
  if (raw.length < 5) return null
  // Võtame lähedased duplikaadid välja ning piirame pikast pliiatsitõmbest tekkivat tööd.
  const filtered = raw.filter((p, i) => i === 0 || distance(p, raw[i - 1]) > 1)
  const points = filtered.length > 2000 ? Array.from({ length: 2000 }, (_, i) => filtered[Math.round(i * (filtered.length - 1) / 1999)]) : filtered
  if (points.length < 5) return null
  const first = points[0], last = points[points.length - 1]
  const xs = points.map(p => p.x), ys = points.map(p => p.y)
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys)
  const w = maxX - minX, h = maxY - minY, diagonal = Math.hypot(w, h)
  if (diagonal < 45) return null
  let length = 0
  for (let i = 1; i < points.length; i++) length += distance(points[i - 1], points[i])
  const span = distance(first, last)
  // Üks sirge tõmme: suund jääb samaks ja kõrvalekalle on väike.
  if (span >= 55 && length / span < 1.18 &&
    points.reduce((sum, p) => sum + segmentDistance(p, first, last), 0) / points.length < Math.max(3, span * .035) &&
    Math.max(...points.map(p => segmentDistance(p, first, last))) < Math.max(10, span * .09)) {
    return { tool: 'line', points: [pt(first.x, first.y), pt(last.x, last.y)] }
  }
  // Suletud kuju korral peab joon läbi käima terve välisserva, mitte lihtsalt naasma algusesse.
  if (Math.min(w, h) < 35 || span > Math.max(18, diagonal * .16)) return null
  const perimeter = 2 * (w + h)
  if (length < perimeter * .65 || length > perimeter * 1.55) return null
  const corners = [pt(minX, minY), pt(maxX, minY), pt(maxX, maxY), pt(minX, maxY)]
  const rectangleError = points.reduce((sum, p) => sum + Math.min(p.x - minX, maxX - p.x, p.y - minY, maxY - p.y), 0) / points.length
  const cornersReached = corners.every(c => points.some(p => distance(p, c) < Math.min(w, h) * .21))
  if (cornersReached && rectangleError < Math.min(w, h) * .075 && length > perimeter * .83)
    return { tool: 'rectangle', points: [pt(minX, minY), pt(maxX, maxY)] }

  // Kolmnurk: leiame suletud raja nurgad; pikkus ja servad peavad klappima.
  const start = points.reduce((best, p, i) => p.x + p.y < points[best].x + points[best].y ? i : best, 0)
  const loop = [...points.slice(start), ...points.slice(0, start), points[start]]
  const reduced = simplify(loop, Math.min(w, h) * .095)
  if (reduced.length === 4) {
    const vertices = reduced.slice(0, 3)
    const area = Math.abs((vertices[1].x - vertices[0].x) * (vertices[2].y - vertices[0].y) - (vertices[2].x - vertices[0].x) * (vertices[1].y - vertices[0].y)) / 2
    const edges = vertices.reduce((sum, v, i) => sum + distance(v, vertices[(i + 1) % 3]), 0)
    const error = points.reduce((sum, p) => sum + Math.min(...vertices.map((v, i) => segmentDistance(p, v, vertices[(i + 1) % 3]))), 0) / points.length
    if (area > w * h * .17 && length / edges > .85 && length / edges < 1.3 && error < Math.min(w, h) * .055)
      return { tool: 'triangle', points: vertices.map(v => pt(v.x, v.y)) }
  }

  // Ellips: joon püsib enam-vähem ellipsi äärel; liiga sakilisi ringe ei teisendata.
  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2
  const errors = points.map(p => Math.abs(Math.hypot((p.x - cx) / (w / 2), (p.y - cy) / (h / 2)) - 1))
  const mean = errors.reduce((sum, n) => sum + n, 0) / errors.length
  if (mean < .12 && errors.filter(e => e > .28).length < errors.length * .12)
    return { tool: 'ellipse', points: [pt(minX, minY), pt(maxX, maxY)] }
  return null
}

// Lahtine L- või U-kujuline tõmme võib kasutada olemasoleva ristküliku serva(d)
// puuduvate külgedena. See ei muuda üksikut vabakäejoont iseseisvalt kujundiks.
export function recognizeAttachedRectangle(raw: ShapePoint[], existing: { tool: string; points: ShapePoint[] }[]): RecognizedShape | null {
  if (raw.length < 5) return null
  const points = raw.length > 1500 ? Array.from({ length: 1500 }, (_, i) => raw[Math.round(i * (raw.length - 1) / 1499)]) : raw
  const first = points[0], last = points[points.length - 1]
  const near = 18
  const rectangles = existing.filter(s => s.tool === 'rectangle' && s.points.length >= 2).map(s => {
    const a = s.points[0], b = s.points[s.points.length - 1]
    return { left: Math.min(a.x, b.x), right: Math.max(a.x, b.x), top: Math.min(a.y, b.y), bottom: Math.max(a.y, b.y) }
  })
  // Ülemine/alumine ja vasak/parem serv võivad pärineda ERINEVATELT kujunditelt.
  const horizontal = rectangles.flatMap(r => [r.top, r.bottom].map(y => ({ y, left: r.left, right: r.right })))
    .filter(e => Math.abs(first.y - e.y) <= near || Math.abs(last.y - e.y) <= near)
  const vertical = rectangles.flatMap(r => [r.left, r.right].map(x => ({ x, top: r.top, bottom: r.bottom })))
    .filter(e => Math.abs(first.x - e.x) <= near || Math.abs(last.x - e.x) <= near)
  for (const hEdge of horizontal) for (const vEdge of vertical) {
    // Servad peavad ka tegelikult puutuma, mitte ainult lõpmatult pikendatuna lõikuma.
    if (vEdge.x < hEdge.left - 2 || vEdge.x > hEdge.right + 2 || hEdge.y < vEdge.top - 2 || hEdge.y > vEdge.bottom + 2) continue
    for (const [h, v, path] of [[first, last, points], [last, first, [...points].reverse()]] as const) {
      if (Math.abs(h.y - hEdge.y) > near || h.x < hEdge.left - near || h.x > hEdge.right + near ||
        Math.abs(v.x - vEdge.x) > near || v.y < vEdge.top - near || v.y > vEdge.bottom + near) continue
      if (Math.abs(h.x - vEdge.x) < 22 || Math.abs(v.y - hEdge.y) < 22) continue
      const bend = pt(h.x, v.y)
      if (matchesPath(path, [h, bend, v], [bend]))
        return { tool: 'rectangle', points: [pt(vEdge.x, hEdge.y), bend] }
    }
  }
  for (const { left, right, top, bottom } of rectangles) {
    const insideX = (x: number) => x >= left - near && x <= right + near
    const insideY = (y: number) => y >= top - near && y <= bottom + near
    // Kolme külje joonistamisel on mõlemad otsad sama olemasoleva serva juures.
    for (const side of [top, bottom]) {
      if (Math.abs(first.y - side) > near || Math.abs(last.y - side) > near || !insideX(first.x) || !insideX(last.x)) continue
      const far = side === top ? Math.max(...points.map(p => p.y)) : Math.min(...points.map(p => p.y))
      if (far < top + 22 || far > bottom - 22 || Math.abs(first.x - last.x) < 22) continue
      const x1 = Math.max(left, Math.min(right, first.x)), x2 = Math.max(left, Math.min(right, last.x))
      const c1 = pt(x1, far), c2 = pt(x2, far)
      if (matchesPath(points, [first, c1, c2, last], [c1, c2]))
        return { tool: 'rectangle', points: [pt(Math.min(x1, x2), Math.min(side, far)), pt(Math.max(x1, x2), Math.max(side, far))] }
    }
    for (const side of [left, right]) {
      if (Math.abs(first.x - side) > near || Math.abs(last.x - side) > near || !insideY(first.y) || !insideY(last.y)) continue
      const far = side === left ? Math.max(...points.map(p => p.x)) : Math.min(...points.map(p => p.x))
      if (far < left + 22 || far > right - 22 || Math.abs(first.y - last.y) < 22) continue
      const y1 = Math.max(top, Math.min(bottom, first.y)), y2 = Math.max(top, Math.min(bottom, last.y))
      const c1 = pt(far, y1), c2 = pt(far, y2)
      if (matchesPath(points, [first, c1, c2, last], [c1, c2]))
        return { tool: 'rectangle', points: [pt(Math.min(side, far), Math.min(y1, y2)), pt(Math.max(side, far), Math.max(y1, y2))] }
    }
  }
  return null
}

// Automaatkujud ON: kui see pole kujund, peab iga avatud pliiatsitõmme olema sirge.
export function straightenStroke(points: ShapePoint[]): RecognizedShape | null {
  if (points.length < 2) return null
  const first = points[0], last = points[points.length - 1]
  const span = distance(first, last)
  if (span < 4) return null // täpp jääb täpiks
  let left = Infinity, right = -Infinity, top = Infinity, bottom = -Infinity
  for (const p of points) {
    left = Math.min(left, p.x); right = Math.max(right, p.x)
    top = Math.min(top, p.y); bottom = Math.max(bottom, p.y)
  }
  // Tundmatu suletud silmus ei tohi kahaneda väikseks jooneks.
  if (span < Math.hypot(right - left, bottom - top) * .18) return null
  return { tool: 'line', points: [pt(first.x, first.y), pt(last.x, last.y)] }
}

function matchesPath(points: ShapePoint[], corners: ShapePoint[], bends: ShapePoint[]) {
  const expected = corners.slice(1).reduce((sum, p, i) => sum + distance(p, corners[i]), 0)
  const length = points.slice(1).reduce((sum, p, i) => sum + distance(p, points[i]), 0)
  if (expected < 50 || length < expected * .72 || length > expected * 1.5) return false
  if (!bends.every(b => points.some(p => distance(p, b) < 19))) return false
  const errors = points.map(p => Math.min(...corners.slice(1).map((v, i) => segmentDistance(p, corners[i], v))))
  return Math.max(...errors) < 19 && errors.reduce((sum, e) => sum + e, 0) / errors.length < 8
}
