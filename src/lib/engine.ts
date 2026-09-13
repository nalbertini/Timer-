import type { Mode, Segment, Workout } from '../types'

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
