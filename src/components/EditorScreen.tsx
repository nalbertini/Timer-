import { useState } from 'react'
import type { Mode, Workout } from '../types'
import { MODE_BADGE, MODE_FIELDS, MODE_HINT, MODE_LABEL, buildSegments, totalDuration } from '../lib/engine'
import { clock, uid } from '../lib/format'
import { Back, Drag, Minus, Play, Plus, Trash } from './Icons'

type Field = keyof Workout

const FIELD_META: Record<string, { label: string; unit: string; step: number; min: number; max: number; tint: string }> = {
  prepare: { label: 'PREPARAZIONE', unit: 's', step: 5, min: 0, max: 120, tint: 'var(--giallo)' },
  work: { label: 'LAVORO', unit: 's', step: 5, min: 5, max: 600, tint: 'var(--rosso)' },
  rest: { label: 'RECUPERO', unit: 's', step: 5, min: 0, max: 600, tint: 'var(--verde)' },
  rounds: { label: 'ROUND', unit: '×', step: 1, min: 1, max: 99, tint: 'var(--text)' },
  sets: { label: 'SERIE', unit: '×', step: 1, min: 1, max: 20, tint: 'var(--text)' },
  setRest: { label: 'RIPOSO SERIE', unit: 's', step: 15, min: 0, max: 600, tint: 'var(--blu)' },
  cooldown: { label: 'DEFATICAMENTO', unit: 's', step: 15, min: 0, max: 900, tint: 'var(--blu)' },
  duration: { label: 'DURATA', unit: 'min', step: 60, min: 60, max: 5400, tint: 'var(--giallo)' },
}

const MODES: Mode[] = ['interval', 'circuit', 'emom', 'amrap', 'fortime']

function Stepper({
  field,
  value,
  onChange,
}: {
  field: Field
  value: number
  onChange: (v: number) => void
}) {
  const m = FIELD_META[field as string]
  const shown = m.unit === 'min' ? Math.round(value / 60) : value
  const clamp = (v: number) => Math.min(m.max, Math.max(m.min, v))
  return (
    <div className="card stack" style={{ gap: 8, padding: '10px 12px 12px', borderTop: `4px solid ${m.tint}` }}>
      <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.16em', color: 'var(--dim)' }}>{m.label}</span>
      <div className="row" style={{ gap: 8 }}>
        <button
          className="icon-btn"
          style={{ border: 'none', background: 'var(--surface-2)' }}
          onClick={() => onChange(clamp(value - m.step))}
          aria-label={`Riduci ${m.label}`}
        >
          <Minus size={16} />
        </button>
        <div className="row grow" style={{ justifyContent: 'center', alignItems: 'baseline', gap: 2 }}>
          <span className="num" style={{ fontSize: 30, fontWeight: 700, lineHeight: 1 }}>
            {shown}
          </span>
          <span className="num" style={{ fontSize: 15, fontWeight: 600, color: 'var(--dim)' }}>
            {m.unit}
          </span>
        </div>
        <button
          className="icon-btn"
          style={{ border: 'none', background: 'var(--surface-2)' }}
          onClick={() => onChange(clamp(value + m.step))}
          aria-label={`Aumenta ${m.label}`}
        >
          <Plus size={16} />
        </button>
      </div>
    </div>
  )
}

