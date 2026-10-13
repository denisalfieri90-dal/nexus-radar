# NEXUS Asymmetry & Radar

Radar personale di ricerca che cerca un tipo preciso di asimmetria: temi e asset dove la **sostanza** (adozione, accumulo, catalizzatori) cresce mentre l'**attenzione mediatica** è ancora bassa. Collega il segnale al quadro geopolitico e macro, poi genera con Claude un briefing a sei sezioni. Ogni segnale registrato viene misurato nel tempo contro un benchmark.

> Strumento di ricerca, non di consulenza. I segnali sono ipotesi da verificare, non indicazioni di acquisto o vendita.

---

## Come gira, a costo zero

```
GitHub Actions (ogni 2 ore)                    Render (piani free)
  ├─ riprende il DB dal branch `data`            ├─ nexus-radar  Static Site, sempre acceso
  ├─ raccoglie fonti, punteggi, journal          │    serve il branch `site` → app installabile
  ├─ briefing automatici sui top stealth         └─ nexus-brain  Web Service free
  ├─ esporta JSON statici + compila il sito           briefing su richiesta, protetto da codice
  └─ pubblica `data` (DB) e `site` (sito)             scarica lo snapshot del DB dal branch `data`
```

- **Sito**: Next.js esportato come sito statico e PWA. Si installa sul telefono e funziona offline con gli ultimi dati.
- **Pipeline**: `.github/workflows/pipeline.yml`. Notizie e attenzione ogni 2 ore; mercati, filing, contratti, macro e briefing automatici ogni mattina. Si può lanciare a mano da *Actions → Pipeline dati → Run workflow*.
- **Briefing su richiesta**: il servizio free si addormenta dopo 15 minuti, quindi la prima richiesta impiega circa un minuto. Il codice d'accesso (`ACCESS_CODE` su Render) si inserisce una volta nell'app e resta sul dispositivo.
- **Dati personali** (la tua lista, i briefing richiesti) restano sul dispositivo.

### Segreti da configurare

| Dove | Nome | A cosa serve |
|---|---|---|
| GitHub → Settings → Secrets → Actions | `ANTHROPIC_API_KEY` | briefing automatici |
| GitHub → Settings → Secrets → Actions | `FRED_API_KEY` | pannello macro (chiave gratuita) |
| GitHub → Settings → Variables → Actions | `BRAIN_URL` | URL del servizio nexus-brain, per attivare il pulsante "Genera briefing" |
| GitHub → Settings → Variables → Actions | `SEC_USER_AGENT` | facoltativo: nome ed email per la SEC |
| Render → nexus-brain → Environment | `ANTHROPIC_API_KEY` | briefing su richiesta |

## Avvio rapido in locale

Requisiti: Python 3.11+ e Node 20+.

```bash
# 1. Backend: dati e calcoli
cd backend
python -m venv .venv && source .venv/bin/activate      # su Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env                                   # poi compila le chiavi
python -m app.cli seed-demo                            # dati inventati, per vedere subito la UI
python -m app.cli export ../frontend/public/data       # JSON statici per il sito

# 2. Sito
cd ../frontend
npm install
npm run dev                                            # http://localhost:3000
```

Per i dati reali: `python -m app.cli clear-demo`, poi `python -m app.cli run all` (10-15 minuti) e di nuovo `export`.
Per provare i briefing su richiesta in locale: `uvicorn app.main:app --reload` nel backend e `NEXT_PUBLIC_BRAIN_URL=http://localhost:8000` in `frontend/.env.local`.

### Chiavi

| Variabile | Serve per | Obbligatoria |
|---|---|---|
| `ANTHROPIC_API_KEY` | briefing con Claude | solo per i briefing |
| `FRED_API_KEY` | pannello macro (gratuita) | no |
| `SEC_USER_AGENT` | EDGAR: la SEC richiede nome ed email | sì, per EDGAR |
| `GITHUB_TOKEN` | limiti più alti su GitHub | no |
| `ADMIN_TOKEN` | protegge `/api/jobs` e il webhook TradingView | sì in produzione |

---

## Come ragiona il motore

