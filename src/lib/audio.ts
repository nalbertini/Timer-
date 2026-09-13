/**
 * Segnali acustici sintetizzati al volo: nessun file audio da scaricare, quindi
 * funzionano anche al primo avvio offline.
 */
export class Cues {
  private ctx: AudioContext | null = null
  volume = 0.8

  /** I browser creano il contesto audio sospeso finché non c'è un gesto dell'utente. */
  unlock() {
    if (!this.ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!Ctor) return
      try {
        this.ctx = new Ctor()
      } catch {
        return
      }
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume()
  }

  private tone(freq: number, ms: number, gain: number, type: OscillatorType = 'sine') {
    if (!this.ctx || this.ctx.state !== 'running') return
    const now = this.ctx.currentTime
    const osc = this.ctx.createOscillator()
    const amp = this.ctx.createGain()
    osc.type = type
    osc.frequency.setValueAtTime(freq, now)
    // Attacco e rilascio morbidi: un gain a gradino produce un click udibile.
    amp.gain.setValueAtTime(0, now)
    amp.gain.linearRampToValueAtTime(gain * this.volume, now + 0.012)
    amp.gain.exponentialRampToValueAtTime(0.0001, now + ms / 1000)
    osc.connect(amp).connect(this.ctx.destination)
    osc.start(now)
    osc.stop(now + ms / 1000 + 0.02)
  }

  /** Uno dei tre bip che precedono un cambio di stato. */
  countdown() {
    this.tone(880, 140, 0.5, 'square')
  }

  /** Inizio di un intervallo di lavoro: acuto e deciso. */
  work() {
    this.tone(1320, 420, 0.6, 'square')
  }

  /** Inizio di un recupero: più basso e corto. */
  rest() {
    this.tone(600, 320, 0.45, 'sine')
  }

  /** Fine allenamento: tre note in salita. */
  finish() {
    this.tone(660, 220, 0.5)
    window.setTimeout(() => this.tone(880, 220, 0.5), 200)
    window.setTimeout(() => this.tone(1320, 520, 0.55), 400)
  }
}

let voices: SpeechSynthesisVoice[] = []
const loadVoices = () => {
  if ('speechSynthesis' in window) voices = window.speechSynthesis.getVoices()
}
if ('speechSynthesis' in window) {
  loadVoices()
  window.speechSynthesis.addEventListener('voiceschanged', loadVoices)
}

export function speak(text: string, volume: number) {
  if (!('speechSynthesis' in window) || !text) return
  try {
    // Una coda di annunci arretrati è peggio del silenzio: l'ultimo vince.
    window.speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(text)
    const it = voices.find((v) => v.lang?.toLowerCase().startsWith('it'))
    if (it) u.voice = it
    u.lang = 'it-IT'
    u.rate = 1.05
    u.volume = volume
    window.speechSynthesis.speak(u)
  } catch {
    // Sintesi vocale non disponibile: i bip restano.
  }
}

export function buzz(pattern: number | number[]) {
  try {
    navigator.vibrate?.(pattern)
  } catch {
    // Niente vibrazione su desktop.
  }
}
