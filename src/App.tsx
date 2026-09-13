import { useCallback, useEffect, useMemo, useState } from 'react'
import type { HistoryEntry, Settings, Workout } from './types'
import { DEFAULT_SETTINGS, loadHistory, loadSettings, loadWorkouts, pushHistory, saveSettings, saveWorkouts } from './lib/storage'
import { blankWorkout } from './lib/presets'
import { uid } from './lib/format'
import { HomeScreen } from './components/HomeScreen'
import { PresetScreen } from './components/PresetScreen'
import { EditorScreen } from './components/EditorScreen'
import { TimerScreen } from './components/TimerScreen'
import { SettingsScreen } from './components/SettingsScreen'
import { HistoryScreen } from './components/HistoryScreen'
import { Gear, History, Library, TimerIcon } from './components/Icons'
import { Logo, Wordmark } from './components/Logo'

type Tab = 'timer' | 'preset' | 'storico' | 'impostazioni'
type View = { kind: 'tabs' } | { kind: 'editor'; workout: Workout } | { kind: 'run'; workout: Workout }

const TABS: Array<{ key: Tab; label: string; icon: typeof TimerIcon }> = [
  { key: 'timer', label: 'TIMER', icon: TimerIcon },
  { key: 'preset', label: 'PRESET', icon: Library },
  { key: 'storico', label: 'STORICO', icon: History },
  { key: 'impostazioni', label: 'IMPOSTAZIONI', icon: Gear },
]

const TAB_TITLE: Record<Tab, string> = {
  timer: 'I TUOI TIMER',
  preset: 'PRESET',
  storico: 'STORICO',
  impostazioni: 'IMPOSTAZIONI',
}

export default function App() {
  const [workouts, setWorkouts] = useState<Workout[]>(() => loadWorkouts())
  const [settings, setSettings] = useState<Settings>(() => loadSettings())
  const [history, setHistory] = useState<HistoryEntry[]>(() => loadHistory())
  const [tab, setTab] = useState<Tab>('timer')
  const [view, setView] = useState<View>({ kind: 'tabs' })

  useEffect(() => saveWorkouts(workouts), [workouts])
  useEffect(() => saveSettings(settings), [settings])

  const patchSettings = useCallback((patch: Partial<Settings>) => {
    setSettings((s) => ({ ...DEFAULT_SETTINGS, ...s, ...patch }))
  }, [])

  const upsert = useCallback((w: Workout) => {
    setWorkouts((list) => {
      const i = list.findIndex((x) => x.id === w.id)
      if (i === -1) return [w, ...list]
      const copy = [...list]
      copy[i] = w
      return copy
    })
  }, [])

  const recordFinish = useCallback(
    (workout: Workout) => (seconds: number, completed: boolean) => {
      const entry: HistoryEntry = {
        id: uid(),
        workoutId: workout.id,
        workoutName: workout.name,
        finishedAt: Date.now(),
        seconds: Math.round(seconds),
        completed,
      }
      setHistory(pushHistory(entry))
    },
    [],
  )

  const startWorkout = useCallback((w: Workout) => setView({ kind: 'run', workout: w }), [])

  const duplicate = useCallback(
    (w: Workout) => {
      const copy: Workout = { ...w, id: uid(), name: `${w.name} (copia)`, builtin: false, updatedAt: Date.now() }
      upsert(copy)
      setView({ kind: 'editor', workout: copy })
    },
    [upsert],
  )

  const remove = useCallback((w: Workout) => {
    if (!window.confirm(`Eliminare “${w.name}”?`)) return
    setWorkouts((list) => list.filter((x) => x.id !== w.id))
  }, [])

  const body = useMemo(() => {
    switch (tab) {
      case 'timer':
        return (
          <HomeScreen
            workouts={workouts}
            onStart={startWorkout}
            onEdit={(w) => setView({ kind: 'editor', workout: w })}
            onDuplicate={duplicate}
            onDelete={remove}
            onNew={() => setView({ kind: 'editor', workout: blankWorkout('interval') })}
          />
        )
      case 'preset':
        return <PresetScreen onPick={(w) => setView({ kind: 'editor', workout: w })} />
      case 'storico':
        return <HistoryScreen entries={history} />
      case 'impostazioni':
        return <SettingsScreen settings={settings} onChange={patchSettings} historyCount={history.length} />
    }
  }, [tab, workouts, history, settings, startWorkout, duplicate, remove, patchSettings])

  if (view.kind === 'run') {
    return (
      <TimerScreen
        workout={view.workout}
        settings={settings}
        onExit={() => setView({ kind: 'tabs' })}
        onFinish={recordFinish(view.workout)}
      />
    )
  }

  if (view.kind === 'editor') {
    return (
      <EditorScreen
        initial={view.workout}
        onCancel={() => setView({ kind: 'tabs' })}
        onSave={(w) => {
          upsert(w)
          setTab('timer')
          setView({ kind: 'tabs' })
        }}
        onSaveAndStart={(w) => {
          upsert(w)
          setView({ kind: 'run', workout: w })
        }}
      />
    )
  }

  return (
    <div className="shell">
      <nav className="sidebar">
        <div className="stack" style={{ gap: 10, padding: '0 22px 26px' }}>
          <Logo width={104} />
          <Wordmark />
        </div>
        <div className="stack" style={{ gap: 2, padding: '0 12px' }}>
          {TABS.map((t) => (
            <button key={t.key} className="navitem" data-on={tab === t.key} onClick={() => setTab(t.key)}>
              <i />
              {t.label}
            </button>
          ))}
        </div>
      </nav>

      <div className="app content">
        <header className="topbar">
          <div style={{ display: 'contents' }} className="only-mobile">
            <Logo width={58} />
            <Wordmark />
          </div>
          <div className="grow" />
          <span className="ob page-title" style={{ fontSize: 20, fontWeight: 700, letterSpacing: '0.08em', color: 'var(--dim)' }}>
            {TAB_TITLE[tab]}
          </span>
        </header>

        <div className="scroll">{body}</div>

        <nav className="tabbar">
          {TABS.map((t) => {
            const Icon = t.icon
            return (
              <button key={t.key} className="tab" data-on={tab === t.key} onClick={() => setTab(t.key)}>
                <Icon />
                {t.label}
              </button>
            )
          })}
        </nav>
      </div>
    </div>
  )
}
