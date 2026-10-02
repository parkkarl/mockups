import type { Stroke } from './canvas'

export const MAX_IMAGE_BYTES = 8_000_000
export function validImageSource(value: unknown): value is string {
  return typeof value === 'string' && value.length <= 11_000_000 && /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(value)
}
const cache = new Map<string, Promise<HTMLImageElement>>()
const ready = new Map<string, HTMLImageElement>()
export function loadImage(source: string): Promise<HTMLImageElement> {
  if (!validImageSource(source)) return Promise.reject(new Error('Oodati PNG-, JPG- või WebP-pilti (kuni 8 MB)'))
  if (!cache.has(source)) cache.set(source, new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => {
      if (image.naturalWidth * image.naturalHeight > 40_000_000) { reject(new Error('Pildil on liiga palju piksleid (max 40 miljonit)')); return }
      ready.set(source, image); resolve(image)
    }
    image.onerror = () => reject(new Error('Pildi avamine ebaõnnestus'))
    image.src = source
  }))
  return cache.get(source)!
}
export function cachedImage(source: string): HTMLImageElement | undefined { return ready.get(source) }
export async function prepareImages(strokes: Stroke[]): Promise<void> {
  await Promise.all(strokes.filter(s => s.tool === 'image' && s.imageSource).map(s => loadImage(s.imageSource!)))
}
export async function imageStroke(source: string, x: number, y: number, width?: number): Promise<Stroke> {
  const image = await loadImage(source)
  const w = width ?? image.naturalWidth
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(w) || w <= 0 || w > 100_000) throw new Error('Vigane pildi asukoht või laius')
  return { id: crypto.randomUUID(), tool: 'image', color: '#111111', size: 0, imageSource: source,
    points: [{ x, y, pressure: 1 }, { x: x + w, y: y + w * image.naturalHeight / image.naturalWidth, pressure: 1 }] }
}
export async function fileImageSource(file: File): Promise<string> {
  if (file.size > MAX_IMAGE_BYTES) throw new Error('Pilt peab olema kuni 8 MB')
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Pildifaili lugemine ebaõnnestus'))
    reader.onload = () => validImageSource(reader.result) ? resolve(reader.result) : reject(new Error('Vali PNG-, JPG- või WebP-pilt'))
    reader.readAsDataURL(file)
  })
}