export function EditorScreen({
  initial,
  onSave,
  onCancel,
  onSaveAndStart,
}: {
  initial: Workout
  onSave: (w: Workout) => void
  onCancel: () => void
  onSaveAndStart: (w: Workout) => void
}) {
  const [w, setW] = useState<Workout>(initial)
  const set = (patch: Partial<Workout>) => setW((prev) => ({ ...prev, ...patch, builtin: false, updatedAt: Date.now() }))

  const fields = MODE_FIELDS[w.mode]
  const steppers = fields.filter((f) => f !== 'sets' || w.mode !== 'fortime')
  const segments = buildSegments(w)

  const addExercise = () => set({ exercises: [...w.exercises, { id: uid(), name: '' }] })
  const renameExercise = (id: string, name: string) =>
    set({ exercises: w.exercises.map((e) => (e.id === id ? { ...e, name } : e)) })
  const setExerciseDuration = (id: string, duration: number) =>
    set({ exercises: w.exercises.map((e) => (e.id === id ? { ...e, duration } : e)) })
  const removeExercise = (id: string) => set({ exercises: w.exercises.filter((e) => e.id !== id) })
  const move = (index: number, step: -1 | 1) => {
    const to = index + step
    if (to < 0 || to >= w.exercises.length) return
    const list = [...w.exercises]
    const [item] = list.splice(index, 1)
    list.splice(to, 0, item)
    set({ exercises: list })
  }

  const named = { ...w, name: w.name.trim() || 'Timer senza nome' }

  return (
    <div className="app">
      <div className="topbar">
        <button className="icon-btn" onClick={onCancel} aria-label="Annulla">
          <Back />
        </button>
        <span className="ob grow" style={{ fontSize: 22, fontWeight: 700, letterSpacing: '0.1em' }}>
          {initial.builtin || !initial.name ? 'NUOVO TIMER' : 'MODIFICA'}
        </span>
        <button className="btn btn-go" style={{ minHeight: 44, padding: '0 20px', fontSize: 17 }} onClick={() => onSave(named)}>
          SALVA
        </button>
      </div>

      <div className="scroll">
        <div className="pad stack" style={{ gap: 6 }}>
          <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.16em', color: 'var(--dim)' }}>NOME DEL TIMER</span>
          <input
            className="field"
            value={w.name}
            placeholder="Es. Brucia grassi"
            onChange={(e) => set({ name: e.target.value })}
          />
        </div>

        <div className="rule">
          <span className="rule-label">SCHEMA</span>
          <div className="rule-line" />
        </div>
        <div className="pad row" style={{ gap: 8, overflowX: 'auto', paddingBottom: 8 }}>
          {MODES.map((m) => (
            <button key={m} className="chip" data-on={w.mode === m} onClick={() => set({ mode: m })}>
              {MODE_BADGE[m]}
            </button>
          ))}
        </div>
        <p className="pad" style={{ fontSize: 13, lineHeight: 1.45, color: 'var(--dim)', margin: '6px 0 0' }}>
          {MODE_HINT[w.mode]}
        </p>

        <div className="rule">
          <span className="rule-label">STRUTTURA</span>
          <div className="rule-line" />
        </div>
        <div
          className="pad"
          style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10 }}
        >
          {steppers.map((f) => (
            <Stepper key={f} field={f} value={w[f] as number} onChange={(v) => set({ [f]: v } as Partial<Workout>)} />
          ))}
        </div>

        <div className="rule">
          <span className="rule-label">{w.mode === 'circuit' ? 'STAZIONI' : 'ESERCIZI'}</span>
          <div className="rule-line" />
          <span className="num" style={{ fontSize: 14, fontWeight: 600, color: 'var(--dim)' }}>
            {w.exercises.length}
          </span>
        </div>
        <p className="pad" style={{ fontSize: 13, lineHeight: 1.45, color: 'var(--dim)', margin: '0 0 10px' }}>
          {w.mode === 'circuit'
            ? 'Ogni stazione è un intervallo di lavoro, con la sua durata.'
            : 'I nomi si alternano a ogni round. Lascia vuoto per non annunciare nulla.'}
        </p>

        <div className="pad stack" style={{ gap: 8 }}>
          {w.exercises.map((ex, i) => (
            <div key={ex.id} className="card row" style={{ gap: 8, padding: '8px 10px' }}>
              <button
                className="icon-btn"
                style={{ width: 30, height: 44, border: 'none', color: 'var(--faint)' }}
                onClick={() => move(i, -1)}
                aria-label="Sposta su"
              >
                <Drag />
              </button>
              <span className="num" style={{ fontSize: 15, fontWeight: 600, color: 'var(--faint)', width: 22 }}>
                {String(i + 1).padStart(2, '0')}
              </span>
              <input
                className="field grow"
                style={{ border: 'none', background: 'transparent', padding: '10px 0', fontSize: 15 }}
                value={ex.name}
                placeholder={w.mode === 'circuit' ? `Stazione ${i + 1}` : `Esercizio ${i + 1}`}
                onChange={(e) => renameExercise(ex.id, e.target.value)}
              />
              {w.mode === 'circuit' && (
                <input
                  className="field"
                  style={{ width: 76, textAlign: 'center', padding: '10px 4px', fontSize: 15 }}
                  type="number"
                  min={5}
                  max={600}
                  value={ex.duration ?? w.work}
                  onChange={(e) => setExerciseDuration(ex.id, Number(e.target.value) || w.work)}
                  aria-label={`Durata di ${ex.name || `stazione ${i + 1}`}`}
                />
              )}
              <button
                className="icon-btn"
                style={{ width: 40, border: 'none', color: 'var(--faint)' }}
                onClick={() => removeExercise(ex.id)}
                aria-label="Rimuovi"
              >
                <Trash size={16} />
              </button>
            </div>
          ))}
          <button className="btn btn-dashed" style={{ minHeight: 50, fontSize: 15 }} onClick={addExercise}>
            <Plus size={16} />
            AGGIUNGI {w.mode === 'circuit' ? 'STAZIONE' : 'ESERCIZIO'}
          </button>
        </div>

        <div className="rule">
          <span className="rule-label">ANTEPRIMA</span>
          <div className="rule-line" />
          <span className="num" style={{ fontSize: 14, fontWeight: 600, color: 'var(--dim)' }}>
            {segments.length} intervalli
          </span>
        </div>
        <div className="pad stack" style={{ gap: 4, paddingBottom: 20 }}>
          {segments.slice(0, 12).map((s, i) => (
            <div
              key={`${s.offset}-${i}`}
              className="row"
              style={{ gap: 10, height: 36, padding: '0 10px', background: 'var(--surface)', borderLeft: `4px solid var(--${s.kind})` }}
            >
              <span className="num" style={{ fontSize: 13, fontWeight: 600, color: 'var(--faint)', width: 22 }}>
                {String(i + 1).padStart(2, '0')}
              </span>
              <span style={{ fontSize: 14, fontWeight: 600 }} className="grow">
                {s.name}
              </span>
              <span className="num" style={{ fontSize: 16, fontWeight: 700, color: '#b8b8b2' }}>
                {s.duration}&quot;
              </span>
            </div>
          ))}
          {segments.length > 12 && (
            <span style={{ fontSize: 13, color: 'var(--dim)', padding: '4px 10px' }}>
              … e altri {segments.length - 12} intervalli
            </span>
          )}
        </div>
      </div>

      <div
        className="row"
        style={{
          gap: 14,
          borderTop: '2px solid var(--line-soft)',
          background: '#171717',
          padding: '14px 20px calc(var(--safe-b) + 16px)',
        }}
      >
        <div className="stack" style={{ gap: 2 }}>
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.2em', color: 'var(--dim)' }}>
            {MODE_LABEL[w.mode].toUpperCase()}
          </span>
          <span className="num" style={{ fontSize: 30, fontWeight: 700, lineHeight: 1 }}>
            {clock(totalDuration(w))}
          </span>
        </div>
        <button className="btn btn-primary grow" style={{ height: 62 }} onClick={() => onSaveAndStart(named)}>
          <Play size={20} />
          AVVIA
        </button>
      </div>
    </div>
  )
}
