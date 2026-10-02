import { useEffect, useState } from 'react'
import type { Stroke } from './canvas'
import { isStrokeLocked } from './locking'
import { resizeSelected, selectionBounds } from './resize'

export function SizeControls({ strokes, selectedIds, onCommit }: { strokes: Stroke[]; selectedIds: string[]; onCommit: (next: Stroke[]) => void }) {
  const bounds = selectionBounds(strokes, selectedIds)
  const width = Math.round((bounds?.right ?? 0) - (bounds?.left ?? 0))
  const height = Math.round((bounds?.bottom ?? 0) - (bounds?.top ?? 0))
  const [w, setW] = useState(String(width))
  const [h, setH] = useState(String(height))
  useEffect(() => { setW(String(width)); setH(String(height)) }, [width, height, selectedIds.join(',')])
  if (!bounds) return null
  const locked = selectedIds.some(id => strokes.some(s => s.id === id && isStrokeLocked(s, strokes)))
  const apply = (axis: 'width' | 'height') => {
    const value = Number(axis === 'width' ? w : h)
    if (!locked && Number.isFinite(value) && value >= 24 && value <= 10_000_000)
      onCommit(resizeSelected(strokes, selectedIds, axis === 'width' ? 'e' : 's', bounds,
        axis === 'width' ? value - width : 0, axis === 'height' ? value - height : 0))
    else { setW(String(width)); setH(String(height)) }
  }
  return <div className="selection-size" title={locked ? 'Suuruse muutmiseks ava kõigepealt lukk' : 'Muuda valitud objekti mõõtmeid pikslites (Enter kinnitab)'}>
    <label>L <input type="number" aria-label="Valitud objekti laius" min="24" max="10000000" disabled={locked} value={w} onChange={e => setW(e.target.value)} onBlur={() => apply('width')} onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur() }} /></label>
    <label>K <input type="number" aria-label="Valitud objekti kõrgus" min="24" max="10000000" disabled={locked} value={h} onChange={e => setH(e.target.value)} onBlur={() => apply('height')} onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur() }} /></label>
    <span>px</span>
  </div>
}
