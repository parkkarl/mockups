import type { Stroke, Point } from './canvas'
import { INK } from './theme.ts'
export type TemplateKind = 'page' | 'calendar' | 'login' | 'card' | 'search' | 'avatar' | 'select' | 'button' | 'input' | 'checkbox' | 'toggle' | 'navbar'
export const templateOptions: { id: TemplateKind; label: string; description: string; width: number; height: number }[] = [
  { id: 'page', label: 'Lehekülje alus', description: 'Tühi brauseriaken aadressiribaga', width: 900, height: 600 },
  { id: 'calendar', label: 'Kalender', description: 'Käesoleva kuu vaade', width: 560, height: 430 },
  { id: 'login', label: 'Sisselogimisvorm', description: 'Sisestusväljad ja nupp', width: 390, height: 390 },
  { id: 'card', label: 'Sisukaart', description: 'Pilt, pealkiri ja kirjeldus', width: 360, height: 290 },
  { id: 'search', label: 'Otsinguväli', description: 'Otsinguikoon ja kohatäide', width: 300, height: 52 },
  { id: 'avatar', label: 'Kasutajaikoon', description: 'Ümmargune profiiliikoon', width: 52, height: 52 },
  { id: 'select', label: 'Valikukast', description: 'Rippmenüü välja makett', width: 270, height: 50 },
  { id: 'button', label: 'Nupp', description: 'Peamine tegevusnupp', width: 170, height: 50 },
  { id: 'input', label: 'Tekstiväli', description: 'Pealkirja ja kohatäitega väli', width: 300, height: 84 },
  { id: 'checkbox', label: 'Märkeruut', description: 'Valik koos tekstiga', width: 270, height: 26 },
  { id: 'toggle', label: 'Lüliti', description: 'Sees/väljas lüliti', width: 82, height: 40 },
  { id: 'navbar', label: 'Päiseriba', description: 'Logo, lingid ja profiilinupp', width: 620, height: 70 },
]
const pt = (x: number, y: number): Point => ({ x, y, pressure: 1 })

