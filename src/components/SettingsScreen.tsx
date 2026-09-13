import { useEffect, useState } from 'react'
import type { CoachLevel, Settings } from '../types'
import { Cues, italianVoices, speak } from '../lib/audio'
import { COACH_HINT, COACH_LABEL, COACH_LEVELS } from '../lib/engine'
import { listClips } from '../lib/clipStore'
import { CLIPS } from '../lib/voiceClips'
import { Chevron } from './Icons'
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
  onOpenRecorder,
}: {
  settings: Settings
  onChange: (patch: Partial<Settings>) => void
  historyCount: number
  onOpenRecorder: () => void
}) {
  const [incise, setIncise] = useState(0)
  useEffect(() => {
    void listClips().then((k) => setIncise(k.length))
  }, [])
  // getVoices() è spesso vuoto al primo giro: il sistema le carica dopo.
  const [vociIt, setVociIt] = useState(() => italianVoices())
  useEffect(() => {
    if (!('speechSynthesis' in window)) return
    const aggiorna = () => setVociIt(italianVoices())
    window.speechSynthesis.addEventListener('voiceschanged', aggiorna)
    const t = window.setTimeout(aggiorna, 300)
    return () => {
      window.speechSynthesis.removeEventListener('voiceschanged', aggiorna)
      window.clearTimeout(t)
    }
  }, [])

  const tryVolume = (v: number) => {
    onChange({ volume: v })
    cues.volume = v
    cues.unlock()
    cues.work()
  }

  return (
    <>
      <div className="pad" style={{ paddingTop: 16 }}>
        <div className="card maurizio-card">
          <div className="row" style={{ gap: 14, alignItems: 'flex-start' }}>
            <img src="adesivi/indica.webp" alt="" className="maurizio-faccia" />
            <div className="stack grow" style={{ gap: 6, minWidth: 0 }}>
              <span className="ob" style={{ fontSize: 25, fontWeight: 700, letterSpacing: '0.04em', lineHeight: 1 }}>
                MODALITÀ MAURIZIO
              </span>
              <p style={{ fontSize: 13, lineHeight: 1.45, color: 'var(--dim)', margin: 0, textWrap: 'pretty' }}>
                L'allenatore che perde il conto per farti lavorare qualche secondo in più. Il tempo in più è deciso
                all'avvio e sparso a caso fra gli intervalli di lavoro; il recupero non si tocca.
              </p>
            </div>
          </div>

          <div className="maurizio-livelli">
            {(Object.keys(COACH_LEVELS) as CoachLevel[]).map((l) => (
              <button key={l} className="livello" data-on={settings.coach === l} onClick={() => onChange({ coach: l })}>
                <span className="ob" style={{ fontSize: 17, fontWeight: 700, letterSpacing: '0.1em' }}>
                  {COACH_LABEL[l].toUpperCase()}
                </span>
              </button>
            ))}
          </div>

          <span style={{ fontSize: 13, lineHeight: 1.4, color: settings.coach === 'off' ? 'var(--dim)' : 'var(--giallo)' }}>
            {COACH_HINT[settings.coach]}
          </span>
        </div>
      </div>

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
            if (v) speak('Voce attiva', settings.volume, settings.voiceURI)
          }}
        />
        <Toggle
          label="Dice il prossimo esercizio"
          hint="Nel recupero annuncia dove si va dopo, così ci si prepara"
          on={settings.announceNext}
          onChange={(v) => onChange({ announceNext: v })}
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
        <span className="rule-label">VOCE INCISA</span>
        <div className="rule-line" />
      </div>
      <div className="pad stack" style={{ gap: 8 }}>
        <p style={{ fontSize: 13, lineHeight: 1.45, color: 'var(--dim)', margin: 0 }}>
          Frasi registrate con una voce vera al posto della sintesi. Si può incidere un pezzo per volta: dove manca
          la clip, il timer torna da solo alla voce di sistema.
        </p>
        <button className="card row" style={{ gap: 12, padding: '0 14px', minHeight: 60, textAlign: 'left' }} onClick={onOpenRecorder}>
          <div className="stack grow" style={{ gap: 2, minWidth: 0 }}>
            <span style={{ fontSize: 15, fontWeight: 600 }}>Incidi la voce</span>
            <span style={{ fontSize: 12, color: 'var(--dim)' }}>
              {incise === 0 ? `nessuna clip · ${CLIPS.length} frasi da registrare` : `${incise} clip su questo dispositivo`}
            </span>
          </div>
          <Chevron />
        </button>
        <Toggle
          label="Usa le clip incise"
          hint="Quando ci sono, hanno la precedenza sulla sintesi"
          on={settings.recordedVoice}
          onChange={(v) => onChange({ recordedVoice: v })}
        />
      </div>

      <div className="rule">
        <span className="rule-label">VOCE DI SISTEMA</span>
        <div className="rule-line" />
      </div>
      <div className="pad stack" style={{ gap: 8 }}>
        <p style={{ fontSize: 13, lineHeight: 1.45, color: 'var(--dim)', margin: 0 }}>
          Le voci disponibili le mette il dispositivo, non l'app: cambiano fra telefono, tablet e computer. Quelle
          marcate «enhanced» o «premium» suonano molto meno metalliche — su iPhone e iPad si scaricano da
          Impostazioni › Accessibilità › Contenuto letto › Voci.
        </p>
        {vociIt.length === 0 ? (
          <div className="card" style={{ padding: '12px 14px', fontSize: 14, color: 'var(--dim)' }}>
            Questo dispositivo non espone voci italiane.
          </div>
        ) : (
          <div className="stack" style={{ gap: 2 }}>
            {vociIt.map((v) => {
              const attiva = settings.voiceURI ? settings.voiceURI === v.voiceURI : v === vociIt[0]
              return (
                <button
                  key={v.voiceURI}
                  className="card row"
                  style={{ gap: 12, padding: '0 14px', minHeight: 54, textAlign: 'left', borderColor: attiva ? 'var(--blu)' : 'var(--line)' }}
                  onClick={() => {
                    onChange({ voiceURI: v.voiceURI })
                    speak('Lavoro. Burpee più salto', settings.volume, v.voiceURI)
                  }}
                >
                  <div style={{ width: 10, height: 10, background: attiva ? 'var(--blu)' : 'var(--line)' }} />
                  <div className="stack grow" style={{ gap: 1, minWidth: 0 }}>
                    <span style={{ fontSize: 15, fontWeight: 600 }}>{v.name}</span>
                    <span style={{ fontSize: 12, color: 'var(--dim)' }}>
                      {v.lang}
                      {v.localService === false ? ' · dalla rete' : ' · sul dispositivo'}
                    </span>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.16em', color: 'var(--dim)' }}>PROVA</span>
                </button>
              )
            })}
          </div>
        )}
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
