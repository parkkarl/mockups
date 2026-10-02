import type { Tool } from './canvas'

export const TOOL_KEYS: Record<Exclude<Tool, 'hand'>, string> = {
  select: '1', pen: '2', highlighter: '3', eraser: '4',
  line: 'L', rectangle: 'R', ellipse: 'O',
}

// Säilitame ka varem kasutatud tähtklahvid.
const legacyKeys: Record<string, Tool> = { v: 'select', p: 'pen', m: 'highlighter' }

export const TOGGLE_KEYS = { automaticShapes: 'Q', autoSnap: 'W', penOnly: 'E' } as const
export type ToggleShortcut = keyof typeof TOGGLE_KEYS

export function toggleForShortcut(event: Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'metaKey' | 'altKey'>): ToggleShortcut | null {
  if (event.ctrlKey || event.metaKey || event.altKey) return null
  return (Object.entries(TOGGLE_KEYS).find(([, key]) => key.toLowerCase() === event.key.toLowerCase())?.[0] as ToggleShortcut | undefined) ?? null
}

export function toolForShortcut(event: Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'metaKey' | 'altKey'>): Tool | null {
  if (event.ctrlKey || event.metaKey || event.altKey) return null
  const key = event.key.toLowerCase()
  return (Object.entries(TOOL_KEYS).find(([, shortcut]) => shortcut.toLowerCase() === key)?.[0] as Tool | undefined) ?? legacyKeys[key] ?? null
}
