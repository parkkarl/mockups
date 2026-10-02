import { useEffect, useRef, useState } from 'react'
import { cachedImage, prepareImages } from './images'
import { cloneStrokes, snapshotSelection } from './object-copy'
import { createHoldToCopy } from './hold-to-copy'
import { Minus, Plus } from 'lucide-react'
import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from 'react'
import { recognizeAttachedRectangle, recognizeShape, straightenStroke } from './shapes'
import { snapStroke } from './snapping'
import { boundsOf, selectionForClick, withinSelection } from './selection'
import { allowsTextEditing, penTipContact, stylusEraser, stylusSelect } from './pen-input'
import { touchesRectangleOutline } from './eraser-hit'
import { displayColor } from './theme'
import type { Theme } from './theme'
import { isStrokeLocked, translateSelectedUnlocked } from './locking'
import { handlePoint, handles, resizeSelected, selectionBounds } from './resize'
import type { ResizeHandle } from './resize'
import { isFingerPointer, panBy, pinchViewport, screenToWorld, zoomAt } from './viewport'
import type { ScreenPoint, Viewport } from './viewport'

export type Tool = 'select' | 'pen' | 'highlighter' | 'eraser' | 'line' | 'rectangle' | 'ellipse' | 'hand'
export type Point = { x: number; y: number; pressure: number }
export type Stroke = { id: string; tool: Exclude<Tool, 'eraser' | 'hand' | 'select'> | 'triangle' | 'text' | 'image'; imageSource?: string; color: string; size: number; points: Point[]; text?: string; groupId?: string; fill?: string; radius?: number; locked?: boolean; outlineOnly?: boolean }
type Props = {
  strokes: Stroke[]; onCommit: (next: Stroke[]) => void; tool: Tool; color: string; size: number
  selectedIds: string[]; setSelectedIds: (ids: string[]) => void; canvasRef: React.RefObject<HTMLCanvasElement | null>
  automaticShapes: boolean; autoSnap: boolean; penOnly: boolean; theme: Theme; viewportRef: React.RefObject<Viewport>; onTemporarySelect: (active: boolean) => void
}
type Editor = { id: string; x: number; y: number; text: string; existing: boolean; color: string }

export function paintViewport(ctx: CanvasRenderingContext2D, strokes: Stroke[], draft: Stroke | null, width: number, height: number, view: Viewport, theme: Theme) {
  const scaleX = ctx.canvas.width / width, scaleY = ctx.canvas.height / height
  ctx.setTransform(scaleX, 0, 0, scaleY, 0, 0)
  ctx.fillStyle = theme === 'light' ? '#ffffff' : '#191919'; ctx.fillRect(0, 0, width, height)
  ctx.strokeStyle = theme === 'light' ? '#ebebeb' : '#303030'; ctx.lineWidth = 1
  const gridStep = 40 * 2 ** Math.max(0, Math.ceil(Math.log2(8 / (40 * view.zoom))))
  ctx.beginPath()
  for (let x = Math.floor(view.x / gridStep) * gridStep; x < view.x + width / view.zoom; x += gridStep) {
    const at = (x - view.x) * view.zoom + .5; ctx.moveTo(at, 0); ctx.lineTo(at, height)
  }
  for (let y = Math.floor(view.y / gridStep) * gridStep; y < view.y + height / view.zoom; y += gridStep) {
    const at = (y - view.y) * view.zoom + .5; ctx.moveTo(0, at); ctx.lineTo(width, at)
  }
  ctx.stroke()
  ctx.save()
  ctx.translate(-view.x * view.zoom, -view.y * view.zoom)
  ctx.scale(view.zoom, view.zoom)
  for (const stroke of draft ? [...strokes, draft] : strokes) drawStroke(ctx, stroke, theme)
  ctx.restore()
}

