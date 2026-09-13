import { useEffect, useMemo, useRef, useState } from 'react'
import type { Settings, Workout } from '../types'
import { applyCoach, buildSegments, describe } from '../lib/engine'
import { BECCATO, FINALE, a_caso, perStato } from '../lib/adesivi'
import { clock } from '../lib/format'
import { useTimer } from '../lib/useTimer'
import { segnalaTimerAperto } from '../lib/aggiornamento'
import { useWakeLock } from '../lib/wakeLock'
import { Close, Next, Pause, Play, Prev } from './Icons'

const STATE_COLOR = {
  prepare: 'var(--prepare)',
  work: 'var(--work)',
  rest: 'var(--rest)',
  setRest: 'var(--setRest)',
  cooldown: 'var(--cooldown)',
} as const

/** Anello a ingranaggio: il tratteggio richiama i denti del marchio. */
function Ring({ progress, color }: { progress: number; color: string }) {
  const r = 43
  const circumference = 2 * Math.PI * r
  return (
    <svg viewBox="0 0 100 100" style={{ transform: 'rotate(-90deg)' }} aria-hidden="true">
      <circle cx="50" cy="50" r={r} fill="none" stroke="var(--surface-2)" strokeWidth="9" strokeDasharray="9 10.4" />
      <circle
        cx="50"
        cy="50"
        r={r}
        fill="none"
        stroke={color}
        strokeWidth="9"
        strokeDasharray={`${(circumference * progress).toFixed(2)} ${circumference.toFixed(2)}`}
      />
    </svg>
  )
}

/**
 * Ogni cifra occupa esattamente la larghezza dello zero del font corrente (1ch).
 * `tabular-nums` da solo non basta: vale solo se il font espone la feature
 * `tnum`, altrimenti i numeri cambiano larghezza a ogni secondo e il blocco,
 * essendo centrato, balla da destra a sinistra.
 */
function Digits({ value }: { value: string }) {
  return (
    <div className="digits" role="timer" aria-label={value}>
      {value.split('').map((ch, i) =>
        ch >= '0' && ch <= '9' ? (
          <span key={i} aria-hidden="true" style={{ display: 'inline-block', width: '1ch', textAlign: 'center' }}>
            {ch}
          </span>
        ) : (
          <span key={i} aria-hidden="true">
            {ch}
          </span>
        ),
      )}
    </div>
  )
}

