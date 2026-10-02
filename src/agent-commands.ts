import type { Stroke } from './canvas'
import { isStrokeLocked } from './locking.ts'
import { validImageSource } from './images.ts'

export type AgentEdit = { pageId: string; action: 'add' | 'replace' | 'delete' | 'import-image'; strokes?: unknown; ids?: unknown; path?: string; x?: number; y?: number; width?: number }
const identifier = /^[a-zA-Z0-9-]{1,64}$/
const hexColor = /^#[0-9a-fA-F]{6}$/
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)

export function parseAgentEdit(raw: string): AgentEdit {
  const value: unknown = JSON.parse(raw.replace(/^\uFEFF/, ''))
  if (!isRecord(value) || typeof value.pageId !== 'string' || !identifier.test(value.pageId) ||
      !['add', 'replace', 'delete', 'import-image'].includes(String(value.action))) throw new Error('Vigane käsk: vaja on pageId ja action (add, replace, delete)')
  if (value.action === 'import-image' && (typeof value.path !== 'string' || !value.path.trim() || value.path.length > 4096 ||
    typeof value.x !== 'number' || !Number.isFinite(value.x) || Math.abs(value.x) > 10_000_000 ||
    typeof value.y !== 'number' || !Number.isFinite(value.y) || Math.abs(value.y) > 10_000_000 ||
    (value.width !== undefined && (typeof value.width !== 'number' || !Number.isFinite(value.width) || value.width <= 0 || value.width > 100_000))))
    throw new Error('import-image nõuab path, x, y ning soovi korral width (kuni 100000)')
  return value as AgentEdit
}
function validStroke(value: unknown): value is Stroke {
  if (!isRecord(value)) return false
  const tools = ['pen', 'highlighter', 'line', 'rectangle', 'ellipse', 'triangle', 'text', 'image']
  if (typeof value.id !== 'string' || !identifier.test(value.id) || !tools.includes(String(value.tool)) ||
    typeof value.color !== 'string' || !hexColor.test(value.color) ||
    typeof value.size !== 'number' || !Number.isFinite(value.size) || value.size < 0 || value.size > 100 ||
    !Array.isArray(value.points) || value.points.length < 1 || value.points.length > 10000 ||
    !value.points.every((p: unknown) => isRecord(p) && typeof p.x === 'number' && Number.isFinite(p.x) && Math.abs(p.x) <= 10_000_000 &&
      typeof p.y === 'number' && Number.isFinite(p.y) && Math.abs(p.y) <= 10_000_000 &&
      typeof p.pressure === 'number' && Number.isFinite(p.pressure) && p.pressure >= 0 && p.pressure <= 1)) return false
  if (value.groupId !== undefined && (typeof value.groupId !== 'string' || !identifier.test(value.groupId))) return false
  if (value.fill !== undefined && (typeof value.fill !== 'string' || !hexColor.test(value.fill))) return false
  if (value.text !== undefined && (typeof value.text !== 'string' || value.text.length > 2000)) return false
  if (value.radius !== undefined && (typeof value.radius !== 'number' || !Number.isFinite(value.radius) || value.radius < 0 || value.radius > 200)) return false
  if (value.locked !== undefined && typeof value.locked !== 'boolean') return false
  if (value.outlineOnly !== undefined && typeof value.outlineOnly !== 'boolean') return false
  if (value.tool === 'text' && (typeof value.text !== 'string' || value.size < 8)) return false
  if ((value.tool === 'rectangle' || value.tool === 'ellipse' || value.tool === 'line') && value.points.length < 2) return false
  if (value.tool === 'triangle' && value.points.length < 3) return false
  if (value.tool === 'image' && (!validImageSource(value.imageSource) || value.points.length !== 2 ||
    value.points[0].x === value.points[1].x || value.points[0].y === value.points[1].y)) return false
  return true
}
export function applyAgentEdit(all: Stroke[], edit: AgentEdit): Stroke[] {
  if (edit.action === 'import-image') throw new Error('import-image tuleb enne rakendamist pildifailist laadida')
  if (edit.action === 'delete') {
    if (!Array.isArray(edit.ids) || !edit.ids.length || edit.ids.length > 1000 || !edit.ids.every(id => typeof id === 'string' && identifier.test(id)))
      throw new Error('delete nõuab ids massiivi (kuni 1000 ID-d)')
    const ids = new Set(edit.ids as string[])
    if ([...ids].some(id => !all.some(s => s.id === id))) throw new Error('Kustutatavat objekti ei leitud; loe canvas.json uuesti')
    if (all.some(s => ids.has(s.id) && isStrokeLocked(s, all))) throw new Error('Lukustatud objekti ei saa kustutada')
    return all.filter(s => !ids.has(s.id))
  }
  if (!Array.isArray(edit.strokes) || !edit.strokes.length || edit.strokes.length > 1000 || !edit.strokes.every(validStroke))
    throw new Error(`${edit.action} nõuab korrektset strokes massiivi (kuni 1000 objekti)`)
  const incoming = edit.strokes as Stroke[]
  const ids = new Set(incoming.map(s => s.id))
  if (ids.size !== incoming.length) throw new Error('Objektide ID-d peavad olema unikaalsed')
  if (edit.action === 'add') {
    if (all.length + incoming.length > 50000) throw new Error('Lehel on liiga palju objekte')
    if (incoming.some(s => all.some(existing => existing.id === s.id))) throw new Error('ID on juba kasutusel; loo uus UUID')
    if (incoming.some(s => s.groupId && all.some(existing => existing.groupId === s.groupId && isStrokeLocked(existing, all))))
      throw new Error('Lukustatud gruppi ei saa muuta')
    return [...all, ...incoming]
  }
  if (incoming.some(s => !all.some(old => old.id === s.id))) throw new Error('Asendatavat objekti ei leitud; loe canvas.json uuesti')
  if (all.some(s => ids.has(s.id) && isStrokeLocked(s, all))) throw new Error('Lukustatud objekti ei saa muuta')
  return all.map(s => ids.has(s.id) ? incoming.find(item => item.id === s.id)! : s)
}
