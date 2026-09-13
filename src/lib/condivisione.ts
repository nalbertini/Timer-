import type { Mode, Workout } from '../types'
import { uid } from './format'

/**
 * Mandare un allenamento a un altro dispositivo senza un server in mezzo.
 *
 * Un allenamento è poca roba — nome, schema, sette tempi e l'elenco degli
 * esercizi — e compresso sta dentro un link: duecento caratteri per un timer
 * normale, poco più di trecento per un circuito da venti stazioni. Un QR code
 * ne regge quasi tremila, quindi il codice resta a maglie larghe e si legge
 * al volo da uno schermo di telefono.
 *
 * I dati stanno dopo il `#`, e quella parte dell'URL il browser non la manda
 * mai al server. Due conseguenze, entrambe buone: gli allenamenti della
 * palestra non passano da nessuna parte, e il tablet in sala riceve il timer
 * anche senza rete, purché abbia già l'app in cache.
 *
 * È una copia, non una sincronizzazione: chi riceve si ritrova il timer com'era
 * al momento della scansione. Per una libreria che si allinea da sola servirebbe
 * un server, ed è l'unica cosa qui dentro che non si può fare senza.
 */

/** La chiave nel frammento: `#w=…`. */
const CHIAVE = 'w'

/** Nomi di campo corti: un link che si deve leggere da un QR non ha grasso da portarsi dietro. */
interface Magro {
  n: string
  m: Mode
  p: number
  w: number
  r: number
  R: number
  s: number
  S: number
  c: number
  d: number
  /** `[nome, durata?, serie?, ripetizioni?, carico?]`, con gli zeri al posto di quel che manca. */
  e: Array<[string, number, number, number, number]>
}

const MODI: Mode[] = ['interval', 'circuit', 'emom', 'amrap', 'fortime']

function magro(w: Workout): Magro {
  return {
    n: w.name,
    m: w.mode,
    p: w.prepare,
    w: w.work,
    r: w.rest,
    R: w.rounds,
    s: w.sets,
    S: w.setRest,
    c: w.cooldown,
    d: w.duration,
    e: w.exercises.map((e) => [e.name, e.duration ?? 0, e.sets ?? 0, e.reps ?? 0, e.kg ?? 0]),
  }
}

/**
 * Ricostruisce l'allenamento da quello che è arrivato.
 *
 * Tutto quello che entra da un link è roba di cui non si sa niente: può essere
 * troncata, vecchia, scritta a mano per gioco. Ogni campo viene quindi
 * riportato dentro i limiti dell'editor invece di essere creduto sulla parola,
 * e un allenamento con mille stazioni non deve poter esistere.
 */
function grasso(m: Magro): Workout | null {
  if (!m || typeof m !== 'object') return null
  const numero = (v: unknown, min: number, max: number, ripiego: number) => {
    const n = Number(v)
    return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n * 2) / 2)) : ripiego
  }
  const testo = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max).trim() : '')
  const nome = testo(m.n, 60)
  const mode = MODI.includes(m.m) ? m.m : 'interval'
  const esercizi = Array.isArray(m.e) ? m.e.slice(0, 50) : []
  return {
    id: uid(),
    name: nome || 'Timer ricevuto',
    mode,
    prepare: numero(m.p, 0, 120, 20),
    work: numero(m.w, 5, 600, 30),
    rest: numero(m.r, 0, 600, 15),
    rounds: numero(m.R, 1, 99, 8),
    sets: numero(m.s, 1, 20, 1),
    setRest: numero(m.S, 0, 600, 60),
    cooldown: numero(m.c, 0, 900, 0),
    duration: numero(m.d, 60, 5400, 600),
    exercises: esercizi
      .map((e) => (Array.isArray(e) ? e : [e, 0, 0, 0, 0]))
      .map(([nome, durata, serie, rip, kg]) => {
        const ex: Workout['exercises'][number] = { id: uid(), name: testo(nome, 60) }
        if (numero(durata, 0, 600, 0) > 0) ex.duration = numero(durata, 5, 600, 30)
        if (numero(serie, 0, 20, 0) > 0) ex.sets = numero(serie, 1, 20, 1)
        if (numero(rip, 0, 200, 0) > 0) ex.reps = numero(rip, 1, 200, 1)
        if (numero(kg, 0, 500, 0) > 0) ex.kg = numero(kg, 0.5, 500, 1)
        return ex
      })
      .filter((e) => e.name.length > 0),
    updatedAt: Date.now(),
  }
}

const base64url = (b: Uint8Array) => {
  let s = ''
  for (const byte of b) s += String.fromCharCode(byte)
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

const daBase64url = (s: string): Uint8Array => {
  const b = atob(s.replace(/-/g, '+').replace(/_/g, '/'))
  const out = new Uint8Array(b.length)
  for (let i = 0; i < b.length; i++) out[i] = b.charCodeAt(i)
  return out
}

async function sgonfia(dati: Uint8Array): Promise<Uint8Array | null> {
  if (typeof CompressionStream === 'undefined') return null
  try {
    const cs = new CompressionStream('deflate-raw')
    const scritto = new Blob([dati as BlobPart]).stream().pipeThrough(cs)
    return new Uint8Array(await new Response(scritto).arrayBuffer())
  } catch {
    return null
  }
}

async function gonfia(dati: Uint8Array): Promise<Uint8Array | null> {
  if (typeof DecompressionStream === 'undefined') return null
  try {
    const ds = new DecompressionStream('deflate-raw')
    const letto = new Blob([dati as BlobPart]).stream().pipeThrough(ds)
    return new Uint8Array(await new Response(letto).arrayBuffer())
  } catch {
    return null
  }
}

/**
 * Il link da mostrare come QR o da mandare a un collega.
 *
 * Il primo carattere dice come è scritto quello che segue: `1` compresso, `0`
 * in chiaro. La compressione è quella del browser, e dove non c'è — o dove
 * fallisce — il link diventa più lungo ma continua a funzionare, che è meglio
 * di una condivisione che non parte.
 */
export async function linkPer(w: Workout, base = location.href.split('#')[0]): Promise<string> {
  const json = new TextEncoder().encode(JSON.stringify(magro(w)))
  const compresso = await sgonfia(json)
  const corpo = compresso ? `1${base64url(compresso)}` : `0${base64url(json)}`
  return `${base}#${CHIAVE}=${corpo}`
}

/** L'allenamento contenuto in un indirizzo, se c'è ed è sano. */
export async function workoutDaLink(href = location.href): Promise<Workout | null> {
  const frammento = href.split('#')[1]
  if (!frammento) return null
  const corpo = new URLSearchParams(frammento).get(CHIAVE)
  if (!corpo || corpo.length < 2) return null
  try {
    const dati = daBase64url(corpo.slice(1))
    const json = corpo[0] === '1' ? await gonfia(dati) : dati
    if (!json) return null
    return grasso(JSON.parse(new TextDecoder().decode(json)) as Magro)
  } catch {
    return null
  }
}

/** Toglie il timer dall'indirizzo, così un ricarica non lo ripropone all'infinito. */
export function pulisciLink() {
  try {
    history.replaceState(null, '', location.href.split('#')[0])
  } catch {
    // In contesti isolati `replaceState` può essere negato: pazienza.
  }
}
