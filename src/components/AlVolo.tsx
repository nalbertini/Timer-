import { useEffect, useRef, useState } from 'react'
import type { Settings } from '../types'
import { Cues, speak } from '../lib/audio'
import { useWakeLock } from '../lib/wakeLock'
import { pad } from '../lib/format'
import { Back, Pause, Play } from './Icons'
import { DentroAnello, Digits, Ring } from './Quadrante'

/**
 * I due strumenti che non hanno bisogno di un allenamento scritto.
 *
 * In lezione capita in continuazione: «novanta secondi e si riparte», oppure
 * «vediamo quanto ci metti». Per tutte e due le cose bisognava costruire un
 * timer e salvarlo, cioè fermarsi a fare l'editor davanti a venti persone
 * ferme. Questi due partono con un tocco e non lasciano niente dietro.
 *
 * Hanno l'impaginazione del timer degli allenamenti e non una loro: stessa
 * intestazione, stesso anello, stesse cifre, stessi comandi in fondo. Sono tre
 * schermate che contano il tempo, e chi le usa non deve impararle tre volte.
 *
 * Il tempo arriva sempre dall'orologio e mai sommato un pezzo alla volta: è la
 * stessa regola del timer degli allenamenti, e serve perché un telefono che
 * mette in pausa la pagina non faccia restare indietro il conto.
 */

/** Le durate che si chiedono davvero in sala, in secondi. */
export const DURATE_AL_VOLO = [30, 45, 60, 90, 120, 180]

export const etichettaDurata = (s: number) =>
  s < 60 ? `${s}″` : s % 60 === 0 ? `${s / 60}′` : `${Math.floor(s / 60)}′${s % 60}`

const centesimi = (ms: number) => Math.floor((ms % 1000) / 10)
const minutiSecondi = (ms: number) => {
  const s = Math.floor(ms / 1000)
  return `${pad(Math.floor(s / 60))}:${pad(s % 60)}`
}
const conCentesimi = (ms: number) => `${minutiSecondi(ms)}.${pad(centesimi(ms))}`

/* ------------------------------------------------------------------ *
 * Cronometro
 * ------------------------------------------------------------------ */

