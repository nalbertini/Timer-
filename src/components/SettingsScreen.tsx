import type { Settings } from '../types'
import { Cues, speak } from '../lib/audio'
import { Logo } from './Logo'

const cues = new Cues()

function Toggle({
  label,
  hint,
  on,
  onChange,
}: {
  label: string
  hint: string
  on: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <button className="card row" style={{ gap: 12, padding: '0 14px', minHeight: 58, textAlign: 'left' }} onClick={() => onChange(!on)}>
      <div className="stack grow" style={{ gap: 1, minWidth: 0 }}>
        <span style={{ fontSize: 15, fontWeight: 600 }}>{label}</span>
        <span style={{ fontSize: 12, color: 'var(--dim)' }}>{hint}</span>
      </div>
      <span className="switch" data-on={on} role="switch" aria-checked={on} aria-label={label}>
        <i />
      </span>
    </button>
  )
}

export function SettingsScreen({
  settings,
  onChange,
  historyCount,
}: {
  settings: Settings
  onChange: (patch: Partial<Settings>) => void
  historyCount: number
}) {
  const tryVolume = (v: number) => {
    onChange({ volume: v })
    cues.volume = v
    cues.unlock()
    cues.work()
  }

  return (
    <>
      <div className="rule">
        <span className="rule-label">AUDIO</span>
        <div className="rule-line" />
      </div>
      <div className="pad stack" style={{ gap: 2 }}>
        <Toggle
          label="Bip conto alla rovescia"
          hint="Tre bip sugli ultimi 3 secondi di ogni intervallo"
          on={settings.countdownBeep}
          onChange={(v) => onChange({ countdownBeep: v })}
        />
        <Toggle
          label="Voce italiana"
          hint="Annuncia lo stato e il nome dell'esercizio"
          on={settings.voice}
          onChange={(v) => {
            onChange({ voice: v })
            if (v) speak('Voce attiva', settings.volume)
          }}
        />
        <Toggle
          label="Vibrazione"
          hint="Solo su telefono e tablet che la supportano"
          on={settings.vibrate}
          onChange={(v) => onChange({ vibrate: v })}
        />

        <div className="card stack" style={{ gap: 10, padding: '12px 14px 16px' }}>
          <div className="row" style={{ gap: 8, alignItems: 'baseline' }}>
            <span className="grow" style={{ fontSize: 15, fontWeight: 600 }}>
              Volume segnali
            </span>
            <span className="num" style={{ fontSize: 20, fontWeight: 700, color: 'var(--blu)' }}>
              {Math.round(settings.volume * 100)}%
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            value={Math.round(settings.volume * 100)}
            onChange={(e) => tryVolume(Number(e.target.value) / 100)}
            style={{ width: '100%', accentColor: 'var(--blu)', height: 28 }}
            aria-label="Volume dei segnali acustici"
          />
        </div>
      </div>

      <div className="rule">
        <span className="rule-label">SCHERMO</span>
        <div className="rule-line" />
      </div>
      <div className="pad stack" style={{ gap: 2 }}>
        <Toggle
          label="Schermo sempre acceso"
          hint="Durante l'allenamento, finché la batteria lo consente"
          on={settings.keepAwake}
          onChange={(v) => onChange({ keepAwake: v })}
        />
        <Toggle
          label="Modalità schermo grande"
          hint="Numeri più grandi e comandi ridotti, per il tablet in sala"
          on={settings.bigScreen}
          onChange={(v) => onChange({ bigScreen: v })}
        />
      </div>

      <div className="rule">
        <span className="rule-label">PALESTRA</span>
        <div className="rule-line" />
      </div>
      <div className="pad stack" style={{ gap: 2, paddingBottom: 24 }}>
        <div className="card row" style={{ gap: 14, padding: 14 }}>
          <Logo width={52} />
          <div className="stack grow" style={{ gap: 2, minWidth: 0 }}>
            <span className="ob" style={{ fontSize: 18, fontWeight: 700, letterSpacing: '0.03em' }}>
              OFFICINE DELLO SPORT
            </span>
            <span style={{ fontSize: 12, color: 'var(--dim)' }}>Collegno (TO)</span>
          </div>
        </div>

        <div className="row" style={{ gap: 10, padding: '16px 2px 0' }}>
          <span style={{ fontSize: 12, color: 'var(--faint)', letterSpacing: '0.1em' }}>ODS TIMER 1.0</span>
          <div className="grow" />
          <span style={{ fontSize: 12, color: 'var(--faint)', letterSpacing: '0.1em' }}>
            {historyCount} allenamenti svolti
          </span>
          <div style={{ width: 8, height: 8, background: 'var(--verde)' }} />
        </div>
      </div>
    </>
  )
}
