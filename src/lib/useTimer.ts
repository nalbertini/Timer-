import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Segment, Settings } from '../types'
import { Cues, buzz, speak } from './audio'
import { COACH_LINES, coachedDisplay } from './engine'

export type Status = 'idle' | 'running' | 'paused' | 'done'

export interface TimerView {
  status: Status
  segment: Segment | null
  index: number
  /** Secondi mostrati nel quadrante: scendono, o salgono nei For Time. */
  display: number
  /** Da 0 a 1 dentro il segmento corrente. */
  progress: number
  /** Secondi che mancano alla fine dell'allenamento. */
  remainingTotal: number
  elapsed: number
  total: number
  next: Segment | null
}

/**
 * Il tempo viene sempre ricavato dall'orologio, mai accumulato tick dopo tick:
 * così un tab in background, messo in pausa dal sistema, riallinea da solo il
 * conteggio invece di restare indietro.
 */
export function useTimer(
  segments: Segment[],
  settings: Settings,
  onFinish: (seconds: number, completed: boolean) => void,
) {
  const [status, setStatus] = useState<Status>('idle')
  const [elapsed, setElapsed] = useState(0)

  const cues = useRef(new Cues())
  const bankedRef = useRef(0)
  const anchorRef = useRef(0)
  const lastIndexRef = useRef(-1)
  const lastBeepRef = useRef(-1)
  const finishRef = useRef(onFinish)
  finishRef.current = onFinish

  cues.current.volume = settings.volume

  const total = useMemo(() => {
    const last = segments[segments.length - 1]
    return last ? last.offset + last.duration : 0
  }, [segments])

  const indexAt = useCallback(
    (t: number) => {
      if (segments.length === 0) return -1
      for (let i = segments.length - 1; i >= 0; i--) {
        if (t >= segments[i].offset) return i
      }
      return 0
    },
    [segments],
  )

  const announce = useCallback(
    (seg: Segment) => {
      if (seg.kind === 'work') cues.current.work()
      else cues.current.rest()
      if (settings.vibrate) buzz(seg.kind === 'work' ? [90, 60, 90] : 60)
      if (settings.voice) {
        const label = seg.label.toLowerCase()
        speak(seg.kind === 'work' ? `${label}. ${seg.name}` : label, settings.volume, settings.voiceURI)
      }
    },
    [settings.vibrate, settings.voice, settings.volume, settings.voiceURI],
  )

  useEffect(() => {
    if (status !== 'running') return

    const tick = () => {
      const now = bankedRef.current + (performance.now() - anchorRef.current) / 1000

      if (total > 0 && now >= total) {
        bankedRef.current = total
        setElapsed(total)
        setStatus('done')
        cues.current.finish()
        if (settings.vibrate) buzz([200, 100, 200, 100, 300])
        if (settings.voice) speak('Allenamento completato', settings.volume, settings.voiceURI)
        finishRef.current(total, true)
        return
      }

      setElapsed(now)

      const i = indexAt(now)
      const seg = segments[i]
      if (!seg) return

      if (i !== lastIndexRef.current) {
        lastIndexRef.current = i
        lastBeepRef.current = -1
        announce(seg)
        return
      }

      if (seg.countUp) return
      // I bip seguono il numero MOSTRATO, non quello vero: altrimenti
      // tradirebbero il ripensamento di Maurizio un attimo prima che si veda.
      const left = Math.ceil(coachedDisplay(seg, seg.offset + seg.duration - now))
      if (left > 3 || left < 1 || left === lastBeepRef.current) return
      const wentBackUp = lastBeepRef.current > 0 && left > lastBeepRef.current
      lastBeepRef.current = left
      if (settings.countdownBeep) cues.current.countdown()
      if (wentBackUp && settings.voice) {
        speak(COACH_LINES[Math.floor(Math.random() * COACH_LINES.length)], settings.volume, settings.voiceURI)
      }
    }

    const id = window.setInterval(tick, 100)
    tick()
    return () => window.clearInterval(id)
  }, [
    status,
    total,
    segments,
    indexAt,
    announce,
    settings.countdownBeep,
    settings.vibrate,
    settings.voice,
    settings.volume,
    settings.voiceURI,
  ])

  const start = useCallback(() => {
    cues.current.unlock()
    bankedRef.current = 0
    anchorRef.current = performance.now()
    lastIndexRef.current = -1
    lastBeepRef.current = -1
    setElapsed(0)
    setStatus('running')
  }, [])

  const resume = useCallback(() => {
    cues.current.unlock()
    anchorRef.current = performance.now()
    // Riparte dal segmento corrente senza riannunciarlo.
    lastIndexRef.current = indexAt(bankedRef.current)
    setStatus('running')
  }, [indexAt])

  const pause = useCallback(() => {
    bankedRef.current = bankedRef.current + (performance.now() - anchorRef.current) / 1000
    setElapsed(bankedRef.current)
    setStatus('paused')
  }, [])

  const toggle = useCallback(() => {
    if (status === 'running') pause()
    else if (status === 'paused') resume()
    else start()
  }, [status, pause, resume, start])

  const seekTo = useCallback(
    (seconds: number) => {
      const t = Math.max(0, Math.min(seconds, Math.max(0, total - 0.001)))
      bankedRef.current = t
      anchorRef.current = performance.now()
      setElapsed(t)
      lastBeepRef.current = -1
      const i = indexAt(t)
      lastIndexRef.current = i
      if (status === 'done') setStatus('paused')
      const seg = segments[i]
      if (seg && status === 'running') announce(seg)
    },
    [total, indexAt, segments, status, announce],
  )

  const skip = useCallback(
    (step: 1 | -1) => {
      const now = bankedRef.current + (status === 'running' ? (performance.now() - anchorRef.current) / 1000 : 0)
      const i = indexAt(now)
      if (i < 0) return
      if (step === -1) {
        // Come su un lettore musicale: indietro torna all'inizio del segmento,
        // e solo se sei appena partito salta a quello precedente.
        const intoSegment = now - segments[i].offset
        const target = intoSegment > 1.5 ? i : Math.max(0, i - 1)
        seekTo(segments[target].offset)
        return
      }
      const next = segments[i + 1]
      if (next) seekTo(next.offset)
      else seekTo(total)
    },
    [status, indexAt, segments, seekTo, total],
  )

  const stop = useCallback(() => {
    const done = bankedRef.current + (status === 'running' ? (performance.now() - anchorRef.current) / 1000 : 0)
    // A fine allenamento lo storico è già stato scritto: non registrarlo due volte.
    if (done > 1 && status !== 'done') finishRef.current(done, false)
    bankedRef.current = 0
    setElapsed(0)
    lastIndexRef.current = -1
    lastBeepRef.current = -1
    setStatus('idle')
  }, [status])

  const view: TimerView = useMemo(() => {
    const index = indexAt(elapsed)
    const segment = segments[index] ?? null
    const into = segment ? elapsed - segment.offset : 0
    const real = segment ? (segment.countUp ? into : segment.duration - into) : 0
    const display = segment ? coachedDisplay(segment, real) : 0
    return {
      status,
      segment,
      index,
      display: Math.max(0, display),
      progress: segment && segment.duration > 0 ? Math.min(1, Math.max(0, into / segment.duration)) : 0,
      remainingTotal: Math.max(0, total - elapsed),
      elapsed,
      total,
      next: segments[index + 1] ?? null,
    }
  }, [elapsed, indexAt, segments, status, total])

  return { view, start, pause, resume, toggle, stop, skip, seekTo }
}
