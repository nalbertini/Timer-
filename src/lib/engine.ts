import type { CoachLevel, Mode, Segment, Workout } from '../types'

export const MODE_LABEL: Record<Mode, string> = {
  interval: 'Intervalli',
  circuit: 'Circuito',
  emom: 'EMOM',
  amrap: 'AMRAP',
  fortime: 'For Time',
}

export const MODE_BADGE: Record<Mode, string> = {
  interval: 'INTERVALLI',
  circuit: 'CIRCUITO',
  emom: 'EMOM',
  amrap: 'AMRAP',
  fortime: 'FOR TIME',
}

export const MODE_HINT: Record<Mode, string> = {
  interval: 'Lavoro e recupero che si alternano, per il numero di round che scegli.',
  circuit: 'Stazioni in sequenza, ognuna con la sua durata, ripetute a giri.',
  emom: 'Un esercizio all’inizio di ogni minuto: quello che avanza è recupero.',
  amrap: 'Un solo cronometro alla rovescia: più giri possibili nel tempo dato.',
  fortime: 'Cronometro che sale, con un tempo limite oltre cui si ferma.',
}

/** Quali parametri conta davvero ciascuno schema: guida l'editor e il riepilogo. */
export const MODE_FIELDS: Record<Mode, Array<keyof Workout>> = {
  interval: ['prepare', 'work', 'rest', 'rounds', 'sets', 'setRest', 'cooldown'],
  circuit: ['prepare', 'rest', 'rounds', 'sets', 'setRest', 'cooldown'],
  emom: ['prepare', 'work', 'rounds', 'sets', 'setRest', 'cooldown'],
  amrap: ['prepare', 'duration', 'sets', 'setRest', 'cooldown'],
  fortime: ['prepare', 'duration', 'cooldown'],
}

const KIND_LABEL = {
  prepare: 'PREPARATI',
  work: 'LAVORO',
  rest: 'RECUPERO',
  setRest: 'RIPOSO',
  cooldown: 'DEFATICAMENTO',
} as const

/**
 * Espande un allenamento nella sequenza piatta di segmenti che il timer percorre.
 * Tenere qui tutta la logica di schema rende il runtime banale: scorre una lista.
 */
export function buildSegments(w: Workout): Segment[] {
  const out: Segment[] = []
  let offset = 0

  const push = (s: Omit<Segment, 'offset'>) => {
    if (s.duration <= 0) return
    out.push({ ...s, offset })
    offset += s.duration
  }

  const sets = Math.max(1, w.sets)
  const rounds = Math.max(1, w.rounds)
  const names = w.exercises.filter((e) => e.name.trim().length > 0)
  const nameAt = (i: number) => (names.length ? names[i % names.length].name : 'Lavoro')

  if (w.prepare > 0) {
    push({
      kind: 'prepare',
      label: KIND_LABEL.prepare,
      name: 'Mettiti in posizione',
      duration: w.prepare,
      round: 0,
      rounds,
      set: 1,
      sets,
    })
  }

  for (let set = 1; set <= sets; set++) {
    if (w.mode === 'amrap' || w.mode === 'fortime') {
      push({
        kind: 'work',
        label: w.mode === 'amrap' ? 'AMRAP' : 'FOR TIME',
        name: names.length ? names.map((e) => e.name).join(' · ') : 'Giro libero',
        duration: w.duration,
        countUp: w.mode === 'fortime',
        round: 1,
        rounds: 1,
        set,
        sets,
      })
    } else if (w.mode === 'circuit') {
      for (let round = 1; round <= rounds; round++) {
        const stations = names.length ? names : [{ id: 'x', name: 'Stazione' }]
        stations.forEach((ex, i) => {
          push({
            kind: 'work',
            label: KIND_LABEL.work,
            name: ex.name,
            duration: ex.duration && ex.duration > 0 ? ex.duration : w.work,
            round,
            rounds,
            set,
            sets,
          })
          const isVeryLast = set === sets && round === rounds && i === stations.length - 1
          if (!isVeryLast) {
            push({
              kind: 'rest',
              label: KIND_LABEL.rest,
              name: 'Cambio stazione',
              duration: w.rest,
              round,
              rounds,
              set,
              sets,
            })
          }
        })
      }
    } else {
      // interval ed emom: stessa forma, l'emom semplicemente non ha recupero.
      for (let round = 1; round <= rounds; round++) {
        push({
          kind: 'work',
          label: KIND_LABEL.work,
          name: nameAt(round - 1),
          duration: w.work,
          round,
          rounds,
          set,
          sets,
        })
        const isVeryLast = set === sets && round === rounds
        if (w.mode === 'interval' && !isVeryLast) {
          push({
            kind: 'rest',
            label: KIND_LABEL.rest,
            name: 'Respira',
            duration: w.rest,
            round,
            rounds,
            set,
            sets,
          })
        }
      }
    }

    if (set < sets) {
      push({
        kind: 'setRest',
        label: KIND_LABEL.setRest,
        name: `Fine serie ${set} di ${sets}`,
        duration: w.setRest,
        round: rounds,
        rounds,
        set,
        sets,
      })
    }
  }

  if (w.cooldown > 0) {
    push({
      kind: 'cooldown',
      label: KIND_LABEL.cooldown,
      name: 'Allunga e respira',
      duration: w.cooldown,
      round: rounds,
      rounds,
      set: sets,
      sets,
    })
  }

  return out
}

export function totalDuration(w: Workout): number {
  const segs = buildSegments(w)
  const last = segs[segs.length - 1]
  return last ? last.offset + last.duration : 0
}

