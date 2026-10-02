export type Theme = 'light' | 'dark'
export const INK = '#111111'

// Värv säilib failis samana: teema muutmine mõjutab ainult kuvamist ja PNG-d.
export function displayColor(color: string, theme: Theme): string {
  const value = color.toLowerCase()
  if (['#000', '#000000', INK, '#66e2b8', '#f5f7f0', '#1e70eb', '#e8f3ee', '#dce9e5', '#f1f4f3'].includes(value)) return theme === 'dark' ? '#f5f5f5' : INK
  if (value === '#a7c5c5') return theme === 'dark' ? '#bbbbbb' : '#666666'
  if (value === '#276cdd') return '#414141'
  if (theme === 'dark' && ['#41474b', '#303639', '#50565a'].includes(value)) return '#bdbdbd'
  return color
}