### Le quattro misure (0-100, 50 = neutro)

| Asse | Cosa misura | Fonti |
|---|---|---|
| **Adozione** | Curva ad S: l'attenzione accelera (30 giorni vs 30 precedenti) e nascono nuovi repository sul tema. Bonus "punto di flesso" se accelera senza aver ancora raggiunto il picco. | GDELT, GitHub |
| **Accumulo** | Volumi 20g/120g, *accumulo silenzioso* (volumi su e prezzo fermo), base costruita 10-45% sotto i massimi, forza relativa vs benchmark, Schedule 13D/13G (soglia del 5%). | Yahoo Finance, SEC EDGAR |
| **Catalizzatori** | Flusso di contratti federali USA sul tema (90 giorni vs media trimestrale), eventi societari 8-K. | USAspending, SEC EDGAR |
| **Attenzione** | Percentile di copertura mediatica tra i temi + anomalia rispetto alla propria storia, mescolati al 35% con l'euforia di prezzo a 3 mesi. | GDELT, Yahoo Finance |

`Sostanza = media(Adozione, Accumulo, Catalizzatori)` e `Asimmetria = Sostanza − 0,4 × (Attenzione − 50)`.

**Quadranti.** La soglia dell'attenzione è 55. Quella della sostanza è il 60° percentile dell'universo, con minimo 55: il radar è relativo e mette in alto solo i migliori anche nelle fasi di euforia generale.

| | Attenzione bassa | Attenzione alta |
|---|---|---|
| **Sostanza alta** | **Stealth**: la zona cercata | **Consenso**: tesi già nel prezzo |
| **Sostanza bassa** | **Dormiente** | **Hype**: possibile trappola retail |

**Flag:** accumulo silenzioso, insider anomali, possibile punto di flesso, rischio trappola retail (attenzione ≥ 70, +60% in 3 mesi, volumi ≥ 1,8x, sostanza sotto soglia), dati insufficienti.

**Tracciabilità.** Ogni punteggio porta con sé le sue evidenze (valore, fonte, lettura), visibili nella pagina dell'asset e incluse nel contesto inviato a Claude. Se una fonte manca, `data_quality` scende e il punto appare sbiadito nel radar.

### Il briefing (Claude)

`app/llm.py` costruisce un pacchetto di contesto JSON: punteggi ed evidenze, titoli recenti, contratti, macro, stato dei chokepoint, temi Overton, contro-narrazione. Lo invia con il prompt di sistema in `app/prompts/system_prompt.md` e un tool use forzato, quindi l'output è sempre strutturato nel tuo template:

1. ⚡ Radar signal
2. 🎯 Tesi asimmetrica (12-36 mesi), con catalizzatori verificabili e scenario rialzista/ribassista
3. 🌐 Background geopolitico e macro
4. 🧠 Decoder della narrazione: narrativa mainstream, *cui prodest*, meccanismo psicologico (Bernays, Chomsky, Le Bon, Overton), lettura alternativa, **evidenze a supporto**, **contro-lettura** e uno stato (*supportata da dati / parzialmente supportata / ipotesi non verificata*)
5. 🏛️ Parallelo storico, con **dove il parallelo non regge**
6. ⚠️ Red flags e **criteri di invalidazione misurabili** (metrica + soglia)

In più restituisce confidenza, motivazione e dati mancanti. Il prompt obbliga il modello a basare i fatti sul pacchetto, a separare fatti e ipotesi e a trattare le fonti di contro-narrazione come indicatore di sentiment. Il pacchetto completo è consultabile in fondo a ogni briefing.

Modello predefinito: `claude-sonnet-5-5`. Per analisi più profonde imposta `CLAUDE_MODEL=claude-opus-5-5`.

### Il journal

- **La tua lista:** "Segui nella tua lista" fissa prezzo e benchmark del giorno sul tuo dispositivo e mostra come si muove l'asset da allora.
- **Automatico:** a ogni esecuzione di `daily`, i primi 5 asset stealth (asimmetria più alta, qualità dati ≥ 40%) vengono registrati senza scelta umana, con 28 giorni di pausa per ticker.
- **Valutazione** a 30/90/180/365 giorni sul rendimento in eccesso vs benchmark, con hit rate e confronto automatici/manuali.

