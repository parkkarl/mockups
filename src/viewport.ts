export type Viewport = { x: number; y: number; zoom: number }
export type ScreenPoint = { x: number; y: number }
export const MIN_ZOOM = 0.15
export const MAX_ZOOM = 8
export const isFingerPointer = (pointerType: string) => pointerType === 'touch'

export function screenToWorld(view: Viewport, point: ScreenPoint): ScreenPoint {
  return { x: view.x + point.x / view.zoom, y: view.y + point.y / view.zoom }
}
export function worldToScreen(view: Viewport, point: ScreenPoint): ScreenPoint {
  return { x: (point.x - view.x) * view.zoom, y: (point.y - view.y) * view.zoom }
}
export function zoomAt(view: Viewport, zoom: number, anchor: ScreenPoint): Viewport {
  const next = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom))
  const world = screenToWorld(view, anchor)
  return { x: world.x - anchor.x / next, y: world.y - anchor.y / next, zoom: next }
}
export function panBy(view: Viewport, dx: number, dy: number): Viewport {
  return { ...view, x: view.x - dx / view.zoom, y: view.y - dy / view.zoom }
}
export function pinchViewport(view: Viewport, previous: [ScreenPoint, ScreenPoint], current: [ScreenPoint, ScreenPoint]): Viewport {
  const midpoint = (points: [ScreenPoint, ScreenPoint]) => ({ x: (points[0].x + points[1].x) / 2, y: (points[0].y + points[1].y) / 2 })
  const oldMid = midpoint(previous), newMid = midpoint(current)
  const before = Math.hypot(previous[0].x - previous[1].x, previous[0].y - previous[1].y)
  const after = Math.hypot(current[0].x - current[1].x, current[0].y - current[1].y)
  return zoomAt(panBy(view, newMid.x - oldMid.x, newMid.y - oldMid.y), view.zoom * (before ? after / before : 1), newMid)
}
