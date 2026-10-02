import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown, ChevronRight, Copy, FilePlus2, FilePenLine, Files, FolderOpen, PanelLeftClose, PanelLeftOpen, Plus, StickyNote, Trash2, X } from 'lucide-react'
import type { Stroke } from './canvas'

export type Page = { id: string; title: string; parentId: string | null; strokes: Stroke[]; notes?: string }
type Props = {
  pages: Page[]; activeId: string; onSelect: (id: string) => void
  onAdd: (parentId: string | null) => void; onCopy: (id: string) => void; onRename: (id: string, title: string) => void; onDelete: (id: string) => void
  onNoteChange: (id: string, notes: string) => void
  editingId: string | null; setEditingId: (id: string | null) => void
  minimized: boolean; onToggleMinimized: () => void
}
export function PageTree({ pages, activeId, onSelect, onAdd, onCopy, onRename, onDelete, onNoteChange, editingId, setEditingId, minimized, onToggleMinimized }: Props) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [noteOpen, setNoteOpen] = useState<{ id: string; left: number; top: number } | null>(null)
  const popoverRef = useRef<HTMLDivElement>(null)
  const noteInputRef = useRef<HTMLTextAreaElement>(null)
  useEffect(() => { if (noteOpen && (minimized || !pages.some(page => page.id === noteOpen.id))) setNoteOpen(null) }, [noteOpen, minimized, pages])
  useEffect(() => {
    if (!noteOpen) return
    noteInputRef.current?.focus()
    const onPointerDown = (event: PointerEvent) => {
      if (!popoverRef.current?.contains(event.target as Node) && !(event.target as Element).closest('.page-note-button')) setNoteOpen(null)
    }
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') { event.stopPropagation(); setNoteOpen(null) } }
    window.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('keydown', onKeyDown, true)
    return () => { window.removeEventListener('pointerdown', onPointerDown); window.removeEventListener('keydown', onKeyDown, true) }
  }, [noteOpen?.id])
  function toggleNotes(id: string, button: HTMLButtonElement) {
    const rect = button.getBoundingClientRect()
    setNoteOpen(open => open?.id === id ? null : { id, left: Math.min(rect.right + 12, window.innerWidth - 340), top: Math.max(8, Math.min(rect.top - 8, window.innerHeight - 264)) })
  }
  function toggle(id: string) {
    setCollapsed(current => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next })
  }
  function rows(parentId: string | null, depth: number): React.ReactNode {
    if (depth > 20) return null
    return pages.filter(page => page.parentId === parentId).map(page => {
      const children = pages.some(child => child.parentId === page.id)
      return <div key={page.id}>
        <div className={`page-row ${page.id === activeId ? 'current' : ''}`} style={{ paddingLeft: 7 + depth * 16 }}>
          <button className="tree-chevron" aria-label={children ? (collapsed.has(page.id) ? 'Ava alamlehed' : 'Peida alamlehed') : 'Alamlehti pole'} disabled={!children} onClick={() => toggle(page.id)}>{children ? collapsed.has(page.id) ? <ChevronRight size={13} /> : <ChevronDown size={13} /> : null}</button>
          <button type="button" className={`page-note-button ${page.notes?.trim() ? 'has-notes' : ''}`} title={page.notes?.trim() ? 'Ava lehe märkmed' : 'Lisa lehe märkmed'} aria-label={`Märkmed: ${page.title}`} aria-expanded={noteOpen?.id === page.id} onClick={e => toggleNotes(page.id, e.currentTarget)}><StickyNote size={14} fill={page.notes?.trim() ? 'currentColor' : 'none'} /></button>
          <div className="page-name" role="treeitem" tabIndex={0} aria-selected={page.id === activeId} title={page.title}
            onClick={() => onSelect(page.id)} onDoubleClick={() => setEditingId(page.id)}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(page.id) } if (e.key === 'F2') setEditingId(page.id) }}><FilePenLine size={15} />
            {editingId === page.id ? <input autoFocus aria-label="Lehe nimi" defaultValue={page.title} maxLength={80}
              onClick={e => e.stopPropagation()} onFocus={e => e.currentTarget.select()}
              onKeyDown={e => { e.stopPropagation(); if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') { e.currentTarget.value = page.title; e.currentTarget.blur() } }}
              onBlur={e => { onRename(page.id, e.currentTarget.value); setEditingId(null) }} />
              : <span>{page.title}</span>}</div>
          <div className="page-actions">
            <button title="Lisa alamleht" aria-label={`Lisa alamleht lehele ${page.title}`} onClick={() => { if (collapsed.has(page.id)) toggle(page.id); onAdd(page.id) }}><Plus size={14} /></button>
            <button title="Kopeeri leht alamleheks" aria-label={`Kopeeri leht ${page.title} alamleheks`} onClick={() => { if (collapsed.has(page.id)) toggle(page.id); onCopy(page.id) }}><Copy size={13} /></button>
            <button title="Kustuta leht" aria-label={`Kustuta leht ${page.title}`} disabled={pages.length === 1} onClick={() => onDelete(page.id)}><Trash2 size={13} /></button>
          </div>
        </div>
        {children && !collapsed.has(page.id) && rows(page.id, depth + 1)}
      </div>
    })
  }
  return <nav className={`page-tree ${minimized ? 'minimized' : ''}`} aria-label="Jooniste failipuu">
    <div className="tree-heading"><span>JOONISED</span><div className="tree-heading-actions">
      {!minimized && <button title="Lisa uus leht" aria-label="Lisa uus leht" onClick={() => onAdd(null)}><FilePlus2 size={17} /></button>}
      <button title={minimized ? 'Ava failipuu' : 'Peida failipuu'} aria-label={minimized ? 'Ava failipuu' : 'Peida failipuu'} aria-expanded={!minimized} onClick={onToggleMinimized}>
        {minimized ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}</button>
    </div></div>
    <div className="tree-project"><FolderOpen size={16} /><strong>Minu projekt</strong><span>{pages.length}</span></div>
    <div className="tree-rows" onScroll={() => setNoteOpen(null)}>{rows(null, 0)}</div>
    <button className="tree-new" onClick={() => onAdd(null)}><Plus size={15} /> Uus leht</button>
    <div className="tree-footer"><Files size={14} /> {pages.length} {pages.length === 1 ? 'joonis' : 'joonist'}</div>
    {noteOpen && pages.some(page => page.id === noteOpen.id) && createPortal(<div className="page-notes-popover" ref={popoverRef} role="dialog" aria-label={`Lehe märkmed: ${pages.find(page => page.id === noteOpen.id)!.title}`} style={{ left: noteOpen.left, top: noteOpen.top }}>
      <div className="page-notes-heading"><strong>{pages.find(page => page.id === noteOpen.id)!.title}</strong><button type="button" aria-label="Sulge märkmed" onClick={() => setNoteOpen(null)}><X size={16} /></button></div>
      <textarea ref={noteInputRef} aria-label="Lehe märkmed" placeholder="Kirjuta selle lehe kohta märkmeid…" value={pages.find(page => page.id === noteOpen.id)!.notes ?? ''} maxLength={10000} onChange={e => onNoteChange(noteOpen.id, e.target.value)} />
      <small>Salvestatakse automaatselt</small>
    </div>, document.querySelector('.app')!)}
  </nav>
}