export function TimerScreen({
  workout,
  settings,
  onExit,
  onFinish,
}: {
  workout: Workout
  settings: Settings
  onExit: () => void
  onFinish: (seconds: number, completed: boolean) => void
}) {
  // I secondi regalati da Maurizio si estraggono a ogni avvio: due giri dello
  // stesso allenamento non cadono negli stessi punti.
  const [run, setRun] = useState(0)
  const segments = useMemo(
    () => applyCoach(buildSegments(workout), settings.coach),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [workout, settings.coach, run],
  )
  // L'illustrazione che compare quando Maurizio si tradisce, e quella finale.
  const [beccato, setBeccato] = useState<{ src: string; frase: string } | null>(null)
  const [finale] = useState(() => a_caso(FINALE))
  const timeoutBeccato = useRef<number | undefined>(undefined)

  const { view, toggle, stop, skip } = useTimer(segments, settings, onFinish, (frase) => {
    if (settings.coach === 'off') return
    setBeccato({ src: a_caso(BECCATO), frase })
    window.clearTimeout(timeoutBeccato.current)
    timeoutBeccato.current = window.setTimeout(() => setBeccato(null), 3200)
  })
  useEffect(() => () => window.clearTimeout(timeoutBeccato.current), [])

  // Finché questa schermata è aperta l'app non si ricarica da sola per un
  // aggiornamento: un allenamento a metà vale più di una versione nuova subito.
  useEffect(() => {
    segnalaTimerAperto(true)
    return () => segnalaTimerAperto(false)
  }, [])

  const seg = view.segment

  // Estratta una volta per segmento: cambiarla a ogni render la farebbe
  // lampeggiare, e durante il lavoro non ce n'è, di proposito.
  const chiaveSegmento = seg ? `${seg.kind}-${seg.offset}` : ''
  const [statoFermo, setStatoFermo] = useState<{ chiave: string; src: string | null }>({ chiave: '', src: null })
  useEffect(() => {
    setStatoFermo((prec) => (prec.chiave === chiaveSegmento ? prec : { chiave: chiaveSegmento, src: perStato(seg?.kind) }))
  }, [chiaveSegmento, seg?.kind])

  const startOrToggle = () => {
    if (view.status === 'idle' || view.status === 'done') setRun((n) => n + 1)
    toggle()
  }

  useWakeLock(settings.keepAwake && view.status === 'running')

  // La barra e la tacca del browser prendono il colore dello stato.
  useEffect(() => {
    const meta = document.querySelector('meta[name="theme-color"]')
    const kind = seg?.kind
    const map: Record<string, string> = {
      prepare: '#f4c31b',
      work: '#e4292a',
      rest: '#16a54a',
      setRest: '#1b8ac4',
      cooldown: '#1b8ac4',
    }
    meta?.setAttribute('content', view.status === 'running' && kind ? map[kind] : '#121212')
    return () => meta?.setAttribute('content', '#121212')
  }, [seg?.kind, view.status])

  // Uscire a metà non butta via il lavoro fatto: stop() lo registra come interrotto.
  const exit = () => {
    stop()
    onExit()
  }
  // La scorciatoia da tastiera deve chiamare sempre l'ultima versione di exit,
  // senza per questo riagganciare il listener a ogni render.
  const exitRef = useRef(exit)
  exitRef.current = exit
  const startOrToggleRef = useRef(startOrToggle)
  startOrToggleRef.current = startOrToggle

  // La barra spaziatrice mette in pausa: comoda sul tablet con tastiera e su desktop.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault()
        startOrToggleRef.current()
      } else if (e.code === 'ArrowRight') skip(1)
      else if (e.code === 'ArrowLeft') skip(-1)
      else if (e.code === 'Escape') exitRef.current()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [skip])

  const idle = view.status === 'idle'
  const done = view.status === 'done'
  const color = seg ? STATE_COLOR[seg.kind] : 'var(--line)'
  // A fine allenamento comanda il verde: bordo, barra e pulsante devono dire
  // la stessa cosa, non restare sul colore dell'ultimo intervallo.
  const tinta = done ? 'var(--verde)' : color

  const rounds = seg?.rounds ?? workout.rounds
  const roundDots = Array.from({ length: Math.min(rounds, 16) }, (_, i) => i + 1)

  return (
    <div className="timer" style={{ ['--state' as string]: tinta }}>
      <div className="row timer-top">
        <button className="icon-btn" onClick={exit} aria-label="Chiudi il timer">
          <Close />
        </button>
        <div className="stack grow" style={{ gap: 1, minWidth: 0 }}>
          <span className="ob titolo-timer">{workout.name.toUpperCase()}</span>
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: '0.18em',
              color: 'var(--dim)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {seg && seg.sets > 1 ? `SERIE ${seg.set} / ${seg.sets}` : describe(workout).toUpperCase()}
          </span>
        </div>
        {settings.coach !== 'off' && (
          <span
            className="badge"
            style={{ background: 'var(--giallo)', alignSelf: 'center', fontSize: 11, letterSpacing: '0.12em', padding: '5px 9px' }}
            title="Maurizio ogni tanto perde il conto"
          >
            MAURIZIO
          </span>
        )}
        <button className="icon-btn" onClick={stop} aria-label="Azzera il timer">
          <span className="cond" style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.1em' }}>
            RESET
          </span>
        </button>
      </div>

      {rounds > 1 && (
        <div className="dots timer-dots">
          {roundDots.map((r) => {
            const cur = seg?.round ?? 0
            return (
              <span
                key={r}
                style={{
                  background: r === cur ? color : r < cur ? '#4a4a46' : 'transparent',
                  borderColor: r === cur ? color : 'var(--line)',
                }}
              />
            )
          })}
        </div>
      )}

      <div className="timer-main">
        {statoFermo.src && !done && !beccato && view.status !== 'idle' && (
          <img className="adesivo-stato" src={statoFermo.src} alt="" />
        )}
        {done ? (
          <>
            {settings.coach !== 'off' && <img className="adesivo-finale" src={finale} alt="" />}
            <span className="state-label">COMPLETATO</span>
            <Digits value={clock(view.total)} />
            <span className="exercise">{workout.name}</span>
          </>
        ) : (
          <>
            <div className="anello">
              <Ring progress={view.progress} color={color} />
              <div
                className="stack"
                style={{ position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center', gap: 2 }}
              >
                <span className="cond" style={{ fontSize: 15, fontWeight: 700, letterSpacing: '0.2em', color: 'var(--dim)' }}>
                  GIRO
                </span>
                <span className="num" style={{ fontSize: 46, fontWeight: 700, lineHeight: 1, color }}>
                  {seg ? `${seg.round || 1}/${seg.rounds}` : '—'}
                </span>
                <span className="cond" style={{ fontSize: 13, fontWeight: 600, letterSpacing: '0.16em', color: 'var(--dim)' }}>
                  RESTA {clock(view.remainingTotal)}
                </span>
              </div>
            </div>

            <div className="timer-col" style={{ alignItems: 'center', gap: 4 }}>
              <span className="state-label">{idle ? 'PRONTO' : (seg?.label ?? '')}</span>
              <Digits value={clock(idle ? (segments[0]?.duration ?? 0) : view.display)} />
              <span className="exercise">{idle ? workout.name : (seg?.name ?? '')}</span>
              {!idle && seg?.nota && <span className="obiettivo">{seg.nota}</span>}
            </div>
          </>
        )}
      </div>

      {beccato && !done && (
        <div className="beccato">
          <img src={beccato.src} alt="" />
          <span className="beccato-frase">{beccato.frase}</span>
        </div>
      )}

      <div style={{ height: 10, background: 'var(--surface-2)' }}>
        <div style={{ height: '100%', width: `${done ? 100 : view.progress * 100}%`, background: tinta }} />
      </div>

      {/* Il giro che Maurizio si inventa non si annuncia in anticipo: se lo
          leggi qui non è più uno scherzo, è una riga di programma. */}
      {view.next && view.next.extra === undefined && !done && (
        <div className="row card timer-prossimo">
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.22em', color: 'var(--dim)' }}>PROSSIMO</span>
          <div className="grow" style={{ minWidth: 8 }} />
          <div style={{ width: 12, height: 12, flexShrink: 0, background: STATE_COLOR[view.next.kind] }} />
          <span
            className="num"
            style={{
              fontSize: 19,
              fontWeight: 600,
              color: '#b8b8b2',
              minWidth: 0,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {view.next.kind === 'work' && view.next.name ? view.next.name : view.next.label} {view.next.duration}
            &quot;
          </span>
        </div>
      )}

      <div className="row timer-controlli">
        <button className="icon-btn tasto-salto" onClick={() => skip(-1)} aria-label="Intervallo precedente">
          <Prev size={24} />
        </button>
        <button
          className="btn grow tasto-avvia"
          style={{ background: tinta, color: '#121212' }}
          onClick={done ? exit : startOrToggle}
        >
          {view.status === 'running' ? <Pause size={22} /> : <Play size={22} />}
          <span style={{ fontSize: 22 }}>
            {done ? 'CHIUDI' : view.status === 'running' ? 'PAUSA' : idle ? 'AVVIA' : 'RIPRENDI'}
          </span>
        </button>
        <button className="icon-btn tasto-salto" onClick={() => skip(1)} aria-label="Intervallo successivo">
          <Next size={24} />
        </button>
      </div>
    </div>
  )
}
