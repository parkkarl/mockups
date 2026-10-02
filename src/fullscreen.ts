export function isFullscreenShortcut(event: Pick<KeyboardEvent, 'key' | 'repeat' | 'ctrlKey' | 'metaKey' | 'altKey' | 'shiftKey'>): boolean {
  return event.key === 'F11' && !event.repeat && !event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey
}
