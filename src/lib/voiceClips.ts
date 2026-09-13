import type { SegmentKind } from '../types'

/**
 * L'elenco chiuso delle frasi che vale la pena incidere con una voce vera.
 * È chiuso di proposito: gli stati, i tre numeri finali e le battute di
 * Maurizio sono sempre gli stessi, mentre i nomi degli esercizi li scrive
 * l'utente e restano alla sintesi (salvo clip dedicate, vedi `exerciseKey`).
 */
export interface ClipSpec {
  /** Chiave e percorso del file, senza estensione: `stato/lavoro`. */
  key: string
  /** Cosa va detto. È anche il testo passato alla sintesi come ripiego. */
  text: string
  /** Per raggruppare nel registratore. */
  group: 'Stati' | 'Conto alla rovescia' | 'Maurizio'
  hint?: string
}

/** Il saluto che apre l'allenamento, prima del conto alla rovescia iniziale. */
export const INTRO_CLIP = 'stato/intro'

export const STATE_CLIP: Record<SegmentKind | 'finish', string> = {
  prepare: 'stato/preparati',
  work: 'stato/lavoro',
  rest: 'stato/recupero',
  setRest: 'stato/riposo',
  cooldown: 'stato/defaticamento',
  finish: 'stato/completato',
}

export const CLIPS: ClipSpec[] = [
  {
    key: INTRO_CLIP,
    text: 'Oggi ho preparato un allenamento…',
    group: 'Stati',
    hint: 'Il saluto prima di partire: si sente una volta sola, all\u2019avvio',
  },
  { key: 'stato/preparati', text: 'Preparati', group: 'Stati' },
  { key: 'stato/lavoro', text: 'Lavoro', group: 'Stati', hint: 'Deciso, è quello che si sente più spesso' },
  { key: 'stato/recupero', text: 'Recupero', group: 'Stati' },
  { key: 'stato/riposo', text: 'Riposo', group: 'Stati', hint: 'Fra una serie e l’altra' },
  { key: 'stato/defaticamento', text: 'Defaticamento', group: 'Stati' },
  { key: 'stato/completato', text: 'Allenamento completato', group: 'Stati' },

  { key: 'numeri/tre', text: 'Tre', group: 'Conto alla rovescia' },
  { key: 'numeri/due', text: 'Due', group: 'Conto alla rovescia' },
  { key: 'numeri/uno', text: 'Uno', group: 'Conto alla rovescia' },

  { key: 'maurizio/1', text: 'Ho perso il conto, ricominciamo', group: 'Maurizio' },
  { key: 'maurizio/2', text: 'No aspetta, tre', group: 'Maurizio' },
  { key: 'maurizio/3', text: 'Ancora un attimo', group: 'Maurizio' },
  { key: 'maurizio/4', text: 'Eh no, quello non valeva', group: 'Maurizio' },
  { key: 'maurizio/5', text: 'Dai che è quasi finita', group: 'Maurizio' },
  { key: 'maurizio/6', text: 'Scusate, mi sono distratto', group: 'Maurizio' },
]

export const NUMBER_CLIP: Record<number, string> = {
  1: 'numeri/uno',
  2: 'numeri/due',
  3: 'numeri/tre',
}

/** `Burpee + salto` → `esercizi/burpee-salto`. */
export function exerciseKey(name: string): string {
  const slug = name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return slug ? `esercizi/${slug}` : ''
}

/**
 * Estensioni provate in ordine. I browser registrano in formati diversi
 * (webm/opus su Chrome e Android, mp4/aac su Safari) e nessun formato è
 * decodificabile ovunque: si prova finché una non risponde.
 */
export const CLIP_EXTENSIONS = ['m4a', 'mp3', 'webm', 'ogg', 'wav'] as const

export const CLIP_DIR = 'voce'