function drawStroke(ctx: CanvasRenderingContext2D, stroke: Stroke, theme: Theme) {
  const p = stroke.points
  if (!p.length) return
  if (stroke.tool === 'image') {
    const image = stroke.imageSource ? cachedImage(stroke.imageSource) : undefined
    const a = p[0], b = p[p.length - 1]
    if (image) ctx.drawImage(image, Math.min(a.x, b.x), Math.min(a.y, b.y), Math.abs(b.x - a.x), Math.abs(b.y - a.y))
    return
  }
  ctx.save()
  ctx.globalAlpha = stroke.tool === 'highlighter' ? .38 : 1
  ctx.strokeStyle = displayColor(stroke.color, theme); ctx.fillStyle = displayColor(stroke.color, theme)
  ctx.lineWidth = stroke.tool === 'highlighter' ? stroke.size * 3 : stroke.size
  ctx.lineCap = 'round'; ctx.lineJoin = 'round'
  if (stroke.tool === 'text') {
    ctx.font = `${stroke.size || 20}px system-ui, sans-serif`; ctx.textBaseline = 'top'
    for (const [i, line] of (stroke.text ?? '').split('\n').entries()) ctx.fillText(line, p[0].x, p[0].y + i * (stroke.size || 20) * 1.35)
    ctx.restore(); return
  }
  ctx.beginPath()
  if (stroke.tool === 'triangle') {
    ctx.moveTo(p[0].x, p[0].y)
    for (const vertex of p.slice(1)) ctx.lineTo(vertex.x, vertex.y)
    ctx.closePath()
  } else if (stroke.tool === 'rectangle' || stroke.tool === 'ellipse') {
    const a = p[0], b = p[p.length - 1]
    if (stroke.tool === 'rectangle') {
      if (stroke.radius) ctx.roundRect(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.abs(b.x - a.x), Math.abs(b.y - a.y), stroke.radius)
      else ctx.rect(a.x, a.y, b.x - a.x, b.y - a.y)
    } else ctx.ellipse((a.x + b.x) / 2, (a.y + b.y) / 2, Math.max(1, Math.abs(b.x - a.x) / 2), Math.max(1, Math.abs(b.y - a.y) / 2), 0, 0, Math.PI * 2)
  } else if (stroke.tool === 'pen' && p.length > 1) {
    for (let i = 1; i < p.length; i++) {
      ctx.beginPath(); ctx.moveTo(p[i - 1].x, p[i - 1].y); ctx.lineTo(p[i].x, p[i].y)
      ctx.lineWidth = stroke.size * (.35 + .65 * (p[i - 1].pressure + p[i].pressure) / 2)
      ctx.stroke()
    }
    ctx.restore(); return
  } else {
    ctx.moveTo(p[0].x, p[0].y)
    if (p.length === 1) { ctx.arc(p[0].x, p[0].y, ctx.lineWidth / 2, 0, Math.PI * 2); ctx.fill() }
    else for (const point of p.slice(1)) ctx.lineTo(point.x, point.y)
  }
  if (stroke.fill) ctx.fill()
  if (stroke.size > 0) ctx.stroke()
  ctx.restore()
}

function distanceToSegment(p: Point, a: Point, b: Point) {
  const dx = b.x - a.x, dy = b.y - a.y
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1)))
  return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy)
}
function hit(stroke: Stroke, p: Point, tolerance: number, erasing = false) {
  if (erasing && stroke.tool === 'rectangle') return touchesRectangleOutline(stroke, p, tolerance)
  const points = stroke.points
  if (!points.length) return false
  if (stroke.tool === 'text' || stroke.tool === 'image') {
    const box = boundsOf(stroke)!
    return p.x >= box.left - tolerance && p.x <= box.right + tolerance && p.y >= box.top - tolerance && p.y <= box.bottom + tolerance
  }
  if (stroke.tool === 'triangle') return points.some((v, i) => distanceToSegment(p, v, points[(i + 1) % points.length]) < tolerance)
  if (stroke.tool === 'ellipse' || stroke.tool === 'rectangle') {
    const a = points[0], b = points[points.length - 1]
    const minX = Math.min(a.x, b.x), maxX = Math.max(a.x, b.x), minY = Math.min(a.y, b.y), maxY = Math.max(a.y, b.y)
    if (stroke.tool === 'rectangle') {
      const within = p.x >= minX - tolerance && p.x <= maxX + tolerance && p.y >= minY - tolerance && p.y <= maxY + tolerance
      return within && (!stroke.outlineOnly || Math.min(Math.abs(p.x - minX), Math.abs(p.x - maxX), Math.abs(p.y - minY), Math.abs(p.y - maxY)) <= tolerance)
    }
    const rx = Math.max(1, (maxX - minX) / 2), ry = Math.max(1, (maxY - minY) / 2)
    return Math.abs(((p.x - (minX + maxX) / 2) / (rx + tolerance)) ** 2 + ((p.y - (minY + maxY) / 2) / (ry + tolerance)) ** 2 - 1) < .35
  }
  return points.length === 1 ? Math.hypot(p.x - points[0].x, p.y - points[0].y) < tolerance : points.slice(1).some((v, i) => distanceToSegment(p, points[i], v) < tolerance)
}