export function CronometroScreen({ settings }: { settings: Settings }) {
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
  const scarti = giri.map((g, i) => g - precedente(i))
  const inTesta = scarti.length > 1 ? Math.min(...scarti) : null
  const giroCorrente = trascorso - (giri.length ? giri[giri.length - 1] : 0)

  return (
    <div className="timer" data-attrezzo="true" style={{ ['--state' as string]: 'var(--blu)' }}>
      <div className="row timer-top">
        <div className="stack grow" style={{ gap: 1, minWidth: 0 }}>
          <span className="ob titolo-timer">CRONOMETRO</span>
          <span className="sottotitolo-timer" style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.18em', color: 'var(--dim)' }}>
            CONTA IN SALITA
          </span>
        </div>
        <button className="icon-btn testo" onClick={azzera} aria-label="Azzera il cronometro">
          <span className="cond" style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.1em' }}>
            AZZERA
          </span>
        </button>
      </div>

      <div className="timer-main">
        {/* L'anello fa da lancetta dei secondi — un giro al minuto — e dentro
            tiene il giro in corso, come nel timer tiene il round. */}
        <div className="anello">
          <Ring progress={(trascorso % 60000) / 60000} color="var(--blu)" />
          <DentroAnello
            etichetta="GIRO"
            numero={String(giri.length + 1)}
            sotto={giri.length ? conCentesimi(giroCorrente) : undefined}
            colore="var(--blu)"
          />
        </div>

        <div className="timer-col" style={{ alignItems: 'center', gap: 4 }}>
          <span className="state-label">{inCorso ? 'IN CORSA' : trascorso > 0 ? 'FERMO' : 'PRONTO'}</span>
          {/* I minuti restano della misura delle cifre del timer e i centesimi
              stanno accanto, un terzo: da lontano si legge il minuto, in mano
              il centesimo. */}
          <div className="crono-cifre">
            <Digits value={minutiSecondi(trascorso)} className="digits digits-crono" />
            <span className="crono-centesimi num">.{pad(centesimi(trascorso))}</span>
          </div>
          <span className="exercise">{giri.length ? `${giri.length} giri segnati` : 'Segna i giri con GIRO'}</span>
        </div>
      </div>

      {giri.length > 0 && (
        <div className="crono-giri" aria-label="Giri segnati">
          {giri
            .map((tot, i) => ({ n: i + 1, tot, scarto: scarti[i] }))
            .reverse()
            .map((g) => (
              <div key={g.n} className="crono-giro">
                <span className="cond crono-giro-n">GIRO {pad(g.n)}</span>
                <span
                  className="num crono-giro-scarto"
                  style={{ color: inTesta !== null && g.scarto === inTesta ? 'var(--verde)' : 'var(--text)' }}
                >
                  {conCentesimi(g.scarto)}
                </span>
                <span className="num crono-giro-tot">{conCentesimi(g.tot)}</span>
              </div>
            ))}
        </div>
      )}

      <div className="row timer-controlli">
        <button className="btn btn-ghost tasto-giro" onClick={segnaGiro} disabled={!inCorso} aria-label="Segna un giro">
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
 * Conto alla rovescia
 * ------------------------------------------------------------------ */

/**
 * La scheda: prima le durate, poi il conto.
 *
 * Restare nella stessa scheda invece di aprire una schermata sopra è ciò che
 * permette di tornare alle durate senza chiudere niente, che è il gesto che si
 * fa quando la sala chiede un altro mezzo minuto.
 */
export function CountdownTab({ settings }: { settings: Settings }) {
  const [scelta, setScelta] = useState<number | null>(null)
  if (scelta === null) return <ScegliDurata onScegli={setScelta} />
  return <ContaAllaRovescia key={scelta} secondi={scelta} settings={settings} onIndietro={() => setScelta(null)} />
}

function ScegliDurata({ onScegli }: { onScegli: (secondi: number) => void }) {
  return (
    <div className="scroll scelta-durate">
      <p className="pad" style={{ fontSize: 14, lineHeight: 1.45, color: 'var(--dim)', margin: '0 0 2px' }}>
        Parte al tocco, senza passare dall'editor. La durata si cambia anche a conto già iniziato.
      </p>
      <div className="pad" style={{ paddingTop: 14, paddingBottom: 24 }}>
        <div className="volo-griglia">
          {DURATE_AL_VOLO.map((s) => (
            <button
              key={s}
              className="volo-tessera"
              onClick={() => onScegli(s)}
              aria-label={`Conto alla rovescia di ${s} secondi`}
            >
              <span className="num volo-tessera-n">{etichettaDurata(s)}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

function ContaAllaRovescia({
  secondi,
  settings,
  onIndietro,
}: {
  secondi: number
  settings: Settings
  onIndietro: () => void
}) {
  const [durata, setDurata] = useState(secondi)
  // Parte subito: chi tocca «1′30» ha già dato il via a voce.
  const [fine, setFine] = useState<number | null>(() => performance.now() + secondi * 1000)
  const [restoInPausa, setRestoInPausa] = useState(secondi * 1000)
  const [ora, setOra] = useState(() => performance.now())
  const cues = useRef(new Cues())
  const ultimoBip = useRef<number | null>(null)
  const finito = useRef(false)

  const resto = fine === null ? restoInPausa : Math.max(0, fine - ora)
  const inCorso = fine !== null && resto > 0
  const aZero = resto <= 0
  const svolti = durata * 1000 - resto
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
  const avanzamento = durata > 0 ? Math.min(1, svolti / (durata * 1000)) : 0

  return (
    <div className="timer" data-attrezzo="true" style={{ ['--state' as string]: tinta }}>
      <div className="row timer-top">
        <button className="icon-btn" onClick={onIndietro} aria-label="Torna alle durate">
          <Back />
        </button>
        <div className="stack grow" style={{ gap: 1, minWidth: 0 }}>
          <span className="ob titolo-timer">CONTO ALLA ROVESCIA</span>
          <span className="sottotitolo-timer" style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.18em', color: 'var(--dim)' }}>
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
        <div className="anello">
          <Ring progress={avanzamento} color={tinta} />
          <DentroAnello
            etichetta="IN TUTTO"
            numero={etichettaDurata(durata)}
            sotto={`SVOLTI ${minutiSecondi(svolti)}`}
            colore={tinta}
          />
        </div>

        <div className="timer-col" style={{ alignItems: 'center', gap: 4 }}>
          <span className="state-label">{aZero ? 'TEMPO' : inCorso ? 'RECUPERO' : 'IN PAUSA'}</span>
          <Digits value={`${pad(Math.floor(mostrato / 60))}:${pad(mostrato % 60)}`} />
          <span className="exercise">{aZero ? 'Si riparte' : 'Fiato, e poi si va'}</span>
        </div>
      </div>

      <div style={{ height: 10, background: 'var(--surface-2)' }}>
        <div style={{ height: '100%', width: `${avanzamento * 100}%`, background: tinta }} />
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
        <button className="btn grow tasto-avvia" style={{ background: tinta, color: '#121212' }} onClick={pausaOAvvia}>
          {inCorso ? <Pause size={22} /> : <Play size={22} />}
          <span style={{ fontSize: 22 }}>{inCorso ? 'PAUSA' : aZero ? 'RIFAI' : 'RIPRENDI'}</span>
        </button>
      </div>
    </div>
  )
}
