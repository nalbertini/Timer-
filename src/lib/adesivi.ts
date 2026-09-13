/**
 * Le illustrazioni che accompagnano la modalità Maurizio.
 *
 * Non sono precaricate con l'app: restano fuori dalla precache e si scaricano
 * la prima volta che servono, così chi non usa la modalità non se le porta
 * dietro. Da quel momento restano in cache e funzionano anche offline.
 */
const DIR = 'adesivi'

const url = (nome: string) => `${DIR}/${nome}.webp`

/** Quando lo becchi a sbagliare il conto. */
export const BECCATO = ['pollice-su', 'cronometro-130', 'cronometro-300', 'piegamenti'].map(url)

/** A fine allenamento. */
export const FINALE = ['good-work', 'esultanza', 'pugno', 'coppia-vittoria', 'jiu-jitsu-life'].map(url)

export const a_caso = (lista: string[]) => lista[Math.floor(Math.random() * lista.length)]
