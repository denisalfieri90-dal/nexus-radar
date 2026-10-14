"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { entryOfTheDay } from "@/lib/almanac";
import { Health, NewsItem, Point, RadarRow, num, stamp, useData, when } from "@/lib/api";
import { VERDICTS, VerdictKey, verdictOf } from "@/lib/verdict";
import { RadarChart } from "./radar-chart";
import { Empty, ErrorBox, NoData, Sparkline } from "./ui";
import { AssetCard, AssetRow } from "./verdict-ui";

type Choke = {
  chiave: string;
  nome: string;
  rilevanza: string;
  attenzione_z: number | null;
  allerta: "alta" | "media" | "bassa";
  titoli: { titolo: string; url: string; fonte: string; data: string }[];
};
type Macro = { indicators: { serie: string; nome: string; ultimo: number; var_3m: number; series: Point[] }[] };
type Headline = { title: string; url: string; source: string; published_at: string };
type DecoderLite = {
  themes: { slug: string; name: string; bucket: "rumore" | "silenzio" | "allineato"; heat: number | null; substance: number | null }[];
  alternative_latest: Headline[];
};

const TABS: { key: "buoni" | "scontato" | "evitare"; label: string; hint: string; match: VerdictKey[] }[] = [
  { key: "buoni", label: "Da studiare", hint: "Appetibili e interessanti: fatti che crescono con pochi occhi addosso.", match: ["appetibile", "interessante"] },
  { key: "scontato", label: "Già nel prezzo", hint: "Buoni fondamentali, ma ne parlano tutti: poco margine di sorpresa.", match: ["scontato"] },
  { key: "evitare", label: "Da evitare", hint: "Molto rumore e dati deboli: dove spesso i piccoli investitori comprano il picco.", match: ["evitare"] },
];