export function createTemplate(kind: TemplateKind, x: number, y: number, color: string, date = new Date()): Stroke[] {
  const groupId = crypto.randomUUID()
  const strokes: Stroke[] = []
  const add = (tool: Stroke['tool'], points: Point[], text?: string, size = 3, ink = color, fill?: string, radius?: number) =>
    strokes.push({ id: crypto.randomUUID(), groupId, tool, color: ink, size, points,
      ...(text === undefined ? {} : { text }), ...(fill ? { fill } : {}), ...(radius ? { radius } : {}),
      ...((tool === 'rectangle' || tool === 'ellipse') && !fill ? { outlineOnly: true } : {}) })
  const box = (a: number, b: number, w: number, h: number) => add('rectangle', [pt(x + a, y + b), pt(x + a + w, y + b + h)])
  const line = (ax: number, ay: number, bx: number, by: number) => add('line', [pt(x + ax, y + ay), pt(x + bx, y + by)])
  const label = (text: string, a: number, b: number, size = 17, ink = '#e8f3ee') => add('text', [pt(x + a, y + b)], text, size, ink)
  const outline = (a: number, b: number, w: number, h: number, radius = 5) =>
    add('rectangle', [pt(x + a, y + b), pt(x + a + w, y + b + h)], undefined, 1.8, INK, undefined, radius)
  if (kind === 'page') {
    // Läbipaistev brauseri alus: ükski kuju ei kata selle all olevat joonist.
    const chrome = '#a7c5c5'
    const frame = (a: number, b: number, w: number, h: number, radius = 0) =>
      add('rectangle', [pt(x + a, y + b), pt(x + a + w, y + b + h)], undefined, 1.8, chrome, undefined, radius)
    line(0, 47, 900, 47); line(0, 91, 900, 91)
    frame(96, 10, 128, 37, 9)
    for (const cx of [23, 47, 71]) add('ellipse', [pt(x + cx - 6, y + 18), pt(x + cx + 6, y + 30)], undefined, 1.7, chrome)
    label('Moqups', 111, 22, 16, '#dce9e5')
    add('line', [pt(x + 30, y + 70), pt(x + 17, y + 70)], undefined, 2, chrome)
    add('line', [pt(x + 17, y + 70), pt(x + 23, y + 64)], undefined, 2, chrome)
    add('line', [pt(x + 17, y + 70), pt(x + 23, y + 76)], undefined, 2, chrome)
    add('line', [pt(x + 55, y + 70), pt(x + 68, y + 70)], undefined, 2, chrome)
    add('line', [pt(x + 68, y + 70), pt(x + 62, y + 64)], undefined, 2, chrome)
    add('line', [pt(x + 68, y + 70), pt(x + 62, y + 76)], undefined, 2, chrome)
    label('↻', 91, 56, 24, chrome)
    frame(126, 53, 752, 34, 17)
    add('ellipse', [pt(x + 143, y + 59), pt(x + 155, y + 71)], undefined, 1.5, chrome)
    frame(143, 64, 12, 11, 2)
    label('www.moqups.com', 167, 60, 17, '#dce9e5')
    add('rectangle', [pt(x, y), pt(x + 900, y + 600)], undefined, 2, INK)
  } else if (kind === 'calendar') {
    box(0, 0, 560, 430); line(0, 67, 560, 67)
    const title = new Intl.DateTimeFormat('et-EE', { month: 'long', year: 'numeric' }).format(date)
    label(title.charAt(0).toUpperCase() + title.slice(1), 22, 20, 23)
    label('‹', 489, 15, 27); label('›', 526, 15, 27)
    for (let i = 0; i < 7; i++) {
      label(['E', 'T', 'K', 'N', 'R', 'L', 'P'][i], 32 + i * 80, 81, 16)
      if (i) line(i * 80, 67, i * 80, 430)
    }
    line(0, 117, 560, 117)
    for (let i = 1; i < 6; i++) line(0, 117 + i * 52, 560, 117 + i * 52)
    const first = new Date(date.getFullYear(), date.getMonth(), 1).getDay()
    const offset = (first + 6) % 7
    const days = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
    for (let day = 1; day <= days; day++) {
      const index = offset + day - 1
      label(String(day), 13 + index % 7 * 80, 128 + Math.floor(index / 7) * 52, 15)
    }
  } else if (kind === 'login') {
    box(0, 0, 390, 390)
    label('Tere tulemast', 32, 30, 26)
    label('Logi oma kontole sisse', 32, 76, 16)
    label('E-post', 32, 126, 15); box(32, 152, 326, 46)
    label('Parool', 32, 217, 15); box(32, 243, 326, 46)
    box(32, 314, 326, 51); label('Logi sisse', 138, 327, 18)
  } else if (kind === 'card') {
    box(0, 0, 360, 290); box(16, 16, 328, 143)
    line(16, 159, 344, 16); label('Sisukaardi pealkiri', 18, 176, 20)
    label('Lühike kirjeldus siia…', 18, 211, 15)
    box(18, 246, 112, 29); label('Vaata lisaks', 27, 249, 13)
  } else if (kind === 'search') {
    outline(0, 0, 300, 52, 26)
    add('ellipse', [pt(x + 15, y + 15), pt(x + 32, y + 32)], undefined, 2.5, INK)
    add('line', [pt(x + 29, y + 30), pt(x + 39, y + 40)], undefined, 2.5, INK)
    label('Search', 48, 15, 19, INK)
  } else if (kind === 'avatar') {
    add('ellipse', [pt(x + 4, y + 4), pt(x + 48, y + 48)], undefined, 1.8, INK)
    add('ellipse', [pt(x + 18, y + 13), pt(x + 34, y + 29)], undefined, 1.8, INK)
    add('ellipse', [pt(x + 12, y + 32), pt(x + 40, y + 47)], undefined, 1.8, INK)
  } else if (kind === 'select') {
    outline(0, 0, 270, 50, 6)
    add('line', [pt(x + 233, y + 1), pt(x + 233, y + 49)], undefined, 1.5, INK)
    label('Select', 14, 13, 20, INK)
    add('line', [pt(x + 246, y + 21), pt(x + 252, y + 28), pt(x + 258, y + 21)], undefined, 1.8, INK)
  } else if (kind === 'button') {
    outline(0, 0, 170, 50, 8)
    label('Jätka', 62, 14, 18, INK)
  } else if (kind === 'input') {
    label('Nimi', 3, 0, 16, INK)
    outline(0, 32, 300, 52, 5)
    label('Sisesta nimi…', 15, 48, 18, INK)
  } else if (kind === 'checkbox') {
    outline(0, 2, 22, 22, 4)
    label('Nõustun tingimustega', 34, 3, 16, INK)
  } else if (kind === 'toggle') {
    outline(0, 3, 67, 34, 17)
    add('ellipse', [pt(x + 3, y + 6), pt(x + 30, y + 34)], undefined, 1.8, INK)
  } else if (kind === 'navbar') {
    outline(0, 0, 620, 70, 3)
    label('LOGO', 20, 24, 20, INK)
    label('Avaleht     Teenused     Kontakt', 208, 26, 15, INK)
    add('ellipse', [pt(x + 565, y + 16), pt(x + 603, y + 54)], undefined, 1.5, INK)
    add('ellipse', [pt(x + 577, y + 22), pt(x + 591, y + 36)], undefined, 1.5, INK)
    add('ellipse', [pt(x + 571, y + 39), pt(x + 597, y + 53)], undefined, 1.5, INK)
  }
  return strokes
}
