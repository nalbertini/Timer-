import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Segment, Settings } from '../types'
import { Cues, buzz } from './audio'
import { COACH_LINES, coachedDisplay } from './engine'
import { hasClip, preload, say, unlockVoice } from './voice'
import { INTRO_CLIP, NUMBER_CLIP, STATE_CLIP, exerciseKey } from './voiceClips'

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
  /** Chiamata quando il conto mostrato risale, con la frase che gli scappa. */
  onCoachSlip?: (frase: string) => void,
) {
  const [status, setStatus] = useState<Status>('idle')
  const [elapsed, setElapsed] = useState(0)

  const cues = useRef(new Cues())
  const bankedRef = useRef(0)
  const anchorRef = useRef(0)
  const lastIndexRef = useRef(-1)
  const lastShownRef = useRef(-1)
  const introRef = useRef(false)
  const finishRef = useRef(onFinish)
  finishRef.current = onFinish
  const slipRef = useRef(onCoachSlip)
  slipRef.current = onCoachSlip

  cues.current.volume = settings.volume

  const voiceOpts = {
    volume: settings.volume,
    voiceURI: settings.voiceURI,
    useRecorded: settings.recordedVoice,
  }
  const voiceRef = useRef(voiceOpts)
  voiceRef.current = voiceOpts

  // Le clip che serviranno in questo allenamento, scaldate in anticipo.
  useEffect(() => {
    preload([
      INTRO_CLIP,
      ...Object.values(STATE_CLIP),
      ...Object.values(NUMBER_CLIP),
      ...COACH_LINES.map((_, i) => `maurizio/${i + 1}`),
      ...segments.map((s) => exerciseKey(s.name)),
    ])
  }, [segments])

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
        const base = seg.kind === 'work' ? [STATE_CLIP.work, exerciseKey(seg.name)] : [STATE_CLIP[seg.kind]]
        const testo = seg.kind === 'work' ? `${label}. ${seg.name}` : label
        const conIntro = introRef.current
        introRef.current = false
        void (async () => {
          // Il saluto apre solo il primo annuncio dell'allenamento, e solo se la
          // clip c'è davvero: in testa a una catena, una clip mancante farebbe
          // ripiegare sulla sintesi anche tutto il resto.
          const keys = conIntro && (await hasClip(INTRO_CLIP)) ? [INTRO_CLIP, ...base] : base
          await say(keys, testo, voiceRef.current)
        })()
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
        if (settings.voice) void say([STATE_CLIP.finish], 'Allenamento completato', voiceRef.current)
        finishRef.current(total, true)
        return
      }

      setElapsed(now)

      const i = indexAt(now)
      const seg = segments[i]
      if (!seg) return

      if (i !== lastIndexRef.current) {
        lastIndexRef.current = i
        lastShownRef.current = -1
        announce(seg)
        return
      }

      if (seg.countUp) return
      // Si reagisce al numero MOSTRATO, non a quello vero: altrimenti bip e
      // voce tradirebbero il ripensamento un attimo prima che si veda.
      const mostrato = Math.ceil(coachedDisplay(seg, seg.offset + seg.duration - now))
      if (mostrato < 1 || mostrato === lastShownRef.current) return
      const tornatoIndietro = lastShownRef.current > 0 && mostrato > lastShownRef.current
      lastShownRef.current = mostrato

      // L'esitazione può cadere ovunque nell'intervallo, non solo in fondo:
      // la battuta va quindi legata al numero che risale, non al conto finale.
      if (tornatoIndietro) {
        const i = Math.floor(Math.random() * COACH_LINES.length)
        slipRef.current?.(COACH_LINES[i])
        if (settings.voice) void say([`maurizio/${i + 1}`], COACH_LINES[i], voiceRef.current)
        return
      }

      if (mostrato > 3) return
      // Con la voce incisa il numero viene detto; il bip resta solo come
      // ripiego, per non raddoppiare il segnale.
      if (settings.recordedVoice && settings.voice) {
        void say([NUMBER_CLIP[mostrato]], '', voiceRef.current).then((detto) => {
          if (!detto && settings.countdownBeep) cues.current.countdown()
        })
      } else if (settings.countdownBeep) {
        cues.current.countdown()
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
    settings.recordedVoice,
  ])

  const start = useCallback(() => {
    cues.current.unlock()
    unlockVoice()
    introRef.current = true
    bankedRef.current = 0
    anchorRef.current = performance.now()
    lastIndexRef.current = -1
    lastShownRef.current = -1
    setElapsed(0)
    setStatus('running')
  }, [])

  const resume = useCallback(() => {
    cues.current.unlock()
    unlockVoice()
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
      lastShownRef.current = -1
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
      // A fine allenamento «avanti» non porta da nessuna parte: senza questo,
      // riportava indietro a un'ultima frazione di secondo, in pausa, come se
      // l'allenamento non fosse mai finito. Indietro invece resta utile.
      if (step === 1 && status === 'done') return
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
    lastShownRef.current = -1
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
