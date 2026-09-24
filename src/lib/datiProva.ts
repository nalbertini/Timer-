import type { Workout } from '../types'
import { blankWorkout } from './presets'
import type { Dati } from './dati'
import type { Persona, SessioneVista, StatoPresenza } from './sala'
import { chiaveGiorno, perCognome } from './sala'

/**
 * La sala corsi senza server: un orario e degli iscritti inventati.
 *
 * Non è un ripiego per le prove. È anche il modo in cui si apre l'app e si
 * capisce cosa fa senza avere niente acceso, ed è quello che gira sul sito
 * pubblico finché la palestra non ha il suo database. Le presenze segnate qui
 * restano in `localStorage`, così la prova si comporta come la cosa vera:
 * chiudi, riapri, e l'appello è come l'avevi lasciato.
 *
 * I nomi sono inventati. Se somigliano a qualcuno è un caso.
 */

const DOVE = 'ods-timer:prova-presenze'

interface Definizione {
  id: string
  nome: string
  colore: string
  sala: string
  istruttore: string
  /** 0 = domenica, come `getDay()`. */
  giorno: number
  ora: string
  durata: number
  iscritti: string[]
  allenamento?: Workout
}

const nomi = (elenco: string): string[] => elenco.split(', ')

const w = (p: Partial<Workout> & { id: string; name: string; mode: Workout['mode'] }): Workout => ({
  ...blankWorkout(p.mode),
  ...p,
  updatedAt: 0,
})

const ESERCIZI = (...n: string[]) => n.map((name, i) => ({ id: `e${i}`, name }))

const CORSI: Definizione[] = [
  {
    id: 'c-functional', nome: 'Functional', colore: '#e4292a', sala: 'Sala grande',
    istruttore: 'Maurizio Innella', giorno: 1, ora: '19:00', durata: 50,
    iscritti: nomi('Rossi Luca, Bianchi Sara, Ferrero Giulia, Conti Marco, Esposito Anna, Greco Paolo, Ricci Elena, Marino Davide, Costa Chiara, Gallo Simone, Rizzo Martina, Bruno Andrea'),
    allenamento: w({
      id: 'a-functional', name: 'Functional del lunedì', mode: 'interval',
      work: 40, rest: 20, rounds: 8, sets: 3, setRest: 90,
      exercises: ESERCIZI('Burpee + salto', 'Mountain climber', 'Jump squat', 'Plank jack'),
    }),
  },
  {
    id: 'c-spinning', nome: 'Spinning', colore: '#f4c31b', sala: 'Sala spinning',
    istruttore: 'Giulia Ferrero', giorno: 2, ora: '19:00', durata: 50,
    iscritti: nomi('Colombo Federica, Moretti Stefano, Barbieri Laura, Fontana Alberto, Santoro Ilaria, Mariani Roberto, Rinaldi Silvia, Caruso Nicola, Leone Valentina, Longo Matteo, Martini Francesca, Vitale Giorgio, Serra Alice, Palumbo Enrico'),
    allenamento: w({
      id: 'a-spinning', name: 'Salite e pianura', mode: 'interval',
      work: 60, rest: 30, rounds: 10, sets: 2, setRest: 120,
      exercises: ESERCIZI('Salita in piedi', 'Pianura veloce', 'Salita seduti', 'Recupero attivo'),
    }),
  },
  {
    id: 'c-judo-ragazzi', nome: 'Judo ragazzi', colore: '#1b8ac4', sala: 'Tatami',
    istruttore: 'Maurizio Innella', giorno: 2, ora: '17:30', durata: 60,
    iscritti: nomi('Ferrari Tommaso, Russo Matilde, Galli Riccardo, De Luca Sofia, Villa Edoardo, Testa Bianca, Amato Leonardo, Pellegrini Aurora'),
  },
  {
    id: 'c-pilates', nome: 'Pilates', colore: '#16a54a', sala: 'Sala piccola',
    istruttore: 'Giulia Ferrero', giorno: 3, ora: '10:00', durata: 55,
    iscritti: nomi('Sartori Marta, Gentile Claudia, Lombardi Paola, Battaglia Rosa, Farina Lucia, Negri Antonella, Guerra Daniela, Bellini Monica, Poli Cristina'),
  },
  {
    id: 'c-circuito', nome: 'Circuito sala attrezzi', colore: '#e4292a', sala: 'Sala attrezzi',
    istruttore: 'Maurizio Innella', giorno: 4, ora: '18:30', durata: 45,
    iscritti: nomi('Rossi Luca, Conti Marco, Marino Davide, Gallo Simone, Bruno Andrea, Fontana Alberto, Longo Matteo, Vitale Giorgio, Palumbo Enrico, Grassi Fabio'),
    allenamento: w({
      id: 'a-circuito', name: 'Giro delle sei stazioni', mode: 'circuit',
      work: 45, rest: 15, rounds: 4,
      exercises: ESERCIZI('Vogatore', 'Panca piana', 'Leg press', 'Lat machine', 'Addominali', 'Corda'),
    }),
  },
  {
    id: 'c-core', nome: 'Core express', colore: '#f4c31b', sala: 'Sala piccola',
    istruttore: 'Giulia Ferrero', giorno: 5, ora: '13:00', durata: 30,
    iscritti: nomi('Bianchi Sara, Esposito Anna, Ricci Elena, Costa Chiara, Rizzo Martina, Colombo Federica, Barbieri Laura, Santoro Ilaria'),
    allenamento: w({
      id: 'a-core', name: 'Core in mezz’ora', mode: 'interval',
      work: 20, rest: 10, rounds: 8, sets: 2, setRest: 45,
      exercises: ESERCIZI('Plank', 'Russian twist', 'Hollow hold', 'Bicicletta'),
    }),
  },
  {
    id: 'c-judo-adulti', nome: 'Judo adulti', colore: '#1b8ac4', sala: 'Tatami',
    istruttore: 'Maurizio Innella', giorno: 6, ora: '10:30', durata: 90,
    iscritti: nomi('Greco Paolo, Moretti Stefano, Mariani Roberto, Caruso Nicola, Grassi Fabio, Ferrari Tommaso, Amato Leonardo'),
  },
]