export function Dashboard() {
  const radar = useData<RadarRow[]>("radar.json");
  const health = useData<Health>("health.json");
  const geo = useData<{ chokepoints: Choke[] }>("geo.json");
  const macro = useData<Macro>("macro.json");
  const feed = useData<NewsItem[]>("feed.json");
  const dec = useData<DecoderLite>("decoder.json");
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("buoni");
  const [theme, setTheme] = useState<string>("tutti");

  const rows = useMemo(() => (radar.data ?? []).map((r) => ({ r, v: verdictOf(r) })), [radar.data]);
  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    rows.forEach(({ v }) => (c[v.key] = (c[v.key] ?? 0) + 1));
    return c;
  }, [rows]);
  const current = TABS.find((t) => t.key === tab)!;
  const picks = rows
    .filter(({ v }) => current.match.includes(v.key))
    .sort((a, b) => (tab === "evitare" ? b.r.heat - a.r.heat : a.v.rank - b.v.rank || b.r.asymmetry - a.r.asymmetry))
    .slice(0, 8);
  const themes = useMemo(() => {
    const m = new Map<string, string>();
    radar.data?.forEach((r) => m.set(r.theme, r.theme_name));
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [radar.data]);
  const mapRows = (radar.data ?? []).filter((r) => theme === "tutti" || r.theme === theme);
  const alerts = geo.data?.chokepoints.filter((c) => c.allerta !== "bassa") ?? [];

  if (radar.missing) return <NoData />;
  if (radar.error) return <ErrorBox message={radar.error} onRetry={radar.reload} />;
  if (!radar.data) return <HomeSkeleton />;

  return (
    <>
      <section className="pt-7 md:pt-12">
        <p className="text-sm text-muted flex flex-wrap gap-x-3">
          <span className="first-letter:uppercase">
            {new Date().toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long" })}
            {health.data?.exported_at ? `, dati delle ${stamp(health.data.exported_at).split(", ").pop()}` : ""}
          </span>
          <Link href="/guida/" className="underline">
            Come si usa
          </Link>
        </p>
        <h1 className="display text-[clamp(2.6rem,8vw,5rem)] max-w-[14ch] mt-3">Dove la sostanza arriva prima del rumore</h1>
        <ul className="flex flex-wrap gap-2 mt-5" aria-label="Riepilogo dei verdetti">
          {(["appetibile", "interessante", "scontato", "evitare"] as VerdictKey[]).map((k) => (
            <li key={k}>
              <button
                onClick={() => {
                  setTab(k === "scontato" ? "scontato" : k === "evitare" ? "evitare" : "buoni");
                  document.getElementById("verdetto")?.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
                className="inline-flex items-baseline gap-2 rounded-full px-4 min-h-11 items-center"
                style={{ background: VERDICTS[k].soft, color: VERDICTS[k].text }}
              >
                <span className="display text-[1.5rem] leading-none">{counts[k] ?? 0}</span>
                <span className="text-sm font-semibold">{VERDICTS[k].plural}</span>
              </button>
            </li>
          ))}
          {alerts.length > 0 && (
            <li>
              <a href="#avvisi" className="inline-flex items-center gap-2 rounded-full px-4 min-h-11 border border-buoy text-buoy">
                <span className="display text-[1.5rem] leading-none">{alerts.length}</span>
                <span className="text-sm font-semibold">chokepoint in allerta</span>
              </a>
            </li>
          )}
        </ul>
      </section>

      <section id="verdetto" aria-labelledby="verdetto-t" className="mt-10 scroll-mt-20">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 id="verdetto-t" className="display text-[2.2rem]">
            Il verdetto di oggi
          </h2>
          <div role="tablist" aria-label="Categoria" className="inline-flex p-1 rounded-full bg-paper-2 border border-rule">
            {TABS.map((t) => (
              <button
                key={t.key}
                role="tab"
                aria-selected={tab === t.key}
                onClick={() => setTab(t.key)}
                className={`px-3.5 min-h-10 rounded-full text-sm font-semibold transition-colors ${tab === t.key ? "bg-ink text-paper" : "text-muted hover:text-ink"}`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
        <p className="text-muted mt-2 max-w-[60ch]">{current.hint}</p>
        {picks.length === 0 ? (
          <Empty>Nessun titolo in questa categoria oggi.</Empty>
        ) : (
          <ul
            key={tab}
            className="rise mt-4 -mx-4 px-4 md:mx-0 md:px-0 flex md:grid md:grid-cols-2 xl:grid-cols-4 gap-3 overflow-x-auto md:overflow-visible snap-x snap-mandatory no-scrollbar pb-2"
          >
            {picks.map(({ r }) => (
              <li key={r.entity_id} className="snap-start shrink-0 w-[78%] sm:w-[46%] md:w-auto">
                <AssetCard r={r} />
              </li>
            ))}
          </ul>
        )}
        <p className="text-xs text-muted mt-2">Verdetti calcolati dai dati del radar: indicano cosa studiare, non cosa comprare.</p>
      </section>

      <StoryOfTheDay dec={dec.data} />

      <section className="mt-14 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_340px] gap-8 lg:gap-10" aria-labelledby="mappa">
        <div className="min-w-0">
          <h2 id="mappa" className="display text-[2.2rem]">
            La mappa
          </h2>
          <p className="text-muted mt-1 mb-4 max-w-[60ch]">In alto a sinistra i fatti battono il rumore. Tocca un punto per i dettagli.</p>
          <div className="-mx-4 px-4 md:mx-0 md:px-0 flex gap-2 mb-4 overflow-x-auto no-scrollbar md:flex-wrap" role="group" aria-label="Filtra per tema">
            {[["tutti", "Tutti i temi"] as [string, string], ...themes].map(([slug, name]) => (
              <button
                key={slug}
                onClick={() => setTheme(slug)}
                aria-pressed={theme === slug}
                className={`shrink-0 text-sm px-3.5 min-h-10 rounded-full border transition-colors ${
                  theme === slug ? "bg-ink text-paper border-ink" : "border-rule hover:border-ink bg-paper"
                }`}
              >
                {name}
              </button>
            ))}
          </div>
          {mapRows.length ? <RadarChart rows={mapRows} labelTop={theme === "tutti" ? 12 : 30} /> : <Empty>Nessun asset in questo tema.</Empty>}
        </div>

        <aside aria-labelledby="avvisi" id="avvisi" className="scroll-mt-20">
          <h2 id="avvisi-t" className="display text-[1.9rem]">
            Avvisi ai naviganti
          </h2>
          <p className="text-sm text-muted mb-3 mt-1">Rotte marittime critiche: tensione dell&apos;ultima settimana.</p>
          <ul className="divide-y divide-rule border-y border-rule">
            {geo.data?.chokepoints
              .slice()
              .sort((a, b) => (b.attenzione_z ?? -9) - (a.attenzione_z ?? -9))
              .map((c) => (
                <li key={c.chiave} className="py-3">
                  <div className="flex items-baseline gap-2">
                    <AlertDot level={c.allerta} />
                    <span className="font-semibold">{c.nome}</span>
                    <span className="ml-auto text-xs text-muted">{c.allerta === "bassa" ? "calmo" : `allerta ${c.allerta}`}</span>
                  </div>
                  <p className="text-sm text-muted">{c.rilevanza}</p>
                  {c.titoli[0] && (
                    <a href={c.titoli[0].url} target="_blank" rel="noreferrer" className="text-sm block mt-1 underline decoration-rule hover:decoration-ink">
                      {c.titoli[0].titolo}
                    </a>
                  )}
                </li>
              ))}
          </ul>
        </aside>
      </section>

      <AllAssets rows={radar.data} />

      <section className="mt-14 grid grid-cols-1 lg:grid-cols-2 gap-12">
        <div aria-labelledby="macro">
          <h2 id="macro" className="display text-[2.2rem] mb-4">
            Macro e liquidità
          </h2>
          {macro.data?.indicators.length ? (
            <ul className="grid grid-cols-2 gap-x-5">
              {macro.data.indicators.map((m) => (
                <li key={m.serie} className="py-3 border-b border-rule">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-sm leading-tight">{m.nome}</span>
                    <span className="font-semibold">{num(m.ultimo, m.ultimo > 1000 ? 0 : 2)}</span>
                  </div>
                  <Sparkline points={m.series} color={m.var_3m >= 0 ? "var(--depth)" : "var(--buoy)"} />
                  <p className="text-xs text-muted">
                    3 mesi: {m.var_3m >= 0 ? "+" : "−"}
                    {num(Math.abs(m.var_3m), 2)}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <Empty>Le serie macro arrivano da FRED: compariranno quando la chiave FRED_API_KEY sarà configurata nella pipeline.</Empty>
          )}
        </div>
        <div aria-labelledby="feed">
          <h2 id="feed" className="display text-[2.2rem] mb-4">
            Flusso in arrivo
          </h2>
          {feed.data?.length ? (
            <ul className="divide-y divide-rule border-y border-rule">
              {feed.data
                .filter((n) => n.channel !== "contrarian")
                .slice(0, 14)
                .map((n) => (
                  <li key={n.id} className="py-2.5">
                    <a href={n.url} target="_blank" rel="noreferrer" className="hover:underline">
                      {n.title}
                    </a>
                    <p className="text-xs text-muted mt-0.5">
                      {n.domain || n.source}, {when(n.published_at)}
                    </p>
                  </li>
                ))}
            </ul>
          ) : (
            <Empty>Nessuna notizia ancora.</Empty>
          )}
        </div>
      </section>
    </>
  );
}

/** Il racconto di oggi: curiosità, rumore/silenzio e contro-narrazione, in un colpo d'occhio. */
function StoryOfTheDay({ dec }: { dec: DecoderLite | null }) {
  const e = entryOfTheDay();
  const noise = dec?.themes.filter((t) => t.bucket === "rumore").slice(0, 3) ?? [];
  const silence = dec?.themes.filter((t) => t.bucket === "silenzio").slice(0, 3) ?? [];
  return (
    <section aria-labelledby="racconto" className="mt-14">
      <div className="flex items-end justify-between gap-3">
        <h2 id="racconto" className="display text-[2.2rem]">
          Il racconto di oggi
        </h2>
        <Link href="/decoder/" className="text-sm font-semibold underline shrink-0">
          Apri il Decoder
        </Link>
      </div>
      <div className="mt-4 grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-4">
        <Link href="/decoder/" className="relative overflow-hidden rounded-2xl bg-ink text-paper px-5 md:px-7 py-6 block hover:opacity-[0.97]">
          <svg aria-hidden className="absolute -right-14 -bottom-14 opacity-15" width="220" height="220" viewBox="0 0 220 220">
            {[30, 60, 90].map((r) => (
              <circle key={r} cx="110" cy="110" r={r} fill="none" stroke="currentColor" strokeWidth="1.5" />
            ))}
          </svg>
          <span className="text-sm opacity-80">Curiosità del giorno, {e.category.toLowerCase()}</span>
          <span className="display text-[1.9rem] md:text-[2.3rem] block mt-1 max-w-[18ch]">{e.title}</span>
          <span className="text-sm opacity-75 block">{e.when}</span>
          <span className="block mt-3 prose-brief text-[1rem] opacity-95 max-w-[52ch] line-clamp-4">{e.story}</span>
          <span className="block mt-3 font-semibold">{e.question}</span>
        </Link>
        <div className="grid gap-4">
          <div className="rounded-2xl border border-rule p-4">
            <h3 className="font-semibold">Rumore e silenzio</h3>
            <div className="grid grid-cols-2 gap-4 mt-2 text-sm">
              <div>
                <p className="text-buoy font-semibold">Troppo rumore</p>
                <ul className="mt-1 space-y-1">
                  {noise.length ? noise.map((t) => <li key={t.slug}><Link href={`/tema/?s=${t.slug}`} className="hover:underline">{t.name}</Link></li>) : <li className="text-muted">Nessuno oggi</li>}
                </ul>
              </div>
              <div>
                <p className="text-seaglass font-semibold">Sostanza nel silenzio</p>
                <ul className="mt-1 space-y-1">
                  {silence.length ? silence.map((t) => <li key={t.slug}><Link href={`/tema/?s=${t.slug}`} className="hover:underline">{t.name}</Link></li>) : <li className="text-muted">Nessuno oggi</li>}
                </ul>
              </div>
            </div>
          </div>
          <div className="rounded-2xl border border-rule p-4">
            <h3 className="font-semibold">Dalla contro-narrazione</h3>
            {dec?.alternative_latest.length ? (
              <ul className="mt-2 space-y-2.5 text-sm">
                {dec.alternative_latest.slice(0, 3).map((h) => (
                  <li key={h.url}>
                    <a href={h.url} target="_blank" rel="noreferrer" className="hover:underline leading-snug block">
                      {h.title}
                    </a>
                    <span className="text-xs text-muted">
                      {h.source}, {when(h.published_at)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted mt-2">I titoli arrivano con la prossima raccolta.</p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

/** Elenco completo con ricerca e filtro per verdetto. */
function AllAssets({ rows }: { rows: RadarRow[] }) {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<VerdictKey | "tutti">("tutti");
  const [all, setAll] = useState(false);
  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows
      .map((r) => ({ r, v: verdictOf(r) }))
      .filter(({ r, v }) => (filter === "tutti" || v.key === filter) && (!needle || `${r.entity_id} ${r.name} ${r.theme_name}`.toLowerCase().includes(needle)))
      .sort((a, b) => a.v.rank - b.v.rank || b.r.asymmetry - a.r.asymmetry);
  }, [rows, q, filter]);
  const shown = all || q ? list : list.slice(0, 10);
  return (
    <section aria-labelledby="tutti" className="mt-14">
      <h2 id="tutti" className="display text-[2.2rem]">
        Tutti i titoli
      </h2>
      <div className="mt-4 flex flex-col sm:flex-row gap-3">
        <label className="relative flex-1">
          <span className="sr-only">Cerca un titolo o un tema</span>
          <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" strokeLinecap="round" />
          </svg>
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Cerca ticker, nome o tema"
            className="w-full rounded-full bg-paper-2 border border-rule pl-10 pr-4 min-h-12 text-base focus:border-ink outline-none"
          />
        </label>
        <div className="-mx-4 px-4 sm:mx-0 sm:px-0 flex gap-2 overflow-x-auto no-scrollbar" role="group" aria-label="Filtra per verdetto">
          {(["tutti", "appetibile", "interessante", "scontato", "fermo", "evitare"] as const).map((k) => (
            <button
              key={k}
              onClick={() => setFilter(k)}
              aria-pressed={filter === k}
              className={`shrink-0 text-sm px-3.5 min-h-10 rounded-full border transition-colors ${filter === k ? "bg-ink text-paper border-ink" : "border-rule hover:border-ink"}`}
            >
              {k === "tutti" ? "Tutti" : VERDICTS[k].label}
            </button>
          ))}
        </div>
      </div>
      {list.length === 0 ? (
        <Empty>Nessun titolo corrisponde alla ricerca.</Empty>
      ) : (
        <ul className="mt-3 divide-y divide-rule border-y border-rule">
          {shown.map(({ r }) => (
            <li key={r.entity_id}>
              <AssetRow r={r} />
            </li>
          ))}
        </ul>
      )}
      {!all && !q && list.length > 10 && (
        <button onClick={() => setAll(true)} className="mt-3 w-full sm:w-auto border border-ink rounded-full px-5 min-h-11 font-semibold">
          Mostra tutti i {list.length} titoli
        </button>
      )}
    </section>
  );
}

function HomeSkeleton() {
  return (
    <div className="pt-10 animate-pulse" role="status" aria-label="Caricamento del radar">
      <div className="h-4 w-48 bg-paper-2 rounded" />
      <div className="h-14 w-3/4 bg-paper-2 rounded mt-4" />
      <div className="h-14 w-1/2 bg-paper-2 rounded mt-2" />
      <div className="flex gap-2 mt-6">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-11 w-32 bg-paper-2 rounded-full" />
        ))}
      </div>
      <div className="flex gap-3 mt-10 overflow-hidden">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-52 w-[78%] md:w-1/4 shrink-0 bg-paper-2 rounded-2xl" />
        ))}
      </div>
    </div>
  );
}

function AlertDot({ level }: { level: "alta" | "media" | "bassa" }) {
  const color = level === "alta" ? "var(--buoy)" : level === "media" ? "var(--sand)" : "var(--contour)";
  return (
    <span className="relative inline-flex w-2.5 h-2.5 shrink-0 self-center" title={`Allerta ${level}`}>
      {level === "alta" && <span className="absolute inset-0 rounded-full animate-ping motion-reduce:hidden" style={{ background: color, opacity: 0.5 }} />}
      <span className="relative inline-block w-2.5 h-2.5 rounded-full" style={{ background: color }} />
    </span>
  );
}

export function Chevron() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" className="text-muted shrink-0" aria-hidden>
      <path d="m7.5 4.5 5.5 5.5-5.5 5.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
