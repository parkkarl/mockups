export function terminalPasteText(imagePath: string | null, text: string | null): string {
  if (imagePath) return /\s/.test(imagePath) ? `"${imagePath}"` : imagePath
  return text ?? ''
}

type ClipboardKey = { key: string; ctrlKey: boolean; metaKey: boolean; altKey: boolean; shiftKey: boolean }
export function terminalClipboardAction(event: ClipboardKey, hasSelection: boolean): 'paste' | 'copy' | null {
  if (event.altKey) return null
  const key = event.key.toLowerCase()
  if (((event.ctrlKey || event.metaKey) && key === 'v') ||
      (event.shiftKey && !event.ctrlKey && !event.metaKey && key === 'insert')) return 'paste'
  // Valikuta Ctrl+C jääb terminali katkestuskäsuks.
  if ((event.ctrlKey || event.metaKey) && key === 'c' && hasSelection) return 'copy'
  return null
}
