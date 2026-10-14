let sharedAudioCtx: AudioContext | null = null

export function unlockAudioEngine(): void {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (!AudioCtx) return
    if (!sharedAudioCtx) {
      sharedAudioCtx = new AudioCtx()
    }
    if (sharedAudioCtx.state === 'suspended') {
      void sharedAudioCtx.resume()
    }
  } catch {
    // Audio unlock silently skipped if restricted by browser policy
  }
}

export function playChaChingSound(): void {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (!AudioCtx) return
    if (!sharedAudioCtx) {
      sharedAudioCtx = new AudioCtx()
    }
    const ctx = sharedAudioCtx
    if (ctx.state === 'suspended') {
      void ctx.resume()
    }

    const now = ctx.currentTime

    // Coin drop attack
    const dropOsc = ctx.createOscillator()
    const dropGain = ctx.createGain()
    dropOsc.type = 'sine'
    dropOsc.frequency.setValueAtTime(260, now)
    dropOsc.frequency.exponentialRampToValueAtTime(95, now + 0.085)
    dropGain.gain.setValueAtTime(0.001, now)
    dropGain.gain.linearRampToValueAtTime(0.26, now + 0.01)
    dropGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.095)
    dropOsc.connect(dropGain)
    dropGain.connect(ctx.destination)
    dropOsc.start(now)
    dropOsc.stop(now + 0.1)

    // Rising 4-note GPay chime
    const gpayNotes = [
      { freq: 587.33, start: 0.08, dur: 0.28, peak: 0.22 },
      { freq: 739.99, start: 0.16, dur: 0.30, peak: 0.24 },
      { freq: 880.00, start: 0.24, dur: 0.34, peak: 0.26 },
      { freq: 1174.66, start: 0.33, dur: 0.72, peak: 0.32 },
    ]

    gpayNotes.forEach(({ freq, start, dur, peak }) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(freq, now + start)
      gain.gain.setValueAtTime(0.0001, now + start)
      gain.gain.linearRampToValueAtTime(peak, now + start + 0.018)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + start + dur)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(now + start)
      osc.stop(now + start + dur + 0.02)

      const overtone = ctx.createOscillator()
      const overGain = ctx.createGain()
      overtone.type = 'triangle'
      overtone.frequency.setValueAtTime(freq * 2, now + start)
      overGain.gain.setValueAtTime(0.0001, now + start)
      overGain.gain.linearRampToValueAtTime(peak * 0.18, now + start + 0.012)
      overGain.gain.exponentialRampToValueAtTime(0.0001, now + start + dur * 0.65)
      overtone.connect(overGain)
      overGain.connect(ctx.destination)
      overtone.start(now + start)
      overtone.stop(now + start + dur)
    })
  } catch {
    // Suppress Web Audio failures gracefully
  }
}