Dopo 6-12 mesi il campione automatico ti dirà se i pesi funzionano. Se non funzionano, si cambiano in `scoring.py`.

---

## Fonti e limiti

| Fonte | Uso | Limiti |
|---|---|---|
| GDELT DOC 2.0 | attenzione, tono, titoli (65 lingue) | finestra di 3 mesi, ~1 richiesta ogni 5 s |
| Feed RSS (`connectors/feeds.yaml`) | Fed, BCE, SEC, difesa, spazio, commodity, crypto, arXiv, ZeroHedge | gli URL cambiano: la pagina Fonti segnala i feed rotti |
| Yahoo Finance (yfinance) | prezzi e volumi | non ufficiale, adatto alla ricerca e non all'esecuzione |
| SEC EDGAR | Form 4, 13D/13G, 8-K | solo emittenti USA; Form 4 contato, non ancora diviso fra acquisti e vendite |
| USAspending | contratti federali | i contratti della Difesa arrivano con un ritardo fino a 90 giorni |
| GitHub | nuovi repository per topic | proxy grezzo di adozione |
| FRED | tassi, curva, dollaro, spread, VIX, Brent, bilancio Fed | serve la chiave gratuita |
| TradingView | alert via webhook `POST /api/webhooks/tradingview?token=ADMIN_TOKEN` con JSON `{"ticker": "...", "message": "..."}` | richiede un piano TradingView con webhook |

**Esclusi di proposito.** Bloomberg e Reuters non si possono scrapare legalmente: usa i loro contenuti come lettura, non come input automatico. Glassnode richiede un'API a pagamento; il punto d'innesto è un nuovo connettore sul modello di `connectors/fred.py`.

### Estensioni consigliate, in ordine di valore

1. Parsing dell'XML dei Form 4 per distinguere acquisti (codice P) e vendite (codice S): gli acquisti degli insider sono il segnale più informativo.
2. Brevetti: PatentsView (USPTO) per conteggi per classe CPC sui temi.
3. Short interest e flussi degli ETF tematici.
4. Notifica (email o Telegram) quando un asset entra nel quadrante stealth.

---

## Struttura

```
backend/
  app/
    themes.py          universo: temi, ticker, chokepoint, serie FRED  ← da personalizzare
    connectors/        gdelt, rss (+feeds.yaml), markets, edgar, usaspending, github, fred
    scoring.py         i quattro assi, quadranti, flag, evidenze
    llm.py             pacchetto di contesto + Claude con tool use forzato
    prompts/system_prompt.md
    journal.py         registro, valutazione, auto-log, statistiche
    jobs.py, cli.py    orchestrazione e riga di comando
    demo.py            dati sintetici (marcati source='demo')
    main.py            API FastAPI
  tests/               pytest: scoring, parser, end-to-end con dati demo
    export.py          JSON statici per il sito
    snapshot.py        il servizio briefing scarica il DB pubblicato dalla pipeline
frontend/              Next.js 16 (export statico) + Tailwind 4, PWA
  app/                 / (radar), /temi, /tema, /asset, /briefing, /journal, /altro, /fonti
  components/          radar-chart (carta batimetrica animata), shell, theme, …
  public/sw.js         service worker: installazione e uso offline
.github/workflows/     pipeline dati
render.yaml            blueprint Render (piani free)
```

## Deploy

1. Repository GitHub pubblico (Actions gratuite e illimitate) con questo contenuto sul branch `main`.
2. Il primo push avvia la pipeline: in 10-15 minuti crea i branch `data` e `site`.
3. Su Render: **New → Blueprint** su questo repository, oppure crea a mano i due servizi descritti in `render.yaml`.
4. Imposta `DB_SNAPSHOT_URL`, `CORS_ORIGINS` e `ANTHROPIC_API_KEY` su nexus-brain, e la variabile `BRAIN_URL` su GitHub.

## Test

```bash
cd backend && python -m pytest -q
```
