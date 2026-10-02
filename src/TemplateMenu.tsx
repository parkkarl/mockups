import { Fragment, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { CalendarDays, CheckSquare2, ChevronDown, LayoutTemplate, LogIn, PanelsTopLeft, RectangleEllipsis, Search, UserRound, ListFilter, MousePointerClick, TextCursorInput, ToggleLeft, PanelTop } from 'lucide-react'
import { templateOptions } from './templates'
import type { TemplateKind } from './templates'

const icons: Record<TemplateKind, typeof LayoutTemplate> = {
  page: PanelsTopLeft, calendar: CalendarDays, login: LogIn, card: RectangleEllipsis,
  search: Search, avatar: UserRound, select: ListFilter, button: MousePointerClick,
  input: TextCursorInput, checkbox: CheckSquare2, toggle: ToggleLeft, navbar: PanelTop,
}
export function TemplateMenu({ onInsert, disabled }: { onInsert: (kind: TemplateKind) => void; disabled: boolean }) {
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState({ left: 0, top: 0 })
  const button = useRef<HTMLButtonElement>(null)
  const menu = useRef<HTMLDivElement>(null)
  function toggle() {
    if (!open && button.current) {
      const rect = button.current.getBoundingClientRect()
      setPosition({ left: Math.max(8, Math.min(rect.left, window.innerWidth - 270)), top: Math.min(rect.bottom + 6, window.innerHeight - 260) })
    }
    setOpen(value => !value)
  }
  useEffect(() => {
    if (!open) return
    const outside = (e: PointerEvent) => { if (!button.current?.contains(e.target as Node) && !menu.current?.contains(e.target as Node)) setOpen(false) }
    const escape = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOpen(false); button.current?.focus() } }
    const scroll = () => setOpen(false)
    document.addEventListener('pointerdown', outside); document.addEventListener('keydown', escape); window.addEventListener('scroll', scroll, true)
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape); window.removeEventListener('scroll', scroll, true) }
  }, [open])
  return <>
    <button type="button" ref={button} className={`template-trigger ${open ? 'open' : ''}`} aria-label="Valmiskujundid" aria-expanded={open} aria-haspopup="menu" disabled={disabled} onClick={toggle} title="Lisa valmis kujund aktiivsele joonisele"><LayoutTemplate size={18} /><span>Valmiskujundid</span><ChevronDown size={14} /></button>
    {open && createPortal(<div ref={menu} id="template-menu" role="menu" className="template-menu" style={position}>
      <div className="template-menu-heading">LISA JOONISELE</div>
      {templateOptions.map(option => { const Icon = icons[option.id]; return <Fragment key={option.id}>
        {option.id === 'search' && <div className="template-menu-heading template-section">KOMPONENDID</div>}
        <button type="button" role="menuitem" onClick={() => { onInsert(option.id); setOpen(false) }}>
          <span className="template-option-icon"><Icon size={19} /></span><span><strong>{option.label}</strong><small>{option.description}</small></span>
        </button>
      </Fragment> })}
    </div>, document.body)}
  </>
}
