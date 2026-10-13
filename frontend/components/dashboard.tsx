"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Health, NewsItem, Point, RadarRow, num, pct, stamp, useData, when } from "@/lib/api";
import { RadarChart } from "./radar-chart";
import { Empty, ErrorBox, Flags, Loading, NoData, QuadrantTag, Sparkline } from "./ui";

type Choke = {
  chiave: string;
  nome: string;
  rilevanza: string;
  attenzione_z: number | null;
  allerta: "alta" | "media" | "bassa";
  titoli: { titolo: string; url: string; fonte: string; data: string }[];
};
type Macro = { indicators: { serie: string; nome: string; ultimo: number; var_3m: number; series: Point[] }[] };

export function Dashboard() {
  const radar = useData<RadarRow[]>("radar.json");
  const health = useData<Health>("health.json");
  const geo = useData<{ chokepoints: Choke[] }>("geo.json");
  const macro = useData<Macro>("macro.json");
  const feed = useData<NewsItem[]>("feed.json");
  const [theme, setTheme] = useState<string>("tutti");

  const themes = useMemo(() => {
    const m = new Map<string, string>();
    radar.data?.forEach((r) => m.set(r.theme, r.theme_name));
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [radar.data]);
  const rows = useMemo(() => (radar.data ?? []).filter((r) => theme === "tutti" || r.theme === theme), [radar.data, theme]);
  const stealth = rows.filter((r) => r.quadrant === "stealth");
  const alerts = geo.data?.chokepoints.filter((c) => c.allerta !== "bassa") ?? [];

  if (radar.missing) return <NoData />;
  if (radar.error) return <ErrorBox message={radar.error} onRetry={radar.reload} />;
  if (radar.loading && !radar.data) return <Loading what="il radar" />;

  return (
    <>
      <section className="pt-8 md:pt-12 pb-6">
        <p className="text-sm text-muted rise">
          {new Date().toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long" })}
          {health.data?.exported_at ? `, dati delle ${stamp(health.data.exported_at).split(", ").pop()}` : ""}
        </p>
        <div className="mt-3 grid lg:grid-cols-[1fr_auto] gap-6 items-end">
          <h1 className="display text-[clamp(2.7rem,8vw,5.4rem)] max-w-[13ch] rise">Dove la sostanza arriva prima del rumore</h1>
          <dl className="grid grid-cols-3 lg:grid-cols-1 gap-x-4 gap-y-3 lg:text-right items-start rise" style={{ animationDelay: "0.1s" }}>
            <Stat value={stealth.length} label="in zona stealth" color="var(--seaglass)" />
            <Stat value={rows.length} label="asset monitorati" />
            <Stat value={alerts.length} label="chokepoint in allerta" color={alerts.length ? "var(--buoy)" : undefined} />
          </dl>
        </div>
      </section>

      <div className="-mx-4 px-4 md:mx-0 md:px-0 flex gap-2 mb-5 overflow-x-auto no-scrollbar md:flex-wrap" role="group" aria-label="Filtra per tema">
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

      <section className="grid lg:grid-cols-[minmax(0,1fr)_340px] gap-8 lg:gap-10">
        <div>
          {rows.length ? (
            <RadarChart rows={rows} labelTop={theme === "tutti" ? 12 : 30} />
          ) : (
            <Empty>Nessun asset in questo tema.</Empty>
          )}
          <p className="text-sm text-muted mt-3 max-w-[70ch]">
            Sostanza è la media di adozione, accumulo e catalizzatori. Le isobate misurano la distanza dalla zona più asimmetrica; i
            punti sbiaditi hanno dati incompleti.
          </p>
        </div>

        <aside aria-labelledby="avvisi">
          <h2 id="avvisi" className="display text-[1.9rem]">Avvisi ai naviganti</h2>
          <p className="text-sm text-muted mb-3 mt-1">Chokepoint marittimi: copertura dell&apos;ultima settimana contro gli ultimi 3 mesi.</p>
          {geo.error && <ErrorBox message={geo.error} />}
          <ul className="divide-y divide-rule border-y border-rule">
            {geo.data?.chokepoints
              .slice()
              .sort((a, b) => (b.attenzione_z ?? -9) - (a.attenzione_z ?? -9))
              .map((c) => (
                <li key={c.chiave} className="py-3">
                  <div className="flex items-baseline gap-2">
                    <AlertDot level={c.allerta} />
                    <span className="font-semibold">{c.nome}</span>
                    <span className="ml-auto text-sm text-muted">
                      {c.attenzione_z === null ? "n.d." : `${c.attenzione_z > 0 ? "+" : "−"}${num(Math.abs(c.attenzione_z), 1)} σ`}
                    </span>
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

      <section className="mt-14" aria-labelledby="top">
        <h2 id="top" className="display text-[2.2rem] mb-4">Le asimmetrie più alte</h2>
        <ol className="md:hidden divide-y divide-rule border-y border-rule">
          {rows.slice(0, 12).map((r) => (
            <li key={r.entity_id}>
              <Link href={`/asset/?t=${encodeURIComponent(r.entity_id)}`} className="flex items-center gap-4 py-3.5 active:bg-paper-2">
                <span className="display text-[2rem] w-12 text-right" style={{ color: r.quadrant === "stealth" ? "var(--seaglass)" : undefined }}>
                  {Math.round(r.asymmetry)}
                </span>
                <span className="flex-1 min-w-0">
                  <span className="flex items-baseline gap-2">
                    <span className="font-semibold">{r.entity_id}</span>
                    <span className="text-sm text-muted truncate">{r.name}</span>
                  </span>
                  <span className="flex items-center gap-3 text-sm mt-0.5">
                    <QuadrantTag q={r.quadrant} />
                    <span className="text-muted">3m {pct(r.ret_3m)}</span>
                  </span>
                </span>
                <Chevron />
              </Link>
            </li>
          ))}
        </ol>
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-[0.95rem] border-collapse">
            <thead>
              <tr className="text-left text-muted text-sm border-b border-ink">
                <th className="py-2 pr-4 font-normal">Asset</th>
                <th className="py-2 pr-4 font-normal">Tema</th>
                <th className="py-2 pr-4 font-normal">Quadrante</th>
                <th className="py-2 pr-4 font-normal text-right">Asimmetria</th>
                <th className="py-2 pr-4 font-normal text-right">Sostanza</th>
                <th className="py-2 pr-4 font-normal text-right">Attenzione</th>
                <th className="py-2 pr-4 font-normal text-right">3 mesi</th>
                <th className="py-2 font-normal">Segnali</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 15).map((r) => (
                <tr key={r.entity_id} className="border-b border-rule align-top hover:bg-paper-2/60">
                  <td className="py-2.5 pr-4">
                    <Link href={`/asset/?t=${encodeURIComponent(r.entity_id)}`} className="font-semibold underline decoration-rule hover:decoration-ink">
                      {r.entity_id}
                    </Link>
                    <span className="block text-sm text-muted">{r.name}</span>
                  </td>
                  <td className="py-2.5 pr-4">
                    <Link href={`/tema/?s=${r.theme}`} className="hover:underline">
                      {r.theme_name}
                    </Link>
                  </td>
                  <td className="py-2.5 pr-4">
                    <QuadrantTag q={r.quadrant} />
                  </td>
                  <td className="py-2.5 pr-4 text-right font-semibold">{Math.round(r.asymmetry)}</td>
                  <td className="py-2.5 pr-4 text-right">{Math.round(r.substance)}</td>
                  <td className="py-2.5 pr-4 text-right">{Math.round(r.heat)}</td>
                  <td className="py-2.5 pr-4 text-right">{pct(r.ret_3m)}</td>
                  <td className="py-2.5">
                    <Flags flags={r.flags} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-14 grid lg:grid-cols-2 gap-12">
        <div aria-labelledby="macro">
          <h2 id="macro" className="display text-[2.2rem] mb-4">Macro e liquidità</h2>
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
          <h2 id="feed" className="display text-[2.2rem] mb-4">Flusso in arrivo</h2>
          {feed.data?.length ? (
            <ul className="divide-y divide-rule border-y border-rule">
              {feed.data.slice(0, 18).map((n) => (
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

function Stat({ value, label, color }: { value: number; label: string; color?: string }) {
  return (
    <div className="flex flex-col-reverse justify-end">
      <dt className="text-sm text-muted mt-1">{label}</dt>
      <dd className="display text-[2.6rem] md:text-[3.2rem] leading-none" style={{ color }}>
        {value}
      </dd>
    </div>
  );
}

function AlertDot({ level }: { level: "alta" | "media" | "bassa" }) {
  const color = level === "alta" ? "var(--buoy)" : level === "media" ? "var(--sand)" : "var(--contour)";
  return (
    <span className="relative inline-flex w-2.5 h-2.5 shrink-0 self-center" title={`Allerta ${level}`}>
      {level === "alta" && <span className="absolute inset-0 rounded-full animate-ping motion-reduce:hidden" style={{ background: color, opacity: 0.5 }} />}
      <span className="relative inline-block w-2.5 h-2.5 rounded-full" style={{ background: color }} />
      <span className="sr-only">Allerta {level}</span>
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
