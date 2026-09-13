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

## Modalità Maurizio

Come l'allenatore che «perde il conto» per farti lavorare qualche secondo in
più. Spenta di default, con tre livelli: **distratto**, **classico**,
**spietato**.

Sono due meccanismi distinti, e tenerli separati è ciò che li rende gestibili:

1. **Il tempo in più** viene estratto all'avvio e cucito dentro la durata dei
   segmenti di lavoro. Offset, barra di avanzamento e durata totale restano
   coerenti, e il motore del timer non sa nulla della cosa. Il recupero non si
   tocca mai: Maurizio conta benissimo quando sei fermo.
2. **La sceneggiata** vive solo nel numero mostrato. Il conto scende normalmente
   fino a 3, poi rimbalza: `4 3 2 3 2 3 2 1`. I bip e la voce seguono il numero
   mostrato, non quello vero, altrimenti tradirebbero il trucco un attimo prima
   che si veda.

Il bonus è sempre di un numero **pari** di secondi. Non è un capriccio: con un
bonus dispari il rimbalzo non può insieme attaccarsi al 3 e chiudere su 3-2-1,
e il conto finirebbe per saltare un numero. Vincolare l'ingresso costa un
secondo di granularità e rende la sequenza corretta per costruzione.

## La voce

L'app usa la sintesi vocale del dispositivo (`speechSynthesis`): le voci le
mette il sistema operativo, non l'app, e cambiano fra telefono, tablet e
computer.

In Impostazioni › Voce c'è l'elenco delle voci italiane disponibili, ordinate
dalla più naturale alla più sintetica, ognuna con un tasto di prova. Il
criterio: premia le versioni *enhanced*, *premium* e *neural* e quelle servite
dalla rete, penalizza le *compact* installate di serie — che sono quelle che
suonano metalliche, ed erano quelle che l'app pescava prima.

Su iPhone e iPad le voci di qualità vanno scaricate una volta da
Impostazioni › Accessibilità › Contenuto letto › Voci.

### Voce incisa

Per una voce davvero umana l'app preferisce, quando ci sono, delle **frasi
registrate**. L'elenco è chiuso e corto — gli stati, i numeri da 3 a 1, le
battute di Maurizio — più, facoltativi, i nomi degli esercizi.

L'ordine è: registrazione fatta su quel dispositivo → file pubblicato in
`public/voce/` → sintesi vocale. Quindi si può incidere un pezzo per volta, e
dove manca la clip il timer torna da solo alla voce di sistema senza che nessuno
debba configurare niente.

**Impostazioni › Voce incisa › Incidi la voce** apre un registratore: ogni frase
ha REGISTRA / FERMA, si riascolta e si rifà. Le clip restano su quel dispositivo
e si sentono subito — si può incidere sul tablet in sala e sentirlo funzionare
all'istante. Il tasto ESPORTA scarica uno zip da scompattare in `public/voce/`
per darle a tutta la palestra; dentro c'è anche l'`index.json` che l'app usa per
sapere cosa esiste senza tentare richieste a vuoto.

Il dettaglio di nomi, formati e conversioni sta in
[`public/voce/README.md`](public/voce/README.md).

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
- Le clip della voce non ci sono ancora: l'elenco delle frasi da incidere è in
  `public/voce/README.md`, e le battute di Maurizio hanno senso solo se le dice
  Maurizio.
- I timer sono locali al dispositivo. Per la libreria condivisa della palestra
  (istruttori che creano, soci che avviano) e per mandare un allenamento al
  tablet in sala serve un backend: non c'è ancora.
