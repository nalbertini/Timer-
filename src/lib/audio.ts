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

/**
 * Quasi tutti i sistemi espongono più voci italiane, e la prima dell'elenco è
 * di norma la più metallica. Questo punteggio preferisce le versioni
 * «enhanced»/«premium» e quelle servite dalla rete, che suonano molto più
 * naturali di quelle compatte installate di serie.
 */
function rank(v: SpeechSynthesisVoice): number {
  const n = v.name.toLowerCase()
  let score = 0
  if (/(enhanced|premium|neural|natural|siri)/.test(n)) score += 6
  if (/(alice|federica|luca|emma|elsa|carla)/.test(n)) score += 3
  if (v.localService === false) score += 2
  if (n.includes('google')) score += 2
  if (/(compact|compatta|eloquence)/.test(n)) score -= 4
  if (v.default) score += 1
  return score
}

/** Le voci italiane disponibili, dalla più naturale alla più sintetica. */
export function italianVoices(): SpeechSynthesisVoice[] {
  return voices.filter((v) => v.lang?.toLowerCase().startsWith('it')).sort((a, b) => rank(b) - rank(a))
}

function pickVoice(voiceURI: string | null): SpeechSynthesisVoice | undefined {
  const list = italianVoices()
  if (voiceURI) {
    const chosen = list.find((v) => v.voiceURI === voiceURI)
    if (chosen) return chosen
  }
  return list[0]
}

let ultima = { testo: '', quando: -1e9 }

export function speak(text: string, volume: number, voiceURI: string | null = null) {
  if (!('speechSynthesis' in window) || !text) return
  const ora = performance.now()
  // Una stessa frase ripetuta a un attimo di distanza non è mai voluta: è il
  // doppione che alcuni browser producono da soli. Si scarta.
  if (text === ultima.testo && ora - ultima.quando < 900) return
  ultima = { testo: text, quando: ora }
  try {
    const sintesi = window.speechSynthesis
    // Una coda di annunci arretrati è peggio del silenzio: l'ultimo vince. Ma
    // cancel() va chiamato solo se c'è davvero qualcosa da fermare: a vuoto,
    // seguito subito da speak(), su Safari e su alcune build Android fa
    // pronunciare la frase due volte.
    if (sintesi.speaking || sintesi.pending) sintesi.cancel()
    const u = new SpeechSynthesisUtterance(text)
    const v = pickVoice(voiceURI)
    if (v) u.voice = v
    u.lang = v?.lang ?? 'it-IT'
    // Ritmo naturale: sopra 1.05 il parlato inizia a suonare meccanico.
    u.rate = 1
    u.pitch = 1
    u.volume = volume
    sintesi.speak(u)
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
