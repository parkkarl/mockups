// dblclick võib olla MouseEvent ka siis, kui algne sisend tuli pliiatsilt.
export function allowsTextEditing(lastPointerType: string, eventPointerType?: string) {
  return lastPointerType === 'mouse' && (!eventPointerType || eventPointerType === 'mouse')
}

export function penTipContact(event: { pointerType: string; pressure: number; buttons: number }) {
  return event.pointerType === 'pen' && (event.pressure > 0 || (event.buttons & 1) !== 0)
}

type PenButtons = { pointerType: string; button: number; buttons: number }
// Parema klõpsu nupp valib; eraldi kustutamissignaal (32 / button 5) kustutab.
export function stylusEraser(event: PenButtons) {
  return event.pointerType === 'pen' && (event.button === 5 || (event.buttons & 32) !== 0)
}
export function stylusSelect(event: PenButtons) {
  return event.pointerType === 'pen' && !stylusEraser(event) && (event.button === 2 || (event.buttons & 2) !== 0)
}
