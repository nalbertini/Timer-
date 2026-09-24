import { useEffect, useState } from 'react'
import type { Workout } from '../types'
import { type Dati, dati as caricaDati } from '../lib/dati'
import type { SessioneVista } from '../lib/sala'
import { CalendarioScreen } from './CalendarioScreen'
import { AppelloScreen } from './AppelloScreen'
import { Back } from './Icons'

/**
 * La scheda SALA: il calendario, e dentro una lezione l'appello.
 *
 * Tiene per sé in quale delle due si è, invece di passare da `App`: sono due
 * facce della stessa cosa, e uscire dalla scheda e rientrarci deve riportare
 * al calendario, non a un appello lasciato aperto tre ore fa.
 */
export function Sala({ onAvvia }: { onAvvia: (w: Workout, sessioneId: string) => void }) {
  const [d, setD] = useState<Dati | null>(null)
  const [aperta, setAperta] = useState<SessioneVista | null>(null)
  const [inCoda, setInCoda] = useState(0)

  useEffect(() => {
    let vivo = true
    void caricaDati().then((x) => vivo && setD(x))
    return () => {
      vivo = false
    }
  }, [])

  useEffect(() => d?.guardaCoda?.(setInCoda), [d])

  if (!d) return <p className="pad" style={{ color: 'var(--dim)', paddingTop: 20 }}>Un attimo…</p>

  return (
    <>
      {d.modo === 'prova' && (
        <div className="nastro-prova">DATI DI PROVA · ORARIO E ISCRITTI INVENTATI</div>
      )}

      {aperta ? (
        <>
          <div className="row pad" style={{ gap: 10, paddingTop: 12, alignItems: 'center' }}>
            <button className="icon-btn" onClick={() => setAperta(null)} aria-label="Torna al calendario">
              <Back />
            </button>
            <span className="ob grow" style={{ fontSize: 22, fontWeight: 700, letterSpacing: '0.06em', minWidth: 0 }}>
              {aperta.corso.toUpperCase()}
            </span>
            {inCoda > 0 && <span className="spia-coda">{inCoda} DA INVIARE</span>}
          </div>
          <AppelloScreen
            dati={d}
            sessioneId={aperta.id}
            onAvvia={(dett) => {
              if (dett.allenamento) onAvvia(dett.allenamento, aperta.id)
            }}
          />
        </>
      ) : (
        <CalendarioScreen dati={d} onApri={setAperta} />
      )}
    </>
  )
}