/** Una persona per ogni nome che compare in un elenco, con un id stabile. */
const REGISTRO = new Map<string, Persona>()
for (const c of CORSI) {
  for (const intero of c.iscritti) {
    if (REGISTRO.has(intero)) continue
    const [cognome, ...resto] = intero.split(' ')
    REGISTRO.set(intero, {
      id: `p-${intero.toLowerCase().replace(/[^a-z]+/g, '-')}`,
      cognome,
      nome: resto.join(' '),
      ruolo: 'iscritto',
    })
  }
}

/**
 * L'id di una lezione è corso + giorno. Deve restare lo stesso fra un
 * ricaricamento e l'altro, altrimenti le presenze segnate si staccherebbero
 * dalla lezione a cui appartengono.
 */
const idSessione = (corso: string, giorno: string) => `s-${corso}-${giorno}`

function istante(giorno: string, ora: string): Date {
  const [a, m, g] = giorno.split('-').map(Number)
  const [h, min] = ora.split(':').map(Number)
  return new Date(a, m - 1, g, h, min)
}

type Segnate = Record<string, Record<string, StatoPresenza>>

const leggiSegnate = (): Segnate => {
  try {
    const g = localStorage.getItem(DOVE)
    const o: unknown = g ? JSON.parse(g) : {}
    return o && typeof o === 'object' ? (o as Segnate) : {}
  } catch {
    return {}
  }
}

export function creaDatiProva(): Dati {
  let segnate = leggiSegnate()
  const salva = () => {
    try {
      localStorage.setItem(DOVE, JSON.stringify(segnate))
    } catch {
      /* Niente memoria: le presenze restano per questa sessione e basta. */
    }
  }

  const vista = (c: Definizione, giorno: string): SessioneVista => {
    const inizio = istante(giorno, c.ora)
    const fine = new Date(inizio.getTime() + c.durata * 60_000)
    const mie = segnate[idSessione(c.id, giorno)] ?? {}
    return {
      id: idSessione(c.id, giorno),
      corsoId: c.id,
      corso: c.nome,
      colore: c.colore,
      sala: c.sala,
      istruttore: c.istruttore,
      inizio: inizio.toISOString(),
      fine: fine.toISOString(),
      stato: 'prevista',
      iscritti: c.iscritti.length,
      presenti: Object.values(mie).filter((s) => s === 'presente').length,
    }
  }

  const trova = (sessioneId: string) => {
    for (const c of CORSI) {
      if (!sessioneId.startsWith(`s-${c.id}-`)) continue
      return { corso: c, giorno: sessioneId.slice(`s-${c.id}-`.length) }
    }
    return null
  }

  return {
    modo: 'prova',

    async calendario(da, a) {
      const fuori = new Date(a)
      fuori.setHours(23, 59, 59)
      const lezioni: SessioneVista[] = []
      for (const d = new Date(da); d <= fuori; d.setDate(d.getDate() + 1)) {
        const giorno = chiaveGiorno(d)
        for (const c of CORSI) if (c.giorno === d.getDay()) lezioni.push(vista(c, giorno))
      }
      return lezioni.sort((x, y) => x.inizio.localeCompare(y.inizio))
    },

    async dettaglio(sessioneId) {
      const t = trova(sessioneId)
      if (!t) return null
      const mie = segnate[sessioneId] ?? {}
      const elenco = t.corso.iscritti
        .map((n) => REGISTRO.get(n)!)
        .sort(perCognome)
        .map((p) => ({ ...p, stato: mie[p.id] ?? null }))
      return {
        sessione: vista(t.corso, t.giorno),
        elenco,
        allenamento: t.corso.allenamento ?? null,
      }
    },

    async segna(sessioneId, personaId, stato) {
      const mie = { ...(segnate[sessioneId] ?? {}) }
      if (stato === null) delete mie[personaId]
      else mie[personaId] = stato
      segnate = { ...segnate, [sessioneId]: mie }
      salva()
    },

    async segnaTutti(sessioneId, stato) {
      const t = trova(sessioneId)
      if (!t) return
      const mie: Record<string, StatoPresenza> = {}
      for (const n of t.corso.iscritti) mie[REGISTRO.get(n)!.id] = stato
      segnate = { ...segnate, [sessioneId]: mie }
      salva()
    },

    async chiudi() {
      /* In prova non c'è uno stato da chiudere: la lezione è sempre «prevista». */
    },
  }
}

/** Solo per le prove: svuota le presenze finte. */
export function scordaProva() {
  try {
    localStorage.removeItem(DOVE)
  } catch {
    /* pazienza */
  }
}