export function Canvas({ strokes, onCommit, tool, color, size, selectedIds, setSelectedIds, canvasRef, automaticShapes, autoSnap, penOnly, theme, viewportRef, onTemporarySelect }: Props) {
  const [draft, setDraft] = useState<Stroke | null>(null)
  const [imageVersion, setImageVersion] = useState(0)
  useEffect(() => {
    let stopped = false
    void prepareImages(strokes).then(() => { if (!stopped) setImageVersion(value => value + 1) }).catch(console.error)
    return () => { stopped = true }
  }, [strokes])
  const [resizePreview, setResizePreview] = useState<Stroke[] | null>(null)
  const [barrelErasing, setBarrelErasing] = useState(false)
  const [marquee, setMarquee] = useState<{ start: Point; end: Point } | null>(null)
  const [editor, setEditor] = useState<Editor | null>(null)
  const editorRef = useRef<HTMLTextAreaElement>(null)
  const cancelEdit = useRef(false)
  const drawing = useRef<Stroke | null>(null)
  const moving = useRef<{ ids: string[]; start: Point; original: Stroke[]; drillId?: string } | null>(null)
  const resizing = useRef<{ ids: string[]; handle: ResizeHandle; start: Point; bounds: NonNullable<ReturnType<typeof selectionBounds>>; original: Stroke[] } | null>(null)
  const visibleStrokes = resizePreview ?? strokes
  const [view, setView] = useState<Viewport>({ x: 0, y: 0, zoom: 1 })
  const liveView = useRef(view)
  const [viewportSize, setViewportSize] = useState({ width: 850, height: 700 })
  const canvasWidth = viewportSize.width, canvasHeight = viewportSize.height
  const resizeBounds = selectionBounds(visibleStrokes, selectedIds)
  const canResize = selectedIds.length > 0 && !selectedIds.some(id => strokes.some(s => s.id === id && isStrokeLocked(s, strokes)))
  const marqueeRef = useRef<{ start: Point; end: Point } | null>(null)
  const erasing = useRef<Stroke[] | null>(null)
  const barrelStroke = useRef(false)
  const panning = useRef<{ x: number; y: number } | null>(null)
  const touches = useRef(new Map<number, ScreenPoint>())
  const touchGesture = useRef<[ScreenPoint, ScreenPoint] | null>(null)
  const recentMouseMarks = useRef<{ id: string; x: number; y: number; time: number }[]>([])
  const drilledOnUp = useRef(false)
  const lastPointerType = useRef('')
  const temporarySelect = useRef(false)
  const [selectHeld, setSelectHeld] = useState(false)
  const latest = useRef({ strokes, onCommit, setSelectedIds })
  latest.current = { strokes, onCommit, setSelectedIds }
  const holdCandidate = useRef<{ ids: string[]; original: Stroke[] } | null>(null)
  const [copyHold] = useState(() => createHoldToCopy(() => {
    const candidate = holdCandidate.current
    if (!candidate || !temporarySelect.current || latest.current.strokes !== candidate.original) return
    const copies = cloneStrokes(snapshotSelection(candidate.original, candidate.ids))
    if (!copies.length) return
    moving.current = null; resizing.current = null; setResizePreview(null)
    drawing.current = null; setDraft(null)
    holdCandidate.current = null
    latest.current.onCommit([...candidate.original, ...copies])
    latest.current.setSelectedIds(copies.map(stroke => stroke.id))
  }))
  useEffect(() => {
    const cancel = () => { copyHold.cancel(); holdCandidate.current = null }
    window.addEventListener('blur', cancel)
    return () => { cancel(); window.removeEventListener('blur', cancel) }
  }, [copyHold])
  useEffect(() => { copyHold.cancel(); holdCandidate.current = null }, [tool, strokes, view, copyHold])
  function showTemporarySelect(active: boolean) {
    if (!active) { copyHold.cancel(); holdCandidate.current = null }
    temporarySelect.current = active; setSelectHeld(active); onTemporarySelect(active)
  }
  useEffect(() => () => onTemporarySelect(false), [onTemporarySelect])
  const scrollRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const element = scrollRef.current
    if (!element) return
    const observer = new ResizeObserver(() => setViewportSize({ width: Math.max(1, element.clientWidth), height: Math.max(1, element.clientHeight) }))
    observer.observe(element)
    return () => observer.disconnect()
  }, [])
  useEffect(() => {
    const element = scrollRef.current
    if (!element) return
    const onWheel = (event: WheelEvent) => {
      event.preventDefault()
      const rect = element.getBoundingClientRect()
      const anchor = { x: event.clientX - rect.left, y: event.clientY - rect.top }
      const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? element.clientHeight : 1
      if (event.ctrlKey || event.metaKey) changeView(zoomAt(liveView.current, liveView.current.zoom * Math.exp(-event.deltaY * unit * .008), anchor))
      else changeView(panBy(liveView.current, -event.deltaX * unit, -event.deltaY * unit))
    }
    element.addEventListener('wheel', onWheel, { passive: false })
    return () => element.removeEventListener('wheel', onWheel)
  }, [])
  function changeView(next: Viewport) { liveView.current = next; viewportRef.current = next; setView(next) }
  useEffect(() => { viewportRef.current = liveView.current; return () => { viewportRef.current = { x: 0, y: 0, zoom: 1 } } }, [viewportRef])
  useEffect(() => { if (editor) editorRef.current?.focus() }, [editor?.id])
  useEffect(() => { if (canvasRef.current) canvasRef.current.style.cursor = '' }, [tool, selectedIds, canvasRef])
  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return
    paintViewport(ctx, editor ? visibleStrokes.filter(s => s.id !== editor.id || !editor.existing) : visibleStrokes, draft && autoSnap ? snapStroke(draft, strokes) : draft, canvasWidth, canvasHeight, view, theme)
    ctx.save(); ctx.translate(-view.x * view.zoom, -view.y * view.zoom); ctx.scale(view.zoom, view.zoom)
    const drawnGroups = new Set<string>()
    for (const stroke of visibleStrokes) {
      if (!selectedIds.includes(stroke.id) || editor?.id === stroke.id) continue
      if (stroke.groupId && drawnGroups.has(stroke.groupId)) continue
      const members = stroke.groupId ? visibleStrokes.filter(s => s.groupId === stroke.groupId && selectedIds.includes(s.id)) : [stroke]
      if (stroke.groupId) drawnGroups.add(stroke.groupId)
      const bounds = members.map(boundsOf).filter((box): box is NonNullable<typeof box> => box !== null)
      if (!bounds.length) continue
      const left = Math.min(...bounds.map(b => b.left)), top = Math.min(...bounds.map(b => b.top))
      const right = Math.max(...bounds.map(b => b.right)), bottom = Math.max(...bounds.map(b => b.bottom))
      const locked = members.some(item => isStrokeLocked(item, visibleStrokes))
      ctx.save(); ctx.strokeStyle = locked ? '#c18b32' : '#777777'; ctx.lineWidth = 1; ctx.setLineDash([5, 4])
      ctx.strokeRect(left - 10, top - 10, right - left + 20, bottom - top + 20)
      if (locked) { ctx.setLineDash([]); ctx.font = '12px system-ui'; ctx.fillStyle = '#f2c674'; ctx.fillText('LUKUS', left, Math.max(14, top - 15)) }
      ctx.restore()
    }
    if (canResize && resizeBounds && !editor && (tool === 'select' || penOnly || selectHeld)) {
      ctx.save(); ctx.fillStyle = theme === 'light' ? '#ffffff' : '#191919'; ctx.strokeStyle = '#777777'; ctx.lineWidth = 2
      for (const handle of handles) {
        const { x, y } = handlePoint(resizeBounds, handle)
        ctx.fillRect(x - 5, y - 5, 10, 10); ctx.strokeRect(x - 5, y - 5, 10, 10)
      }
      ctx.restore()
    }
    if (marquee) {
      const x = Math.min(marquee.start.x, marquee.end.x), y = Math.min(marquee.start.y, marquee.end.y)
      ctx.save(); ctx.fillStyle = '#77777722'; ctx.strokeStyle = '#777777'; ctx.setLineDash([6, 4])
      ctx.fillRect(x, y, Math.abs(marquee.end.x - marquee.start.x), Math.abs(marquee.end.y - marquee.start.y))
      ctx.strokeRect(x, y, Math.abs(marquee.end.x - marquee.start.x), Math.abs(marquee.end.y - marquee.start.y)); ctx.restore()
    }
    ctx.restore()
  }, [strokes, visibleStrokes, draft, selectedIds, marquee, editor, canvasRef, autoSnap, canvasWidth, canvasHeight, tool, penOnly, theme, view, selectHeld, imageVersion])
  function point(e: ReactPointerEvent<HTMLCanvasElement> | ReactMouseEvent<HTMLCanvasElement>): Point {
    const rect = e.currentTarget.getBoundingClientRect()
    const world = screenToWorld(liveView.current, { x: e.clientX - rect.left, y: e.clientY - rect.top })
    return { ...world, pressure: 'pointerType' in e && e.pointerType === 'pen' ? Math.max(.15, e.pressure) : 1 }
  }
  function localPoint(e: ReactPointerEvent<HTMLCanvasElement>): ScreenPoint {
    const rect = e.currentTarget.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }
  function paintCurrent(items: Stroke[]) {
    const ctx = canvasRef.current?.getContext('2d')
    if (ctx) paintViewport(ctx, items, null, canvasWidth, canvasHeight, liveView.current, theme)
  }
  function down(e: ReactPointerEvent<HTMLCanvasElement>) {
    copyHold.cancel(); holdCandidate.current = null
    lastPointerType.current = e.pointerType
    if (isFingerPointer(e.pointerType)) {
      e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId)
      touches.current.set(e.pointerId, localPoint(e))
      if (touches.current.size >= 2) touchGesture.current = [...touches.current.values()].slice(0, 2) as [ScreenPoint, ScreenPoint]
      return
    }
    if (e.pointerType === 'mouse' && e.button === 2) return
    if (stylusSelect(e) && !penTipContact(e)) { showTemporarySelect(true); return }
    e.currentTarget.setPointerCapture(e.pointerId)
    drilledOnUp.current = false
    const p = point(e)
    if (e.pointerType === 'pen') showTemporarySelect(stylusSelect(e))
    if (stylusEraser(e)) {
      e.preventDefault(); barrelStroke.current = true; setBarrelErasing(true)
      erasing.current = strokes.filter(s => isStrokeLocked(s, strokes) || !hit(s, p, size * 2 + 8, true))
      paintCurrent(erasing.current)
      return
    }
    if (e.button === 1 || (tool === 'hand' && !(penOnly && e.pointerType === 'mouse'))) {
      e.preventDefault()
      panning.current = { x: e.clientX, y: e.clientY }; return
    }
    if (e.pointerType === 'mouse' && penOnly || tool === 'select' || stylusSelect(e)) {
      if (canResize && resizeBounds) {
        const handle = handles.find(h => { const at = handlePoint(resizeBounds, h); return Math.hypot(p.x - at.x, p.y - at.y) <= 10 })
        if (handle) { resizing.current = { ids: selectedIds, handle, start: p, bounds: resizeBounds, original: strokes }; return }
      }
      const found = [...strokes].reverse().find(s => hit(s, p, 9))
      if (found) {
        const { ids, drillId } = selectionForClick(strokes, found, selectedIds, e.shiftKey, e.altKey)
        if (stylusSelect(e)) {
          holdCandidate.current = { ids, original: strokes }
          copyHold.start(e.pointerId, { x: e.clientX, y: e.clientY })
        }
        if (!drillId) setSelectedIds(ids)
        if (!e.shiftKey && (drillId || !isStrokeLocked(found, strokes) && ids.some(id => strokes.some(s => s.id === id && !isStrokeLocked(s, strokes)))))
          moving.current = { ids: isStrokeLocked(found, strokes) ? [] : ids, start: p, original: strokes, ...(drillId ? { drillId } : {}) }
      } else {
        if (!e.shiftKey) setSelectedIds([])
        marqueeRef.current = { start: p, end: p }; setMarquee(marqueeRef.current)
      }
      return
    }
    if (tool === 'hand') return
    if (tool === 'eraser') { erasing.current = strokes.filter(s => isStrokeLocked(s, strokes) || !hit(s, p, size * 2 + 8, true)); setDraft(null); return }
    setSelectedIds([])
    const next: Stroke = { id: crypto.randomUUID(), tool, color, size, points: [p], ...(tool === 'rectangle' ? { radius: 12 } : {}) }
    drawing.current = next; setDraft(next)
  }
  function move(e: ReactPointerEvent<HTMLCanvasElement>) {
    copyHold.move(e.pointerId, { x: e.clientX, y: e.clientY })
    if (isFingerPointer(e.pointerType)) {
      if (!touches.current.has(e.pointerId)) return
      e.preventDefault()
      const at = localPoint(e), previous = touches.current.get(e.pointerId)!
      touches.current.set(e.pointerId, at)
      if (touches.current.size >= 2) {
        const pair = [...touches.current.values()].slice(0, 2) as [ScreenPoint, ScreenPoint]
        if (touchGesture.current) changeView(pinchViewport(liveView.current, touchGesture.current, pair))
        touchGesture.current = pair
      } else changeView(panBy(liveView.current, at.x - previous.x, at.y - previous.y))
      return
    }
    const selecting = stylusSelect(e)
    if (e.pointerType === 'pen' && selecting !== temporarySelect.current) {
      const captured = e.currentTarget.hasPointerCapture(e.pointerId)
      if (!selecting && captured) { up(e, true); showTemporarySelect(false); return }
      showTemporarySelect(selecting)
      if (selecting && captured) {
        drawing.current = null; setDraft(null); erasing.current = null
        moving.current = null; resizing.current = null; setResizePreview(null)
        marqueeRef.current = null; setMarquee(null)
        down(e); return
      }
    }
    if (selecting && penTipContact(e) && !e.currentTarget.hasPointerCapture(e.pointerId)) { down(e); return }
    if (selecting && !penTipContact(e) && e.currentTarget.hasPointerCapture(e.pointerId)) { up(e, true); return }
    const barrel = stylusEraser(e)
    if (e.pointerType === 'pen') setBarrelErasing(barrel)
    if (barrel && !barrelStroke.current && e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.preventDefault(); barrelStroke.current = true
      drawing.current = null; setDraft(null); moving.current = null; resizing.current = null; setResizePreview(null)
      marqueeRef.current = null; setMarquee(null); panning.current = null
      erasing.current = strokes
    }
    if (barrelStroke.current && !barrel) return
    if (panning.current) {
      changeView(panBy(liveView.current, e.clientX - panning.current.x, e.clientY - panning.current.y))
      panning.current = { x: e.clientX, y: e.clientY }; return
    }
    if (!e.currentTarget.hasPointerCapture(e.pointerId)) {
      if (canResize && resizeBounds && (tool === 'select' || selecting || penOnly && e.pointerType === 'mouse')) {
        const p = point(e)
        const handle = handles.find(h => { const at = handlePoint(resizeBounds, h); return Math.hypot(p.x - at.x, p.y - at.y) <= 10 })
        e.currentTarget.style.cursor = handle ? `${handle}-resize` : ''
      } else e.currentTarget.style.cursor = ''
      return
    }
    const p = point(e)
    if (resizing.current) {
      const { ids, handle, start, bounds, original } = resizing.current
      const view = scrollRef.current!
      const edge = view.getBoundingClientRect()
      const dx = e.clientX > edge.right - 36 ? -28 : e.clientX < edge.left + 36 ? 28 : 0
      const dy = e.clientY > edge.bottom - 36 ? -28 : e.clientY < edge.top + 36 ? 28 : 0
      if (dx || dy) changeView(panBy(liveView.current, dx, dy))
      const at = point(e)
      setResizePreview(resizeSelected(original, ids, handle, bounds, at.x - start.x, at.y - start.y))
      return
    }
    if (marqueeRef.current) { marqueeRef.current = { ...marqueeRef.current, end: p }; setMarquee(marqueeRef.current); return }
    if (erasing.current) { erasing.current = erasing.current.filter(s => isStrokeLocked(s, strokes) || !hit(s, p, size * 2 + 8, true)); paintCurrent(erasing.current); return }
    if (moving.current) {
      const { ids, start, original } = moving.current
      if (!ids.length) return
      if (Math.hypot(p.x - start.x, p.y - start.y) < 2) {
        paintCurrent(original)
        return
      }
      const translated = translateSelectedUnlocked(original, ids, p.x - start.x, p.y - start.y)
      paintCurrent(translated)
      return
    }
    if (drawing.current) {
      const prev = drawing.current
      const points = prev.tool === 'rectangle' || prev.tool === 'ellipse' || prev.tool === 'line' ? [prev.points[0], p] : [...prev.points, p]
      drawing.current = { ...prev, points }; setDraft(drawing.current)
    }
  }
  function up(e: ReactPointerEvent<HTMLCanvasElement>, completed = e.type === 'pointerup') {
    copyHold.cancel(); holdCandidate.current = null
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId)
    if (isFingerPointer(e.pointerType)) {
      e.preventDefault(); touches.current.delete(e.pointerId)
      touchGesture.current = touches.current.size >= 2 ? [...touches.current.values()].slice(0, 2) as [ScreenPoint, ScreenPoint] : null
      return
    }
    if (e.pointerType === 'pen') showTemporarySelect((e.buttons & 2) !== 0 && !stylusEraser(e))
    panning.current = null
    if (resizing.current) {
      const { ids, handle, start, bounds, original } = resizing.current
      resizing.current = null
      setResizePreview(null)
      if (completed) {
        const end = point(e)
        onCommit(resizeSelected(original, ids, handle, bounds, end.x - start.x, end.y - start.y))
      } else paintCurrent(strokes)
      return
    }
    if (marqueeRef.current) {
      const start = marqueeRef.current.start, end = point(e)
      if (Math.hypot(end.x - start.x, end.y - start.y) >= 4) {
        const selected = strokes.filter(s => withinSelection(s, start, end))
        const groups = new Set(selected.map(s => s.groupId).filter(Boolean))
        const ids = strokes.filter(s => selected.includes(s) || (s.groupId && groups.has(s.groupId))).map(s => s.id)
        setSelectedIds(e.shiftKey ? [...new Set([...selectedIds, ...ids])] : ids)
      }
      marqueeRef.current = null; setMarquee(null)
    }
    if (erasing.current) { onCommit(erasing.current); erasing.current = null }
    barrelStroke.current = false; setBarrelErasing(false)
    if (moving.current) {
      const p = point(e), { ids, start, original, drillId } = moving.current
      if (Math.hypot(p.x - start.x, p.y - start.y) >= 2 && ids.length && completed)
        onCommit(translateSelectedUnlocked(original, ids, p.x - start.x, p.y - start.y))
      else if (drillId && completed && Math.hypot(p.x - start.x, p.y - start.y) < 2) {
        drilledOnUp.current = true
        setSelectedIds([drillId])
      }
      else setSelectedIds([...selectedIds]) // taasta valikuraam pärast katkestatud lohistamist
      moving.current = null
    }
    if (drawing.current) {
      const stroke = drawing.current
      const end = point(e)
      if (stroke.tool === 'pen' || stroke.tool === 'highlighter') {
        if (distanceToSegment(end, stroke.points[stroke.points.length - 1], stroke.points[stroke.points.length - 1]) > 1) stroke.points.push(end)
      } else if (stroke.points.length > 1) stroke.points[stroke.points.length - 1] = end
      const shape = automaticShapes && stroke.tool === 'pen' && e.type === 'pointerup'
        ? recognizeShape(stroke.points) ?? (autoSnap ? recognizeAttachedRectangle(stroke.points, strokes) : null) ?? straightenStroke(stroke.points) : null
      const finished = shape ? { ...stroke, ...shape } : stroke
      onCommit([...strokes, autoSnap && e.type === 'pointerup' ? snapStroke(finished, strokes) : finished])
      if (e.pointerType === 'mouse' && Math.hypot(end.x - stroke.points[0].x, end.y - stroke.points[0].y) < 4) {
        recentMouseMarks.current = [...recentMouseMarks.current.filter(m => Date.now() - m.time < 650), { id: finished.id, x: end.x, y: end.y, time: Date.now() }]
      }
      drawing.current = null; setDraft(null)
    }
  }
  function doubleClick(e: ReactMouseEvent<HTMLCanvasElement>) {
    e.preventDefault()
    if (!allowsTextEditing(lastPointerType.current, (e.nativeEvent as PointerEvent).pointerType)) return
    // Ka kiire teine klõps peab esmalt valima vormi osa, mitte avama kohe tekstiredaktorit.
    if (drilledOnUp.current) { drilledOnUp.current = false; return }
    const p = point(e)
    const recent = recentMouseMarks.current.filter(mark => Date.now() - mark.time < 650 && Math.hypot(mark.x - p.x, mark.y - p.y) < 12)
    const cleaned = strokes.filter(s => !recent.some(mark => mark.id === s.id))
    recentMouseMarks.current = []
    if (cleaned.length !== strokes.length) onCommit(cleaned)
    const existing = [...cleaned].reverse().find(s => s.tool === 'text' && hit(s, p, 7))
    if (existing && isStrokeLocked(existing, cleaned)) {
      setSelectedIds(existing.groupId ? cleaned.filter(s => s.groupId === existing.groupId).map(s => s.id) : [existing.id])
      return
    }
    setSelectedIds(existing ? [existing.id] : [])
    setEditor(existing ? { id: existing.id, x: existing.points[0].x, y: existing.points[0].y, text: existing.text ?? '', color: existing.color, existing: true }
      : { id: crypto.randomUUID(), x: p.x, y: p.y, text: '', color, existing: false })
  }
  function finishEditing() {
    if (!editor) return
    if (cancelEdit.current) { cancelEdit.current = false; setEditor(null); return }
    const text = editor.text.slice(0, 2000)
    if (editor.existing) onCommit(text.trim() ? strokes.map(s => s.id === editor.id ? { ...s, text } : s) : strokes.filter(s => s.id !== editor.id))
    else if (text.trim()) onCommit([...strokes, { id: editor.id, tool: 'text', text, color: editor.color, size: 20, points: [{ x: editor.x, y: editor.y, pressure: 1 }] }])
    setEditor(null)
  }
  return <div className="canvas-scroll" ref={scrollRef}>
    <div className="canvas-sheet">
      <canvas ref={canvasRef} width={Math.round(canvasWidth * window.devicePixelRatio)} height={Math.round(canvasHeight * window.devicePixelRatio)} onPointerDown={down} onPointerMove={move} onPointerUp={e => up(e)} onPointerCancel={e => { up(e); showTemporarySelect(false) }} onPointerLeave={e => { if (e.pointerType === 'pen' && !e.currentTarget.hasPointerCapture(e.pointerId)) showTemporarySelect(false) }}
        onDoubleClick={doubleClick} onContextMenu={e => e.preventDefault()}
        className={`drawing-canvas ${barrelErasing ? 'tool-eraser' : selectHeld || penOnly ? 'tool-select' : `tool-${tool}`}`} aria-label="Joonistusala" />
      {editor && <textarea ref={editorRef} className="canvas-text-editor" style={{ left: (editor.x - view.x) * view.zoom, top: (editor.y - view.y) * view.zoom, transform: `scale(${view.zoom})`, transformOrigin: 'top left', color: displayColor(editor.color, theme) }}
        value={editor.text} placeholder="Kirjuta siia…" maxLength={2000} aria-label="Tekst joonisel" spellCheck={false} wrap="off"
        onChange={e => setEditor({ ...editor, text: e.target.value })} onBlur={finishEditing}
        onKeyDown={e => { e.stopPropagation(); if (e.key === 'Escape') { cancelEdit.current = true; e.currentTarget.blur() } if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) e.currentTarget.blur() }} />}
      <div className="canvas-corner">ruudustik 40px <span>·</span> piiramatu lõuend</div>
    </div>
    <div className="canvas-zoom" aria-label="Lõuendi suum">
      <button type="button" aria-label="Suumi välja" title="Suumi välja" onClick={() => changeView(zoomAt(liveView.current, view.zoom / 1.25, { x: canvasWidth / 2, y: canvasHeight / 2 }))}><Minus size={16} /></button>
      <button type="button" aria-label="Taasta suum" title="Taasta 100% suum" onClick={() => changeView(zoomAt(liveView.current, 1, { x: canvasWidth / 2, y: canvasHeight / 2 }))}>{Math.round(view.zoom * 100)}%</button>
      <button type="button" aria-label="Suumi sisse" title="Suumi sisse" onClick={() => changeView(zoomAt(liveView.current, view.zoom * 1.25, { x: canvasWidth / 2, y: canvasHeight / 2 }))}><Plus size={16} /></button>
    </div>
  </div>
}
