export type HoldPoint = { x: number; y: number }
export function createHoldToCopy(
  onHold: () => void,
  schedule: (callback: () => void) => () => void = callback => {
    const timer = setTimeout(callback, 700)
    return () => clearTimeout(timer)
  },
) {
  let pending: { pointerId: number; start: HoldPoint; cancelTimer: () => void } | null = null
  function cancel() { pending?.cancelTimer(); pending = null }
  return {
    start(pointerId: number, point: HoldPoint) {
      cancel()
      const hold = { pointerId, start: { ...point }, cancelTimer: () => {} }
      pending = hold
      hold.cancelTimer = schedule(() => {
        if (pending !== hold) return
        pending = null
        onHold()
      })
    },
    move(pointerId: number, point: HoldPoint) {
      if (pending?.pointerId === pointerId && Math.hypot(point.x - pending.start.x, point.y - pending.start.y) > 5) cancel()
    },
    cancel,
  }
}
