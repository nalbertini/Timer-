import { useEffect, useRef, useState } from 'react'
import type { Settings } from '../types'
import { Cues, speak } from '../lib/audio'
import { useWakeLock } from '../lib/wakeLock'
import { pad } from '../lib/format'
import { Close, Pause, Play } from './Icons'

/**
 * I due strumenti che non hanno bisogno di un allenamento scritto.
 *
 * In lezione capita in continuazione: «novanta secondi e si riparte», oppure
 * «vediamo quanto ci metti». Finora per tutte e due le cose bisognava costruire
 * un timer e salvarlo, cioè fermarsi a fare l'editor davanti a venti persone
 * ferme. Questi due partono con un tocco e non lasciano niente dietro.
 *
 * Il tempo arriva sempre dall'orologio e mai sommato un pezzo alla volta: è la
 * stessa regola del timer degli allenamenti, e serve perché un telefono che
 * mette in pausa la pagina non faccia restare indietro il conto.
 */

/* ------------------------------------------------------------------ *
 * Cronometro
 * ------------------------------------------------------------------ */

const centesimi = (ms: number) => Math.floor((ms % 1000) / 10)
const minutiSecondi = (ms: number) => {
  const s = Math.floor(ms / 1000)
  return `${pad(Math.floor(s / 60))}:${pad(s % 60)}`
}

