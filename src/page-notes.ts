import type { Page } from './PageTree'

export function withPageNotes(pages: Page[], id: string, notes: string): Page[] {
  return pages.map(page => page.id === id ? { ...page, notes: notes.slice(0, 10000) } : page)
}
