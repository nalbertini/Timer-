import { uid } from './format'

/**
 * Il catalogo degli esercizi.
 *
 * Serve a non riscrivere gli stessi nomi a ogni timer, ma soprattutto a rendere
 * finito l'insieme dei nomi: la clip della voce di un esercizio si chiama come
 * il suo nome, quindi con un catalogo diventa un elenco che si può incidere.
 */
export type Categoria = 'Judo' | 'A corpo libero' | 'Attrezzi' | 'Core' | 'Cardio' | 'Mobilità'

export const CATEGORIE: Categoria[] = ['Judo', 'A corpo libero', 'Attrezzi', 'Core', 'Cardio', 'Mobilità']

export interface Esercizio {
  id: string
  nome: string
  categoria: Categoria
  /** Vero per quelli aggiunti a mano: solo quelli si possono togliere. */
  propri?: boolean
}

const CHIAVE = 'ods-timer:esercizi'

/** Un punto di partenza per una palestra di judo, da curare a piacere. */
function catalogoIniziale(): Esercizio[] {
  const per = (categoria: Categoria, nomi: string[]): Esercizio[] =>
    nomi.map((nome) => ({ id: uid(), nome, categoria }))
  return [
    ...per('Judo', [
      'Uchi komi', 'Nage komi', 'Ukemi', 'Ne waza', 'Randori', 'Kuzushi',
      'Entrate di seoi nage', 'Passaggi di guardia', 'Sprawl', 'Fuga d’anca', 'Ponte',
    ]),
    ...per('A corpo libero', [
      'Burpee', 'Burpee + salto', 'Piegamenti', 'Squat', 'Jump squat', 'Affondi alternati',
      'Plank jack', 'Mountain climber', 'Salto sul box', 'Trazioni', 'Dip', 'Step up',
    ]),
    ...per('Attrezzi', [
      'Kettlebell swing', 'Goblet squat', 'Stacco rumeno', 'Panca piana', 'Lat machine',
      'Leg press', 'Vogatore', 'Palla medica', 'Trascinamento sacco', 'Corda da arrampicata',
    ]),
    ...per('Core', [
      'Plank', 'Plank laterale', 'Hollow hold', 'Russian twist', 'Bicicletta', 'V-up',
      'Superman', 'Sit up',
    ]),
    ...per('Cardio', [
      'Corsa sul posto', 'Skip alto', 'Salti con la corda', 'Jumping jack', 'Scatti navetta', 'Cyclette',
    ]),
    ...per('Mobilità', [
      'Mobilità anche', 'Mobilità spalle', 'Rotazioni del busto', 'Stretching collo', 'Respirazione',
    ]),
  ]
}

function leggi<T>(chiave: string, ripiego: T): T {
  try {
    const grezzo = localStorage.getItem(chiave)
    return grezzo ? (JSON.parse(grezzo) as T) : ripiego
  } catch {
    return ripiego
  }
}

export function loadEsercizi(): Esercizio[] {
  const salvati = leggi<Esercizio[] | null>(CHIAVE, null)
  if (salvati && Array.isArray(salvati) && salvati.length > 0) return salvati
  const iniziale = catalogoIniziale()
  saveEsercizi(iniziale)
  return iniziale
}

export function saveEsercizi(lista: Esercizio[]) {
  try {
    localStorage.setItem(CHIAVE, JSON.stringify(lista))
  } catch {
    // Spazio esaurito o storage negato: il catalogo resta valido per questa sessione.
  }
}

/** Ricerca tollerante: senza accenti e senza badare alle maiuscole. */
export function normalizza(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
}
