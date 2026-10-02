import { useEffect, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { createRoot } from 'react-dom/client'
import { invoke, isTauri } from '@tauri-apps/api/core'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { Circle, Download, ImagePlus, Eraser, Highlighter, Lock, LockOpen, Magnet, MousePointer2, PanelRightOpen, PenLine, PenTool, Moon, Sun, RectangleHorizontal, Redo2, Shapes, Slash, Trash2, Undo2 } from 'lucide-react'
import { Canvas, paintViewport } from './canvas'
import type { Stroke, Tool } from './canvas'
import { TerminalPanel } from './TerminalPanel'
import { TemplateMenu } from './TemplateMenu'
import { clearUnlocked, deleteSelectedUnlocked, isStrokeLocked, lockTargets, toggleSelectionLock } from './locking'
import { exportArea } from './export-area'
import type { Viewport } from './viewport'
import { SizeControls } from './SizeControls'
import { createTemplate, templateOptions } from './templates'
import type { TemplateKind } from './templates'
import { PageTree } from './PageTree'
import { clonePage, insertCopyBelow } from './page-copy'
import { withPageNotes } from './page-notes'
import { fileImageSource, imageStroke, prepareImages } from './images'
import { cloneStrokes, snapshotSelection } from './object-copy'
import { ungroupableIds, ungroupSelected } from './ungroup'
import { applyAgentEdit, parseAgentEdit } from './agent-commands'
import { isFullscreenShortcut } from './fullscreen'
import { displayColor, INK } from './theme'
import type { Theme } from './theme'
import type { Page } from './PageTree'
import './style.css'
import './page-tree.css'
import './panels.css'
import './templates.css'
import './theme.css'
import './page-notes.css'
import { TOOL_KEYS, TOGGLE_KEYS, toolForShortcut, toggleForShortcut } from './tool-shortcuts'

const colors = [INK, '#747474', '#f59e0b', '#ef6a76', '#ab754e', '#bababa']
async function exportCanvas(strokes: Stroke[], theme: Theme): Promise<HTMLCanvasElement> {
  await prepareImages(strokes)
  const area = exportArea(strokes)
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.floor(area.width * area.scale))
  canvas.height = Math.max(1, Math.floor(area.height * area.scale))
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Lõuend puudub')
  paintViewport(ctx, strokes, null, canvas.width, canvas.height, { x: area.x, y: area.y, zoom: area.scale }, theme)
  return canvas
}