export function CronometroScreen({ settings, onExit }: { settings: Settings; onExit: () => void }) {
  // `partito` è l'istante in cui è ripartito, `banca` quello già accumulato
  // prima dell'ultima pausa: il tempo mostrato è sempre la somma dei due letta
  // adesso, mai un contatore incrementato a ogni tick.
  const [partito, setPartito] = useState<number | null>(null)
  const [banca, setBanca] = useState(0)
  const [ora, setOra] = useState(0)
  const [giri, setGiri] = useState<number[]>([])

  const trascorso = banca + (partito === null ? 0 : ora - partito)
  const inCorso = partito !== null

  useEffect(() => {
    if (!inCorso) return
    let vivo = true
    const tic = () => {
      if (!vivo) return
      setOra(performance.now())
      requestAnimationFrame(tic)
    }
    requestAnimationFrame(tic)
    return () => {
      vivo = false
    }
  }, [inCorso])

  useWakeLock(settings.keepAwake && inCorso)

  const avviaOFerma = () => {
    if (inCorso) {
      setBanca(trascorso)
      setPartito(null)
    } else {
      const t = performance.now()
      setOra(t)
      setPartito(t)
    }
  }

  const azzera = () => {
    setPartito(null)
    setBanca(0)
    setGiri([])
  }

  /** Un giro segna il tempo di adesso: la lista tiene i totali, gli scarti si ricavano. */
  const segnaGiro = () => setGiri((g) => [...g, trascorso])

  const precedente = (i: number) => (i === 0 ? 0 : giri[i - 1])
  const inTesta = giri.length > 1 ? Math.min(...giri.map((g, i) => g - precedente(i))) : null

  return (
    <div className="timer" style={{ ['--state' as string]: 'var(--blu)' }}>
      <div className="row timer-top">
        <button className="icon-btn" onClick={onExit} aria-label="Chiudi il cronometro">
          <Close />
        </button>
        <div className="stack grow" style={{ gap: 1, minWidth: 0 }}>
          <span className="ob titolo-timer">CRONOMETRO</span>
          <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.18em', color: 'var(--dim)' }}>
            {giri.length ? `${giri.length} GIRI SEGNATI` : 'CONTA IN SALITA'}
          </span>
        </div>
        <button className="icon-btn testo" onClick={azzera} aria-label="Azzera il cronometro">
          <span className="cond" style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.1em' }}>
            AZZERA
          </span>
        </button>
      </div>

      <div className="crono-main">
        {/* I minuti restano grandi come nel timer, i centesimi stanno accanto e
            più piccoli: da lontano si legge il minuto, in mano il centesimo. */}
        <div className="crono-cifre">
          <span className="digits digits-crono" role="timer" aria-label={minutiSecondi(trascorso)}>
            {minutiSecondi(trascorso)}
          </span>
          <span className="crono-centesimi num">.{pad(centesimi(trascorso))}</span>
        </div>

        {giri.length > 0 && (
          <div className="crono-giri" aria-label="Giri segnati">
            {giri
              .map((tot, i) => ({ n: i + 1, tot, scarto: tot - precedente(i) }))
              .reverse()
              .map((g) => (
                <div key={g.n} className="crono-giro">
                  <span className="cond crono-giro-n">GIRO {pad(g.n)}</span>
                  <span
                    className="num crono-giro-scarto"
                    style={{ color: inTesta !== null && g.scarto === inTesta ? 'var(--verde)' : 'var(--text)' }}
                  >
                    {minutiSecondi(g.scarto)}.{pad(centesimi(g.scarto))}
                  </span>
                  <span className="num crono-giro-tot">
                    {minutiSecondi(g.tot)}.{pad(centesimi(g.tot))}
                  </span>
                </div>
              ))}
          </div>
        )}
      </div>

      <div className="row timer-controlli">
        <button
          className="btn btn-ghost tasto-giro"
          onClick={segnaGiro}
          disabled={!inCorso}
          aria-label="Segna un giro"
        >
          <span style={{ fontSize: 18 }}>GIRO</span>
        </button>
        <button
          className="btn grow tasto-avvia"
          style={{ background: 'var(--blu)', color: '#121212' }}
          onClick={avviaOFerma}
        >
          {inCorso ? <Pause size={22} /> : <Play size={22} />}
          <span style={{ fontSize: 22 }}>{inCorso ? 'FERMA' : trascorso > 0 ? 'RIPRENDI' : 'AVVIA'}</span>
        </button>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * Conto alla rovescia al volo
 * ------------------------------------------------------------------ */

/** Le durate che si chiedono davvero in sala, in secondi. */
export const DURATE_AL_VOLO = [30, 45, 60, 90, 120, 180]

export const etichettaDurata = (s: number) => (s < 60 ? `${s}″` : s % 60 === 0 ? `${s / 60}′` : `${Math.floor(s / 60)}′${s % 60}`)

export function ContaAllaRovesciaScreen({
  secondi,
  settings,
  onExit,
}: {
  secondi: number
  settings: Settings
  onExit: () => void
}) {
  const [durata, setDurata] = useState(secondi)
  // Parte subito: chi tocca «90″» ha già dato il via a voce.
  const [fine, setFine] = useState<number | null>(() => performance.now() + secondi * 1000)
  const [restoInPausa, setRestoInPausa] = useState(secondi * 1000)
  const [ora, setOra] = useState(() => performance.now())
  const cues = useRef(new Cues())
  const ultimoBip = useRef<number | null>(null)
  const finito = useRef(false)

  const resto = fine === null ? restoInPausa : Math.max(0, fine - ora)
  const inCorso = fine !== null && resto > 0
  const aZero = resto <= 0
  cues.current.volume = settings.volume

  useEffect(() => {
    if (fine === null) return
    const id = window.setInterval(() => setOra(performance.now()), 80)
    return () => window.clearInterval(id)
  }, [fine])

  // Bip degli ultimi tre secondi e segnale di fine: attaccati al secondo
  // mostrato, così suonano una volta sola anche se il tick passa più spesso.
  useEffect(() => {
    if (fine === null) return
    const s = Math.ceil(resto / 1000)
    if (s > 0 && s <= 3 && ultimoBip.current !== s) {
      ultimoBip.current = s
      if (settings.countdownBeep) cues.current.countdown()
    }
    if (resto <= 0 && !finito.current) {
      finito.current = true
      cues.current.finish()
      if (settings.voice) speak('Tempo', settings.volume, settings.voiceURI)
      setFine(null)
      setRestoInPausa(0)
    }
  }, [resto, fine, settings.countdownBeep, settings.voice, settings.volume, settings.voiceURI])

  useWakeLock(settings.keepAwake && inCorso)

  const riparti = (da: number) => {
    finito.current = false
    ultimoBip.current = null
    setDurata(da)
    setRestoInPausa(da * 1000)
    setFine(performance.now() + da * 1000)
    setOra(performance.now())
  }

  const pausaOAvvia = () => {
    if (inCorso) {
      setRestoInPausa(resto)
      setFine(null)
    } else if (aZero) riparti(durata)
    else {
      setFine(performance.now() + restoInPausa)
      setOra(performance.now())
    }
  }

  const allunga = () => {
    finito.current = false
    ultimoBip.current = null
    setDurata((d) => d + 30)
    if (fine === null) setRestoInPausa((r) => r + 30000)
    else setFine((f) => (f ?? performance.now()) + 30000)
  }

  const tinta = aZero ? 'var(--rosso)' : 'var(--verde)'
  const mostrato = Math.ceil(resto / 1000)

  return (
    <div className="timer" style={{ ['--state' as string]: tinta }}>
      <div className="row timer-top">
        <button className="icon-btn" onClick={onExit} aria-label="Chiudi il conto alla rovescia">
          <Close />
        </button>
        <div className="stack grow" style={{ gap: 1, minWidth: 0 }}>
          <span className="ob titolo-timer">AL VOLO</span>
          <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.18em', color: 'var(--dim)' }}>
            {etichettaDurata(durata)} IN TUTTO
          </span>
        </div>
        <button className="icon-btn testo" onClick={() => riparti(durata)} aria-label="Ricomincia">
          <span className="cond" style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.1em' }}>
            RIFAI
          </span>
        </button>
      </div>

      <div className="timer-main">
        <div className="timer-col" style={{ alignItems: 'center', gap: 4 }}>
          <span className="state-label">{aZero ? 'TEMPO' : inCorso ? 'RECUPERO' : 'IN PAUSA'}</span>
          <span className="digits" role="timer" aria-label={`${mostrato} secondi`}>
            {`${pad(Math.floor(mostrato / 60))}:${pad(mostrato % 60)}`}
          </span>
          <span className="exercise">{aZero ? 'Si riparte' : 'Fiato, e poi si va'}</span>
        </div>
      </div>

      {/* Cambiare durata senza uscire: è il gesto che si fa quando la sala
          risponde meglio o peggio del previsto. */}
      <div className="al-volo-scelte">
        {DURATE_AL_VOLO.map((s) => (
          <button key={s} className="chip" data-on={durata === s} onClick={() => riparti(s)}>
            {etichettaDurata(s)}
          </button>
        ))}
      </div>

      <div className="row timer-controlli">
        <button className="btn-piu" onClick={allunga} aria-label="Aggiungi trenta secondi">
          +30&Prime;
        </button>
        <button
          className="btn grow tasto-avvia"
          style={{ background: tinta, color: '#121212' }}
          onClick={pausaOAvvia}
        >
          {inCorso ? <Pause size={22} /> : <Play size={22} />}
          <span style={{ fontSize: 22 }}>{inCorso ? 'PAUSA' : aZero ? 'RIFAI' : 'RIPRENDI'}</span>
        </button>
      </div>
    </div>
  )
}
