# ODS Timer

Interval timer di **Officine Dello Sport** — Collegno (TO).

Una sola applicazione per telefono, tablet e web: è una PWA, quindi si installa
dal browser («Aggiungi alla schermata Home») e da quel momento funziona anche
senza rete, senza passare da App Store o Play Store.

## Schemi di allenamento

| Schema | Come funziona | Parametri |
| --- | --- | --- |
| **Intervalli** | Lavoro e recupero che si alternano (Tabata, HIIT…) | preparazione, lavoro, recupero, round, serie, riposo serie, defaticamento |
| **Circuito** | Stazioni in sequenza, ognuna con la sua durata, ripetute a giri | preparazione, recupero, giri, serie, riposo serie + durata per stazione |
| **EMOM** | Un esercizio all'inizio di ogni slot: quel che avanza è recupero | preparazione, durata slot, numero di slot, serie |
| **AMRAP** | Un solo conto alla rovescia, più giri possibili nel tempo dato | preparazione, durata, serie |
| **For Time** | Cronometro che sale, con un tempo limite oltre cui si ferma | preparazione, tempo limite |

Ogni schema accetta una lista di esercizi: nei circuiti sono le stazioni, negli
altri i nomi si alternano a ogni round e vengono annunciati dalla voce.

## Durante l'allenamento

- **I colori del marchio sono gli stati**: giallo preparati, rosso lavoro, verde
  recupero, blu riposo tra le serie. Il bordo dello schermo prende il colore
  dello stato, così si legge da tutta la sala senza mettere a fuoco i numeri.
- Tre bip sugli ultimi 3 secondi, tono diverso all'inizio di lavoro e recupero,
  voce italiana che annuncia stato ed esercizio, vibrazione sul telefono.
- Lo schermo resta acceso (Wake Lock) e si riaggancia da solo al rientro.
- Da tastiera: `spazio` pausa, `←` `→` intervallo precedente e successivo,
  `Esc` esce.
- Il tempo è ricavato dall'orologio a ogni tick, non accumulato: un tab in
  background messo in pausa dal sistema si riallinea da solo invece di restare
  indietro.

I timer, le impostazioni e lo storico stanno nel browser del dispositivo
(`localStorage`), senza account e senza server.

## Sviluppo

```bash
npm install
npm run dev        # server di sviluppo
npm run build      # bundle di produzione in dist/
npm run preview    # prova il bundle di produzione
npm run typecheck  # solo controllo dei tipi
npm run icons      # rigenera le icone PWA dal marchio
```

`dist/` è statico: si pubblica su qualsiasi hosting (Netlify, Vercel, GitHub
Pages, un nginx). Serve **HTTPS** perché service worker, Wake Lock e
installazione funzionino.

## Da sistemare prima di andare in produzione

- **Il logo** in `src/components/Logo.tsx` è un SVG ridisegnato a partire dal
  marchio, senza i pittogrammi degli sport: sotto i 60px sarebbero macchie. Va
  sostituito con il file originale, e poi va rilanciato `npm run icons`.
- L'indirizzo della palestra in `src/components/SettingsScreen.tsx` è un
  segnaposto.
- I timer sono locali al dispositivo. Per la libreria condivisa della palestra
  (istruttori che creano, soci che avviano) e per mandare un allenamento al
  tablet in sala serve un backend: non c'è ancora.
