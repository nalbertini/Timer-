import type { HistoryEntry, Settings, Workout } from '../types'
import { seedLibrary } from './presets'

const KEY_WORKOUTS = 'ods-timer:workouts'
const KEY_SETTINGS = 'ods-timer:settings'
const KEY_HISTORY = 'ods-timer:history'

export const DEFAULT_SETTINGS: Settings = {
  coach: 'off',
  countdownBeep: true,
  voice: true,
  vibrate: true,
  volume: 0.8,
  voiceURI: null,
  recordedVoice: true,
  keepAwake: true,
  bigScreen: false,
}

/**
 * Ogni lettura è difensiva: in incognito, con i dati del sito bloccati o dopo
 * una pulizia del browser, localStorage lancia o restituisce spazzatura.
 */
function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Spazio esaurito o storage negato: l'app resta usabile, non persiste.
  }
}

export function loadWorkouts(): Workout[] {
  const stored = read<Workout[] | null>(KEY_WORKOUTS, null)
  if (stored && Array.isArray(stored) && stored.length > 0) return stored
  const seeded = seedLibrary()
  write(KEY_WORKOUTS, seeded)
  return seeded
}

export const saveWorkouts = (list: Workout[]) => write(KEY_WORKOUTS, list)

export function loadSettings(): Settings {
  return { ...DEFAULT_SETTINGS, ...read<Partial<Settings>>(KEY_SETTINGS, {}) }
}

export const saveSettings = (s: Settings) => write(KEY_SETTINGS, s)

export const loadHistory = (): HistoryEntry[] => read<HistoryEntry[]>(KEY_HISTORY, [])

export function pushHistory(entry: HistoryEntry) {
  const list = [entry, ...loadHistory()].slice(0, 100)
  write(KEY_HISTORY, list)
  return list
}
