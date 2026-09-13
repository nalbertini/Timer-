import { getClip } from './clipStore'
import { speak } from './audio'
import { CLIP_DIR, CLIP_EXTENSIONS } from './voiceClips'

/**
 * Riproduzione delle clip incise, con ripiego sulla sintesi.
 *
 * L'ordine è: registrazione su questo dispositivo, poi file pubblicato con
 * l'app, poi sintesi vocale. Così una palestra può partire senza incidere
 * nulla, incidere sul posto e vedere l'effetto subito, e infine distribuire
 * le clip a tutti pubblicandole.
 */

let ctx: AudioContext | null = null
const cache = new Map<string, AudioBuffer | null>()
const pending = new Map<string, Promise<AudioBuffer | null>>()

function context(): AudioContext | null {
  if (ctx) return ctx
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!Ctor) return null
  try {
    ctx = new Ctor()
  } catch {
    return null
  }
  return ctx
}

async function decode(data: ArrayBuffer): Promise<AudioBuffer | null> {
  const c = context()
  if (!c) return null
  try {
    return await c.decodeAudioData(data)
  } catch {
    // Formato non decodificabile da questo browser.
    return null
  }
}

/**
 * L'indice delle clip pubblicate con l'app: `voce/index.json`.
 *
 * Serve a non sparare richieste a vuoto. Senza, per sapere quali clip esistono
 * bisognerebbe tentare ogni chiave per ogni estensione — un centinaio di 404 a
 * ogni apertura del timer. Con l'indice è una richiesta sola, e se manca vuol
 * dire che non c'è nulla di pubblicato e non si tenta affatto.
 * Il registratore lo genera insieme allo zip da esportare.
 */
interface ClipIndex {
  ext: string
  clips: string[]
}

let indexPromise: Promise<ClipIndex | null> | null = null

function clipIndex(): Promise<ClipIndex | null> {
  if (!indexPromise) {
    indexPromise = fetch(`${CLIP_DIR}/index.json`)
      .then((r) => (r.ok ? (r.json() as Promise<ClipIndex>) : null))
      .then((i) =>
        i && typeof i.ext === 'string' && Array.isArray(i.clips) && (CLIP_EXTENSIONS as readonly string[]).includes(i.ext)
          ? i
          : null,
      )
      .catch(() => null)
  }
  return indexPromise
}

async function load(key: string): Promise<AudioBuffer | null> {
  // Prima la registrazione locale: incidere sul tablet deve avere effetto subito.
  const recorded = await getClip(key)
  if (recorded) {
    const buf = await decode(await recorded.arrayBuffer())
    if (buf) return buf
  }
  const index = await clipIndex()
  if (!index || !index.clips.includes(key)) return null
  try {
    const res = await fetch(`${CLIP_DIR}/${key}.${index.ext}`)
    if (!res.ok) return null
    return await decode(await res.arrayBuffer())
  } catch {
    return null
  }
}

/** Risolve una volta sola per chiave, anche se la chiedono in dieci insieme. */
function clip(key: string): Promise<AudioBuffer | null> {
  if (cache.has(key)) return Promise.resolve(cache.get(key) ?? null)
  const inFlight = pending.get(key)
  if (inFlight) return inFlight
  const p = load(key).then((buf) => {
    cache.set(key, buf)
    pending.delete(key)
    return buf
  })
  pending.set(key, p)
  return p
}

/** Da chiamare quando le clip cambiano, altrimenti resta in cache la vecchia. */
export function forgetClips() {
  cache.clear()
  pending.clear()
  indexPromise = null
}

export function unlockVoice() {
  const c = context()
  if (c && c.state === 'suspended') void c.resume()
}

export async function hasClip(key: string): Promise<boolean> {
  return (await clip(key)) !== null
}

/** Scalda le clip che serviranno, così al momento buono partono senza ritardo. */
export function preload(keys: string[]) {
  keys.filter(Boolean).forEach((k) => void clip(k))
}

/**
 * Dice qualcosa con la voce incisa, se c'è, altrimenti con la sintesi.
 *
 * `keys` è una sequenza da suonare di fila: la prima è obbligatoria, le altre
 * sono di contorno. Se la prima manca si ripiega sulla sintesi di `text`; se
 * mancano solo quelle dopo, si suona il pezzo disponibile — una clip incisa
 * per «Lavoro» vale comunque, anche senza quella del nome dell'esercizio.
 *
 * Restituisce `true` se ha parlato con la voce incisa.
 */
export async function say(
  keys: string[],
  text: string,
  opts: { volume: number; voiceURI: string | null; useRecorded: boolean },
): Promise<boolean> {
  const wanted = keys.filter(Boolean)
  if (opts.useRecorded && wanted.length > 0) {
    const buffers: AudioBuffer[] = []
    for (const k of wanted) {
      const buf = await clip(k)
      if (!buf) break
      buffers.push(buf)
    }
    if (buffers.length > 0) {
      const c = context()
      if (c && c.state === 'running') {
        // Incatenate sull'orologio audio: niente buchi né sovrapposizioni.
        let when = c.currentTime
        for (const buf of buffers) {
          const src = c.createBufferSource()
          const gain = c.createGain()
          gain.gain.value = opts.volume
          src.buffer = buf
          src.connect(gain).connect(c.destination)
          src.start(when)
          when += buf.duration
        }
        return true
      }
    }
  }
  speak(text, opts.volume, opts.voiceURI)
  return false
}