/** Riga di struttura mostrata sotto il nome nelle liste. */
export function describe(w: Workout): string {
  const q = (n: number) => `${n}"`
  switch (w.mode) {
    case 'interval':
      return `${w.rounds} × ${q(w.work)}/${q(w.rest)}${w.sets > 1 ? ` · ${w.sets} serie` : ''}`
    case 'circuit': {
      const n = w.exercises.length || 1
      return `${n} stazioni × ${w.rounds} giri${w.sets > 1 ? ` · ${w.sets} serie` : ''}`
    }
    case 'emom':
      return `${w.rounds} slot da ${q(w.work)}${w.sets > 1 ? ` · ${w.sets} serie` : ''}`
    case 'amrap':
      return `giro libero · ${Math.round(w.duration / 60)} minuti`
    case 'fortime':
      return `cronometro in salita · limite ${Math.round(w.duration / 60)} min`
  }
}


/* ------------------------------------------------------------------ *
 * Modalità Maurizio
 *
 * L'allenatore che «perde il conto» per farti lavorare qualche secondo
 * in più. Due parti distinte, e tenerle separate è ciò che rende la cosa
 * gestibile:
 *
 *  1. il tempo in più è deciso all'avvio e cucito dentro la durata dei
 *     segmenti, così offset, barra di avanzamento e durata totale restano
 *     coerenti e il motore non sa nulla di tutto questo;
 *  2. la sceneggiata è solo nel numero mostrato, che negli ultimi secondi
 *     torna indietro invece di scendere dritto.
 * ------------------------------------------------------------------ */

export interface CoachOptions {
  /** Quanti intervalli di lavoro vengono allungati, da 0 a 1. */
  probability: number
  /** Estremi in secondi, entrambi PARI: vedi `applyCoach`. */
  minBonus: number
  maxBonus: number
}

export const COACH_LEVELS: Record<CoachLevel, CoachOptions | null> = {
  off: null,
  distratto: { probability: 0.25, minBonus: 2, maxBonus: 4 },
  classico: { probability: 0.5, minBonus: 2, maxBonus: 6 },
  spietato: { probability: 0.85, minBonus: 4, maxBonus: 10 },
}

export const COACH_LABEL: Record<CoachLevel, string> = {
  off: 'Spenta',
  distratto: 'Distratto',
  classico: 'Classico',
  spietato: 'Spietato',
}

export const COACH_HINT: Record<CoachLevel, string> = {
  off: 'Il timer conta onestamente.',
  distratto: 'Ogni tanto perde il filo: un paio di secondi in più.',
  classico: 'Il Maurizio di tutti i giorni: metà degli intervalli si allungano.',
  spietato: 'Sbaglia a contare quasi sempre, e non di poco.',
}

/** Le frasi che gli scappano quando lo becchi a sbagliare. */
export const COACH_LINES = [
  'Ho perso il conto, ricominciamo',
  'No aspetta, tre',
  'Ancora un attimo',
  'Eh no, quello non valeva',
  'Dai che è quasi finita',
  'Scusate, mi sono distratto',
]

/**
 * Allunga gli intervalli di lavoro e ricalcola gli offset. Restituisce una
 * nuova lista: i segmenti in ingresso non vengono toccati.
 */
export function applyCoach(segments: Segment[], level: CoachLevel, rand: () => number = Math.random): Segment[] {
  const opts = COACH_LEVELS[level]
  if (!opts) return segments

  let offset = 0
  return segments.map((seg) => {
    // Solo il lavoro si allunga: sul recupero Maurizio conta benissimo. E un
    // intervallo troppo corto non regge un ripensamento credibile.
    const eligible = seg.kind === 'work' && !seg.countUp && seg.duration >= 10
    // Il bonus è sempre pari, e non per capriccio: con un bonus dispari il
    // rimbalzo 3-2-3-2 non può insieme attaccarsi al 3 e chiudere su 3,2,1,
    // e il conto finirebbe per saltare un numero. Vincolare l'ingresso costa
    // un secondo di granularità e rende la sequenza corretta per costruzione.
    const passi = Math.floor((opts.maxBonus - opts.minBonus) / 2) + 1
    const bonus =
      eligible && rand() < opts.probability ? opts.minBonus + 2 * Math.floor(rand() * passi) : 0
    const out: Segment = { ...seg, duration: seg.duration + bonus, offset, ...(bonus > 0 ? { bonus } : {}) }
    offset += out.duration
    return out
  })
}

/**
 * Il numero da mostrare a schermo.
 *
 * L'intervallo deve sembrare quello nominale: il conto parte dalla durata
 * senza bonus e scende normalmente fino a 3, e solo lì comincia a rimbalzare
 * fra 3 e 2 prima di chiudere su 1 — «tre… due… tre! due… uno». Sottrarre il
 * bonus finché siamo lontani dalla fine è ciò che tiene il numero continuo:
 * senza, si passerebbe di colpo da 12 a 3.
 */
export function coachedDisplay(seg: Segment | null, remaining: number): number {
  if (!seg?.bonus || seg.countUp) return remaining
  const tail = seg.bonus + 3
  if (remaining > tail) return remaining - seg.bonus
  const left = Math.ceil(remaining)
  if (left <= 0) return remaining
  // `left` scende da tail a 1: leggiamo la coda dall'inizio.
  const step = tail - left
  const wobble = seg.bonus
  // Con `wobble` pari il rimbalzo parte da 3, attaccandosi al 4 appena
  // mostrato, e finisce su 2, lasciando il posto al 3,2,1 di chiusura.
  if (step < wobble) return step % 2 === 0 ? 3 : 2
  return tail - step
}
