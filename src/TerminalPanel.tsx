import { useEffect, useRef } from 'react'
import { invoke, isTauri } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { ClipboardPaste, PanelRightClose } from 'lucide-react'
import { readText, writeText } from '@tauri-apps/plugin-clipboard-manager'
import { terminalClipboardAction, terminalPasteText } from './terminal-shortcuts'
import '@xterm/xterm/css/xterm.css'
import type { Theme } from './theme'

const terminalThemes = {
  light: { background: '#f8f8f8', foreground: '#202020', cursor: '#444444', selectionBackground: '#dddddd', black: '#202020', green: '#258358' },
  dark: { background: '#161616', foreground: '#eeeeee', cursor: '#cccccc', selectionBackground: '#444444', black: '#161616', green: '#75bf91' },
}

export function TerminalPanel({ onCollapse, theme }: { onCollapse: () => void; theme: Theme }) {
  const host = useRef<HTMLDivElement>(null)
  const terminalRef = useRef<Terminal | null>(null)
  const pasting = useRef(false)
  async function pasteClipboard() {
    const terminal = terminalRef.current
    if (!terminal || pasting.current) return
    pasting.current = true
    try {
      const imagePath = isTauri() ? await invoke<string | null>('save_clipboard_image') : null
      const text = terminalPasteText(imagePath, imagePath ? null : isTauri() ? await readText() : await navigator.clipboard.readText())
      if (terminalRef.current === terminal && text) { terminal.focus(); terminal.paste(text) }
    } catch (error) { window.alert(`Kleepimine ebaõnnestus: ${error}`) }
    finally { pasting.current = false }
  }
  async function copySelection(terminal: Terminal) {
    try {
      const text = terminal.getSelection()
      if (isTauri()) await writeText(text)
      else await navigator.clipboard.writeText(text)
    } catch (error) { window.alert(`Kopeerimine ebaõnnestus: ${error}`) }
  }
  useEffect(() => { if (terminalRef.current) terminalRef.current.options.theme = terminalThemes[theme] }, [theme])
  useEffect(() => {
    if (!host.current) return
    const terminal = new Terminal({ fontFamily: 'Cascadia Code, Consolas, monospace', fontSize: 13, lineHeight: 1.5, cursorBlink: true,
      theme: terminalThemes[theme],
      allowProposedApi: false, scrollback: 5000 })
    terminalRef.current = terminal
    const fit = new FitAddon(); terminal.loadAddon(fit); terminal.open(host.current)
    terminal.attachCustomKeyEventHandler(event => {
      const action = terminalClipboardAction(event, terminal.hasSelection())
      if (!action) return true
      event.preventDefault(); event.stopPropagation()
      if (event.type === 'keydown' && !event.repeat) {
        if (action === 'paste') void pasteClipboard()
        else void copySelection(terminal)
      }
      return false
    })
    const resize = new ResizeObserver(() => {
      if (!host.current || host.current.clientWidth < 80 || host.current.clientHeight < 60) return
      fit.fit()
      if (isTauri()) void invoke('terminal_resize', { cols: terminal.cols, rows: terminal.rows }).catch(() => {})
    })
    resize.observe(host.current)
    if (terminal.element) resize.observe(terminal.element)
    if (host.current.clientWidth >= 80 && host.current.clientHeight >= 60) fit.fit()
    let disposed = false
    let unlisten: (() => void) | undefined
    let unlistenExit: (() => void) | undefined
    const input = terminal.onData(data => { if (isTauri()) void invoke('terminal_write', { data }).catch(e => terminal.writeln(`\r\nViga: ${e}`)) })
    if (isTauri()) {
      void (async () => {
        try {
          unlisten = await listen<string>('terminal-output', event => terminal.write(event.payload))
          unlistenExit = await listen('terminal-exit', () => { terminal.writeln('\r\n[Terminal suletud — taaskäivitamiseks ava rakendus uuesti]') })
          if (disposed) { unlisten(); unlistenExit(); return }
          await invoke('start_terminal', { cols: terminal.cols, rows: terminal.rows })
        } catch (e) { terminal.writeln(`\r\nTerminali käivitamine ebaõnnestus: ${e}`) }
      })()
    } else { terminal.writeln('Terminal töötab Tauri töölauarakenduses.\r\nKäivita: npm run tauri dev') }
    return () => { disposed = true; unlisten?.(); unlistenExit?.(); input.dispose(); resize.disconnect(); terminal.dispose(); terminalRef.current = null }
  }, [])
  return <section className="terminal-panel">
    <div className="terminal-host" ref={host} />
    <button className="panel-toggle terminal-paste" title="Kleebi tekst või pildi failitee terminali (Ctrl+V)" aria-label="Kleebi terminali" onClick={() => void pasteClipboard()}><ClipboardPaste size={17} /></button>
    <button className="panel-toggle terminal-collapse" title="Peida terminal" aria-label="Peida terminal" onClick={onCollapse}><PanelRightClose size={18} /></button>
  </section>
}