const tools: { id: Tool; label: string; icon: typeof PenLine; key: string }[] = [
  { id: 'select', label: 'Vali', icon: MousePointer2, key: TOOL_KEYS.select },
  { id: 'pen', label: 'Pliiats', icon: PenLine, key: TOOL_KEYS.pen },
  { id: 'highlighter', label: 'Marker', icon: Highlighter, key: TOOL_KEYS.highlighter },
  { id: 'eraser', label: 'Kustukumm', icon: Eraser, key: TOOL_KEYS.eraser },
  { id: 'line', label: 'Joon', icon: Slash, key: TOOL_KEYS.line },
  { id: 'rectangle', label: 'Ristkülik', icon: RectangleHorizontal, key: TOOL_KEYS.rectangle },
  { id: 'ellipse', label: 'Ellips', icon: Circle, key: TOOL_KEYS.ellipse },
]
function App() {
  const [pages, setPages] = useState<Page[]>(() => [{ id: crypto.randomUUID(), title: 'Esimene joonis', parentId: null, strokes: [] }])
  const [activeId, setActiveId] = useState(() => pages[0].id)
  const strokes = pages.find(page => page.id === activeId)?.strokes ?? []
  const current = useRef<Stroke[]>([])
  const past = useRef(new Map<string, Stroke[][]>())
  const future = useRef(new Map<string, Stroke[][]>())
  const dirtyPages = useRef(new Set<string>())
  const saveQueue = useRef<Promise<unknown>>(Promise.resolve())
  const activeIdRef = useRef(activeId)
  activeIdRef.current = activeId
  const agentPollBusy = useRef(false)
  const agentPendingResults = useRef(new Map<string, string>())
  const [editingId, setEditingId] = useState<string | null>(null)
  const [treeMinimized, setTreeMinimized] = useState(() => localStorage.getItem('tree-minimized') === 'yes')
  const [terminalMinimized, setTerminalMinimized] = useState(() => localStorage.getItem('terminal-minimized') === 'yes')
  const [terminalWidth, setTerminalWidth] = useState(() => {
    const saved = Number(localStorage.getItem('terminal-width'))
    return Number.isFinite(saved) && saved >= 260 ? saved : Math.round(window.innerWidth * .34)
  })
  const [viewportWidth, setViewportWidth] = useState(() => Math.max(900, window.innerWidth))
  const draggingDivider = useRef<{ x: number; width: number } | null>(null)
  useEffect(() => {
    const onFullscreenKey = (event: KeyboardEvent) => {
      if (event.key !== 'F11' || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return
      event.preventDefault()
      event.stopPropagation() // ka siis, kui fookus on terminalis
      if (!isFullscreenShortcut(event)) return
      if (isTauri()) {
        const window = getCurrentWindow()
        void window.isFullscreen().then(fullscreen => window.setFullscreen(!fullscreen)).catch(console.error)
      } else {
        const toggle = document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen()
        void toggle.catch(console.error)
      }
    }
    window.addEventListener('keydown', onFullscreenKey, true)
    return () => window.removeEventListener('keydown', onFullscreenKey, true)
  }, [])
  useEffect(() => {
    const resize = () => setViewportWidth(Math.max(900, window.innerWidth))
    window.addEventListener('resize', resize); return () => window.removeEventListener('resize', resize)
  }, [])
  useEffect(() => { localStorage.setItem('tree-minimized', treeMinimized ? 'yes' : 'no') }, [treeMinimized])
  useEffect(() => { localStorage.setItem('terminal-minimized', terminalMinimized ? 'yes' : 'no') }, [terminalMinimized])
  useEffect(() => { localStorage.setItem('terminal-width', String(terminalWidth)) }, [terminalWidth])
  const maxTerminalWidth = Math.max(260, viewportWidth - (treeMinimized ? 42 : viewportWidth <= 1100 ? 180 : 205) - 310)
  const visibleTerminalWidth = Math.max(260, Math.min(terminalWidth, maxTerminalWidth))
  const [, setHistoryVersion] = useState(0)
  const [tool, setTool] = useState<Tool>('pen')
  const [temporarySelect, setTemporarySelect] = useState(false)
  const displayedTool = temporarySelect ? 'select' : tool
  const [automaticShapes, setAutomaticShapes] = useState(() => localStorage.getItem('automatic-shapes') !== 'off')
  useEffect(() => { localStorage.setItem('automatic-shapes', automaticShapes ? 'on' : 'off') }, [automaticShapes])
  const [autoSnap, setAutoSnap] = useState(() => localStorage.getItem('auto-snap') !== 'off')
  useEffect(() => { localStorage.setItem('auto-snap', autoSnap ? 'on' : 'off') }, [autoSnap])
  const [penOnly, setPenOnly] = useState(() => localStorage.getItem('pen-only') === 'on')
  useEffect(() => { localStorage.setItem('pen-only', penOnly ? 'on' : 'off') }, [penOnly])
  const [theme, setTheme] = useState<Theme>(() => localStorage.getItem('theme') === 'dark' ? 'dark' : 'light')
  useEffect(() => { localStorage.setItem('theme', theme) }, [theme])
  const savedTheme = useRef(theme)
  const [color, setColor] = useState(colors[0])
  const [size, setSize] = useState(4)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const objectClipboard = useRef<Stroke[] | null>(null)
  const pasteCount = useRef(0)
  const selectedTargets = lockTargets(strokes, selectedIds)
  const canUngroup = ungroupableIds(strokes, selectedIds).size > 0
  const allSelectedLocked = selectedTargets.length > 0 && selectedTargets.every(item => isStrokeLocked(item, strokes))
  const hasUnlocked = strokes.some(item => !isStrokeLocked(item, strokes))
  const [loaded, setLoaded] = useState(false)
  const [saveStatus, setSaveStatus] = useState('Laadimine…')
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const viewportRef = useRef<Viewport>({ x: 0, y: 0, zoom: 1 })
  const imageInputRef = useRef<HTMLInputElement>(null)
  const templateCount = useRef(0)
  const sequence = useRef(0)
  useEffect(() => {
    if (!isTauri()) { setLoaded(true); setSaveStatus('Brauseri eelvaade'); return }
    void (async () => {
      try {
        const saved = await invoke<string | null>('load_pages')
        if (saved) {
          const data = JSON.parse(saved) as { pages: Page[]; activeId: string }
          if (!Array.isArray(data.pages) || !data.pages.length || !data.pages.some(page => page.id === data.activeId)) throw new Error('Vigane projektifail')
          setPages(data.pages); setActiveId(data.activeId)
          if (localStorage.getItem('saved-theme') !== theme || localStorage.getItem('saved-style-version') !== '4') data.pages.forEach(page => dirtyPages.current.add(page.id))
          current.current = data.pages.find(page => page.id === data.activeId)!.strokes
        } else {
          const legacy = await invoke<string | null>('load_canvas')
          const initial = pages[0]
          const old: unknown = legacy ? JSON.parse(legacy) : []
          const first = { ...initial, strokes: Array.isArray(old) ? old as Stroke[] : [] }
          setPages([first]); current.current = first.strokes
          dirtyPages.current.add(first.id)
        }
        setSaveStatus('Salvestatud')
        setLoaded(true)
      } catch (e) { setSaveStatus(`Laadimise viga: ${e}`) }
    })()
  }, [])
  useEffect(() => {
    if (!loaded || !isTauri()) return
    const id = ++sequence.current
    if (savedTheme.current !== theme) {
      pages.forEach(page => dirtyPages.current.add(page.id))
      savedTheme.current = theme
    }
    setSaveStatus('Salvestamine…')
    const timer = window.setTimeout(() => {
      const dirty = new Set([...dirtyPages.current, activeId])
      dirtyPages.current.clear()
      saveQueue.current = saveQueue.current.catch(() => {}).then(async () => {
        const images = await Promise.all(pages.filter(page => dirty.has(page.id)).map(async page => ({ id: page.id, image: (await exportCanvas(page.strokes, theme)).toDataURL('image/png') })))
        return invoke('save_pages', { document: JSON.stringify({ pages, activeId }), images })
      })
      void saveQueue.current.then(() => { if (sequence.current === id) { setSaveStatus('Salvestatud'); localStorage.setItem('saved-theme', theme); localStorage.setItem('saved-style-version', '4') } })
        .catch(e => { dirty.forEach(pageId => dirtyPages.current.add(pageId)); if (sequence.current === id) setSaveStatus(`Salvestamise viga: ${e}`) })
    }, 450)
    return () => window.clearTimeout(timer)
  }, [pages, activeId, loaded, theme])
  useEffect(() => {
    if (!loaded || !isTauri()) return
    let stopped = false
    async function poll() {
      if (agentPollBusy.current || stopped) return
      agentPollBusy.current = true
      try {
        const requests = await invoke<{ name: string; content: string }[]>('read_agent_commands')
        for (const request of requests) {
          if (stopped || activeIdRef.current !== activeId) break
          let result = agentPendingResults.current.get(request.name)
          if (!result) {
            try {
              const edit = parseAgentEdit(request.content)
              if (edit.pageId !== activeId) throw new Error('Leht pole enam aktiivne; vaata project.json ja saada käsk uuesti')
              let resolved = edit
              if (edit.action === 'import-image') {
                const source = await invoke<string>('import_image_file', { path: edit.path })
                const image = await imageStroke(source, edit.x!, edit.y!, edit.width)
                resolved = { pageId: edit.pageId, action: 'add', strokes: [image] }
              } else if (Array.isArray(edit.strokes)) await prepareImages(edit.strokes as Stroke[])
              if (stopped || activeIdRef.current !== edit.pageId) throw new Error('Leht muutus pildi laadimise ajal; saada käsk uuesti')
              const before = current.current
              const next = applyAgentEdit(before, resolved)
              commit(next)
              setSelectedIds([])
              result = JSON.stringify({ ok: true, pageId: activeId, action: edit.action, message: 'Rakendatud; oota automaatsalvestust enne canvas.png uuesti lugemist' })
            } catch (error) { result = JSON.stringify({ ok: false, error: String(error) }) }
            agentPendingResults.current.set(request.name, result)
          }
          await invoke('finish_agent_command', { name: request.name, result })
          agentPendingResults.current.delete(request.name)
        }
      } catch (error) { console.error('Agendi käskude lugemise viga:', error) }
      finally { agentPollBusy.current = false }
    }
    void poll()
    const timer = window.setInterval(() => { void poll() }, 700)
    return () => { stopped = true; window.clearInterval(timer) }
  }, [loaded, activeId])
  function setPageStrokes(next: Stroke[]) {
    current.current = next; dirtyPages.current.add(activeId)
    setPages(all => all.map(page => page.id === activeId ? { ...page, strokes: next } : page))
    setHistoryVersion(v => v + 1)
  }
  function commit(next: Stroke[]) {
    if (JSON.stringify(next) === JSON.stringify(current.current)) return
    const history = past.current.get(activeId) ?? []
    history.push(current.current); if (history.length > 60) history.shift()
    past.current.set(activeId, history); future.current.set(activeId, [])
    setPageStrokes(next)
  }
  function undo() {
    const prev = past.current.get(activeId)?.pop(); if (!prev) return
    const redo = future.current.get(activeId) ?? []
    redo.push(current.current); future.current.set(activeId, redo)
    setPageStrokes(prev); setSelectedIds([])
  }
  function redo() {
    const next = future.current.get(activeId)?.pop(); if (!next) return
    const history = past.current.get(activeId) ?? []
    history.push(current.current); past.current.set(activeId, history)
    setPageStrokes(next); setSelectedIds([])
  }
  function selectPage(id: string) {
    const page = pages.find(p => p.id === id); if (!page) return
    current.current = page.strokes; setActiveId(id); setSelectedIds([])
  }
  function addPage(parentId: string | null) {
    if (pages.length >= 200) { window.alert('Ühes projektis saab olla kuni 200 lehte.'); return }
    const page: Page = { id: crypto.randomUUID(), parentId, title: 'Uus leht', strokes: [] }
    dirtyPages.current.add(page.id)
    setPages(all => [...all, page]); current.current = []; setActiveId(page.id); setSelectedIds([]); setEditingId(page.id)
  }
  function copyPage(id: string) {
    const source = pages.find(page => page.id === id)
    if (!source) return
    if (pages.length >= 200) { window.alert('Ühes projektis saab olla kuni 200 lehte.'); return }
    const copy = clonePage(source)
    dirtyPages.current.add(copy.id)
    setPages(all => insertCopyBelow(all, id, copy))
    current.current = copy.strokes; setActiveId(copy.id); setSelectedIds([]); setEditingId(null)
  }
  function renamePage(id: string, title: string) {
    const name = title.trim().slice(0, 80)
    if (name) setPages(all => all.map(p => p.id === id ? { ...p, title: name } : p))
  }
  function updatePageNotes(id: string, notes: string) {
    setPages(all => withPageNotes(all, id, notes))
  }
  function deletePage(id: string) {
    const descendants = new Set([id])
    let changed = true
    while (changed) { changed = false; for (const page of pages) if (page.parentId && descendants.has(page.parentId) && !descendants.has(page.id)) { descendants.add(page.id); changed = true } }
    if (pages.length === descendants.size || !window.confirm(`Kustuta ${descendants.size} ${descendants.size === 1 ? 'leht' : 'lehte'} koos joonistega?`)) return
    const remaining = pages.filter(p => !descendants.has(p.id))
    for (const removed of descendants) { past.current.delete(removed); future.current.delete(removed); dirtyPages.current.delete(removed) }
    setPages(remaining)
    if (descendants.has(activeId)) { current.current = remaining[0].strokes; setActiveId(remaining[0].id); setSelectedIds([]) }
  }
  function addObjectCopies(source: Stroke[], offset: number) {
    if (!source.length) return
    const copies = cloneStrokes(source, offset, offset)
    commit([...current.current, ...copies])
    setSelectedIds(copies.map(item => item.id))
    setTool('select')
  }
  function duplicateSelected() {
    addObjectCopies(snapshotSelection(current.current, selectedIds), 24)
  }
  function splitSelectedGroups() {
    const next = ungroupSelected(current.current, selectedIds)
    if (next.every((stroke, i) => stroke === current.current[i])) return
    commit(next); setSelectedIds([]); setTool('select')
  }
  function copySelectedToClipboard() {
    objectClipboard.current = snapshotSelection(current.current, selectedIds)
    pasteCount.current = 0
  }
  function pasteObjects() {
    if (!objectClipboard.current?.length) return
    pasteCount.current = pasteCount.current % 8 + 1
    addObjectCopies(objectClipboard.current, pasteCount.current * 24)
  }
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      if (target.closest('.terminal-panel, input, textarea, [contenteditable]')) return
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); if (e.shiftKey) redo(); else undo(); return }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); return }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c' && selectedIds.length) { e.preventDefault(); copySelectedToClipboard(); return }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v' && objectClipboard.current?.length) { e.preventDefault(); pasteObjects(); return }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'g' && canUngroup) { e.preventDefault(); splitSelectedGroups(); return }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd' && selectedIds.length) { e.preventDefault(); duplicateSelected(); return }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedIds.length) {
        const next = deleteSelectedUnlocked(current.current, selectedIds)
        if (next.length !== current.current.length) { commit(next); setSelectedIds([]) }
        return
      }
      if (e.ctrlKey || e.metaKey || e.altKey) return
      const toggle = toggleForShortcut(e)
      if (toggle) {
        e.preventDefault()
        if (toggle === 'automaticShapes') setAutomaticShapes(value => !value)
        if (toggle === 'autoSnap') setAutoSnap(value => !value)
        if (toggle === 'penOnly') setPenOnly(value => !value)
        return
      }
      const shortcutTool = toolForShortcut(e)
      if (shortcutTool) { e.preventDefault(); setTool(shortcutTool) }
    }
    window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey)
  })
  async function download() {
    try {
      const a = document.createElement('a'); a.href = (await exportCanvas(current.current, theme)).toDataURL('image/png'); a.download = 'mockup.png'; a.click()
    } catch (error) { window.alert(`Pildi eksport ebaõnnestus: ${error}`) }
  }
  async function importImage(file: File) {
    const pageId = activeIdRef.current
    try {
      const source = await fileImageSource(file)
      const view = viewportRef.current
      const image = await imageStroke(source, view.x + 40 / view.zoom, view.y + 40 / view.zoom)
      if (activeIdRef.current !== pageId) throw new Error('Leht muutus; proovi uuesti')
      commit([...current.current, image]); setSelectedIds([image.id]); setTool('select')
    } catch (error) { window.alert(`Pildi import ebaõnnestus: ${error}`) }
  }
  function insertTemplate(kind: TemplateKind) {
    const option = templateOptions.find(item => item.id === kind)!
    const view = viewportRef.current
    const offset = templateCount.current++ % 5 * 24
    const x = view.x + ((canvasRef.current?.clientWidth ?? 850) / view.zoom - option.width) / 2 + offset
    const y = view.y + ((canvasRef.current?.clientHeight ?? 700) / view.zoom - option.height) / 2 + offset
    const items = createTemplate(kind, Math.round(x), Math.round(y), color)
    commit([...current.current, ...items])
    setSelectedIds([])
    setTool('select')
  }
  function startDividerDrag(e: ReactPointerEvent<HTMLDivElement>) {
    if (e.button !== 0) return
    e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId)
    draggingDivider.current = { x: e.clientX, width: visibleTerminalWidth }
    document.body.style.userSelect = 'none'; document.body.style.cursor = 'col-resize'
  }
  function moveDivider(e: ReactPointerEvent<HTMLDivElement>) {
    if (!draggingDivider.current) return
    setTerminalWidth(Math.max(260, Math.min(maxTerminalWidth, draggingDivider.current.width + draggingDivider.current.x - e.clientX)))
  }
  function stopDividerDrag(e: ReactPointerEvent<HTMLDivElement>) {
    draggingDivider.current = null
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId)
    document.body.style.userSelect = ''; document.body.style.cursor = ''
  }
  return <div className="app" data-theme={theme}>
    <main className="split">
      <PageTree pages={pages} activeId={activeId} onSelect={selectPage} onAdd={addPage} onCopy={copyPage} onRename={renamePage} onDelete={deletePage} onNoteChange={updatePageNotes} editingId={editingId} setEditingId={setEditingId} minimized={treeMinimized} onToggleMinimized={() => setTreeMinimized(value => !value)} />
      <section className="workspace">
        <div className="toolbar" aria-label="Joonistustööriistad">
          <div className="tool-group">{tools.slice(0, 4).map(({ id, label, icon: Icon, key }) => <button key={id} title={`${label} (${key})`} aria-label={label} aria-pressed={displayedTool === id} onClick={() => setTool(id)} className={`tool-button ${displayedTool === id ? 'active' : ''}`}><Icon size={19} /></button>)}</div>
          <button title={allSelectedLocked ? 'Ava valitud objektide lukk' : 'Lukusta valitud objektid'} aria-label={allSelectedLocked ? 'Ava valitud objektide lukk' : 'Lukusta valitud objektid'} aria-pressed={allSelectedLocked} className={`tool-button ${allSelectedLocked ? 'locked-button' : ''}`} disabled={!selectedTargets.length} onClick={() => commit(toggleSelectionLock(current.current, selectedIds))}>{allSelectedLocked ? <LockOpen size={18} /> : <Lock size={18} />}</button>
          <span className="tool-divider" />
          <div className="tool-group">{tools.slice(4).map(({ id, label, icon: Icon, key }) => <button key={id} title={`${label} (${key})`} aria-label={label} aria-pressed={displayedTool === id} onClick={() => setTool(id)} className={`tool-button ${displayedTool === id ? 'active' : ''}`}><Icon size={19} /></button>)}</div>
          <span className="tool-divider" />
          <TemplateMenu onInsert={insertTemplate} disabled={!loaded} />
          <button type="button" title="Impordi pilt (PNG, JPG, WebP)" aria-label="Impordi pilt" className="tool-button" disabled={!loaded} onClick={() => imageInputRef.current?.click()}><ImagePlus size={19} /></button>
          <input ref={imageInputRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={e => { const file = e.currentTarget.files?.[0]; e.currentTarget.value = ''; if (file) void importImage(file) }} />
          <span className="tool-divider" />
          <button type="button" className={`auto-shapes ${automaticShapes ? 'enabled' : ''}`} aria-label="Automaatsed kujundid" aria-pressed={automaticShapes} title={`Automaatkujud (${TOGGLE_KEYS.automaticShapes}) — muuda pliiatsiga joonistatud jooned ja kujundid korrapäraseks`} onClick={() => setAutomaticShapes(value => !value)}><Shapes size={18} /></button>
          <button type="button" className={`auto-shapes ${autoSnap ? 'enabled' : ''}`} aria-label="Magnetiline haakumine" aria-pressed={autoSnap} title={`Autosnap (${TOGGLE_KEYS.autoSnap}) — ühenda ristkülikute servad ja joonte otsad`} onClick={() => setAutoSnap(value => !value)}><Magnet size={18} /></button>
          <button type="button" className={`auto-shapes ${penOnly ? 'enabled' : ''}`} aria-label="Ainult pliiats" aria-pressed={penOnly} title={`Ainult pliiats (${TOGGLE_KEYS.penOnly}) — hiir valib või kirjutab, joonistada saab vaid puutepliiatsiga`} onClick={() => setPenOnly(value => !value)}><PenTool size={18} /></button>
          <span className="tool-divider" />
          <div className="colors">{colors.map(c => <button key={c} className={`swatch ${color === c ? 'chosen' : ''}`} style={{ '--swatch': displayColor(c, theme) } as React.CSSProperties} title={`Värv ${c}`} aria-label={`Värv ${c}`} onClick={() => { setColor(c); if (tool === 'eraser' || tool === 'select' || tool === 'hand') setTool('pen') }} />)}</div>
          <span className="tool-divider" />
          <label className="size-control" title={`Joone paksus: ${size}`}><span className="size-dot" style={{ width: Math.max(5, size), height: Math.max(5, size) }} /><input aria-label="Joone paksus" type="range" min="2" max="24" value={size} onChange={e => setSize(Number(e.target.value))} /><span>{size}px</span></label>
          <div className="toolbar-spacer" />
          <button type="button" title={theme === 'light' ? 'Lülita tumedale teemale' : 'Lülita heledale teemale'} aria-label={theme === 'light' ? 'Tume teema' : 'Hele teema'} aria-pressed={theme === 'dark'} className="tool-button theme-toggle" onClick={() => setTheme(value => value === 'light' ? 'dark' : 'light')}>{theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}</button>
          <button title="Ekspordi aktiivne leht PNG-na" aria-label="Ekspordi PNG" className="tool-button" onClick={download}><Download size={18} /></button>
          <button title="Võta tagasi (Ctrl+Z)" aria-label="Võta tagasi" className="tool-button" disabled={!past.current.get(activeId)?.length} onClick={undo}><Undo2 size={18} /></button>
          <button title="Tee uuesti (Ctrl+Y)" aria-label="Tee uuesti" className="tool-button" disabled={!future.current.get(activeId)?.length} onClick={redo}><Redo2 size={18} /></button>
          <button title="Eemalda lukustamata objektid" aria-label="Eemalda lukustamata objektid" className="tool-button danger" disabled={!hasUnlocked} onClick={() => { if (window.confirm('Kas eemaldada kõik lukustamata objektid? Lukus objektid jäävad alles.')) { commit(clearUnlocked(current.current)); setSelectedIds([]) } }}><Trash2 size={17} /></button>
        </div>
        <div className="canvas-frame" onDragOver={e => { if (e.dataTransfer.types.includes('Files')) e.preventDefault() }} onDrop={e => { e.preventDefault(); const file = e.dataTransfer.files[0]; if (file && loaded) void importImage(file) }}><Canvas key={activeId} strokes={strokes} onCommit={commit} tool={tool} color={color} size={size} selectedIds={selectedIds} setSelectedIds={setSelectedIds} canvasRef={canvasRef} automaticShapes={automaticShapes} autoSnap={autoSnap} penOnly={penOnly} theme={theme} viewportRef={viewportRef} onTemporarySelect={setTemporarySelect} /></div>
        <div className="workspace-footer"><span className="save-status"><span className={saveStatus === 'Salvestatud' ? 'saved-indicator' : 'busy-indicator'} />{saveStatus}</span><SizeControls key={`${activeId}:${selectedIds.join(',')}`} strokes={strokes} selectedIds={selectedIds} onCommit={commit} /><span>{strokes.length} elementi <span className="footer-separator">·</span> piiramatu lõuend</span></div>
      </section>
      {!terminalMinimized && <div className="panel-divider" role="separator" aria-label="Muuda terminali laiust" aria-orientation="vertical" aria-valuenow={visibleTerminalWidth} aria-valuemin={260} aria-valuemax={maxTerminalWidth} tabIndex={0} title="Lohista terminali laiuse muutmiseks"
        onPointerDown={startDividerDrag} onPointerMove={moveDivider} onPointerUp={stopDividerDrag} onPointerCancel={stopDividerDrag}
        onKeyDown={e => { if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); setTerminalWidth(Math.max(260, Math.min(maxTerminalWidth, visibleTerminalWidth + (e.key === 'ArrowLeft' ? 20 : -20)))) } }}><span /></div>}
      <aside className={`sidebar ${terminalMinimized ? 'collapsed' : ''}`} style={{ flexBasis: terminalMinimized ? 42 : visibleTerminalWidth }}>
        {terminalMinimized && <button className="terminal-restore" title="Ava terminal" aria-label="Ava terminal" aria-expanded={false} onClick={() => setTerminalMinimized(false)}><PanelRightOpen size={19} /></button>}
        <div className="terminal-keepalive" hidden={terminalMinimized}><TerminalPanel theme={theme} onCollapse={() => setTerminalMinimized(true)} /></div>
      </aside>
    </main>
  </div>
}
createRoot(document.getElementById('root')!).render(<App />)
