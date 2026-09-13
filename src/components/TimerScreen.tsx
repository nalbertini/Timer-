import { useEffect, useMemo, useRef } from 'react'
import type { Settings, Workout } from '../types'
import { buildSegments } from '../lib/engine'
import { clock } from '../lib/format'
import { useTimer } from '../lib/useTimer'
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
function Ring({ progress, color, size }: { progress: number; color: string; size: number }) {
  const r = 43
  const circumference = 2 * Math.PI * r
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" style={{ transform: 'rotate(-90deg)' }} aria-hidden="true">
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
  const segments = useMemo(() => buildSegments(workout), [workout])
  const { view, toggle, stop, skip } = useTimer(segments, settings, onFinish)
  const seg = view.segment

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

  // La barra spaziatrice mette in pausa: comoda sul tablet con tastiera e su desktop.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault()
        toggle()
      } else if (e.code === 'ArrowRight') skip(1)
      else if (e.code === 'ArrowLeft') skip(-1)
      else if (e.code === 'Escape') exitRef.current()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [toggle, skip])

  const color = seg ? STATE_COLOR[seg.kind] : 'var(--line)'
  const idle = view.status === 'idle'
  const done = view.status === 'done'

  const rounds = seg?.rounds ?? workout.rounds
  const roundDots = Array.from({ length: Math.min(rounds, 16) }, (_, i) => i + 1)

  return (
    <div className="timer" style={{ ['--state' as string]: done ? 'var(--verde)' : color }}>
      <div className="row" style={{ gap: 12, padding: 'calc(var(--safe-t) + 14px) 20px 0' }}>
        <button className="icon-btn" onClick={exit} aria-label="Chiudi il timer">
          <Close />
        </button>
        <div className="stack grow" style={{ gap: 1, minWidth: 0 }}>
          <span className="ob" style={{ fontSize: 18, fontWeight: 700, lineHeight: 1 }}>
            {workout.name.toUpperCase()}
          </span>
          <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.18em', color: 'var(--dim)' }}>
            {seg && seg.sets > 1 ? `SERIE ${seg.set} / ${seg.sets} · ` : ''}
            RESTA {clock(view.remainingTotal)}
          </span>
        </div>
        <button className="icon-btn" onClick={stop} aria-label="Azzera il timer">
          <span className="cond" style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.1em' }}>
            RESET
          </span>
        </button>
      </div>

      {rounds > 1 && (
        <div className="dots" style={{ padding: '16px 20px 0' }}>
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
        {done ? (
          <>
            <span className="state-label">COMPLETATO</span>
            <Digits value={clock(view.total)} />
            <span className="exercise">{workout.name}</span>
          </>
        ) : (
          <>
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <Ring progress={view.progress} color={color} size={300} />
              <div
                className="stack"
                style={{ position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center', gap: 2 }}
              >
                <span className="cond" style={{ fontSize: 15, fontWeight: 700, letterSpacing: '0.2em', color: 'var(--dim)' }}>
                  {idle ? 'PRONTO' : 'GIRO'}
                </span>
                <span className="num" style={{ fontSize: 46, fontWeight: 700, lineHeight: 1, color }}>
                  {seg ? `${seg.round || 1}/${seg.rounds}` : '—'}
                </span>
                <span className="cond" style={{ fontSize: 13, fontWeight: 600, letterSpacing: '0.16em', color: 'var(--dim)' }}>
                  TOTALE {clock(view.total)}
                </span>
              </div>
            </div>

            <div className="timer-col" style={{ alignItems: 'center', gap: 4 }}>
              <span className="state-label">{idle ? 'PRONTO' : (seg?.label ?? '')}</span>
              <Digits value={clock(idle ? (segments[0]?.duration ?? 0) : view.display)} />
              <span className="exercise">{idle ? workout.name : (seg?.name ?? '')}</span>
            </div>
          </>
        )}
      </div>

      <div style={{ height: 10, background: 'var(--surface-2)' }}>
        <div style={{ height: '100%', width: `${view.progress * 100}%`, background: color }} />
      </div>

      {view.next && !done && (
        <div className="row card" style={{ margin: '14px 20px 0', padding: '10px 14px', gap: 10 }}>
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.22em', color: 'var(--dim)' }}>PROSSIMO</span>
          <div className="grow" />
          <div style={{ width: 12, height: 12, background: STATE_COLOR[view.next.kind] }} />
          <span className="num" style={{ fontSize: 19, fontWeight: 600, color: '#b8b8b2' }}>
            {view.next.label} {view.next.duration}&quot;
          </span>
        </div>
      )}

      <div className="row" style={{ gap: 12, padding: '16px 20px calc(var(--safe-b) + 20px)' }}>
        <button className="icon-btn" style={{ width: 68, height: 68 }} onClick={() => skip(-1)} aria-label="Intervallo precedente">
          <Prev size={24} />
        </button>
        <button
          className="btn grow"
          style={{ height: 68, background: done ? 'var(--verde)' : color, color: '#121212' }}
          onClick={done ? exit : toggle}
        >
          {view.status === 'running' ? <Pause size={22} /> : <Play size={22} />}
          <span style={{ fontSize: 22 }}>
            {done ? 'CHIUDI' : view.status === 'running' ? 'PAUSA' : idle ? 'AVVIA' : 'RIPRENDI'}
          </span>
        </button>
        <button className="icon-btn" style={{ width: 68, height: 68 }} onClick={() => skip(1)} aria-label="Intervallo successivo">
          <Next size={24} />
        </button>
      </div>
    </div>
  )
}
