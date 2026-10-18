export function triggerHaptic(duration = 50): void {
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    try {
      navigator.vibrate(duration)
    } catch {
      // Vibration not supported or denied by browser permissions
    }
  }
}
