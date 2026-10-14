"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { KEYS, Point, Score, WatchItem, getData, num, pct, safeName, useData, useLocal, utc } from "@/lib/api";
import { verdictOf } from "@/lib/verdict";
import { BriefButton } from "./brief-button";
import { ScoreRing, VerdictBadge } from "./verdict-ui";
import { AxisBars, ErrorBox, EvidenceTable, Flags, LineChart, Loading, QuadrantTag } from "./ui";

type Asset = {
  ticker: string;
  name: string;
  kind: string;
  theme: string;
  theme_name: string;
  benchmark: string;
  score: Score | null;
  snapshot: Record<string, number | string | null> | null;
  prices: Point[];
  briefings: { id: number; created_at: string; confidenza: string }[];
};

export function AssetView() {
  const t = useSearchParams().get("t") ?? "";
  const { data, error, loading, missing, reload } = useData<Asset>(t ? `assets/${safeName(t)}.json` : null);
  const [watch, setWatch] = useLocal<WatchItem[]>(KEYS.watchlist, []);

  if (!t || missing) return <ErrorBox message={`Asset ${t || "non indicato"} non presente nel radar.`} />;
  if (error) return <ErrorBox message={error} onRetry={reload} />;
  if (loading || !data) return <Loading what={t} />;
  const s = data.score;
  const snap = data.snapshot;
  const v = s ? verdictOf({ ...s, ret_3m: snap?.ret_3m as number | null, ret_1m: snap?.ret_1m as number | null }) : null;
  const watched = watch.find((w) => w.ticker === data.ticker);

  async function toggleWatch() {
    if (watched) {
      setWatch(watch.filter((w) => w.ticker !== data!.ticker));
      return;
    }
    const last = data!.prices[data!.prices.length - 1];
    let benchPrice: number | null = null;
    try {
      const b = await getData<Record<string, Point[]>>("benchmarks.json");
      const series = b[data!.benchmark] ?? b.SPY;
      benchPrice = series?.[series.length - 1]?.value ?? null;
    } catch {}
    setWatch([
      { ticker: data!.ticker, name: data!.name, day: last?.day ?? new Date().toISOString().slice(0, 10), price: last?.value ?? Number(snap?.price ?? 0),
        bench: data!.benchmark, benchPrice, quadrant: s?.quadrant ?? "" },
      ...watch,
    ]);
  }

  return (
    <article className="pt-6 md:pt-8">
      <Link href={`/tema/?s=${data.theme}`} className="inline-flex items-center min-h-10 text-sm underline decoration-rule hover:decoration-ink">
        {data.theme_name}
      </Link>
      <header className="flex items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="display text-[clamp(3rem,12vw,6rem)] break-words">{data.ticker}</h1>
          <p className="text-lg md:text-xl mt-1">{data.name}</p>
        </div>
        {v && s && <ScoreRing value={s.asymmetry} color={v.color} size={84} />}
      </header>

      {v && s && (
        <section
          aria-label="Verdetto"
          className="mt-5 rounded-2xl px-5 py-4 border"
          style={{ background: v.soft, borderColor: `color-mix(in srgb, ${v.color} 35%, transparent)` }}
        >
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <VerdictBadge v={v} size="lg" />
            <span className="font-semibold">{v.short}</span>
            <span className="text-sm ml-auto" style={{ color: "var(--muted-text)" }}>
              Quadrante <QuadrantTag q={s.quadrant} />
            </span>
          </div>
          <p className="mt-2 max-w-[62ch]">{v.meaning}</p>
          {v.reasons.length > 0 && (
            <ul className="mt-3 grid sm:grid-cols-3 gap-2">
              {v.reasons.map((x) => (
                <li key={x.text} className="flex gap-2 items-start rounded-xl bg-paper/70 px-3 py-2 text-sm leading-snug">
                  <span aria-hidden className="font-bold" style={{ color: x.good ? "var(--seaglass)" : "var(--buoy)" }}>
                    {x.good ? "+" : "−"}
                  </span>
                  <span>
                    <span className="sr-only">{x.good ? "A favore: " : "Contro: "}</span>
                    {x.text}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p className="text-xs mt-3" style={{ color: "var(--muted-text)" }}>Indica cosa vale la pena studiare, non cosa comprare.</p>
        </section>
      )}

      <div className="flex flex-col sm:flex-row sm:items-start gap-3 my-6">
        <BriefButton target={{ ticker: data.ticker }} label="Genera briefing" />
        <button
          onClick={toggleWatch}
          aria-pressed={!!watched}
          className={`w-full sm:w-auto px-5 min-h-12 rounded-full font-semibold border inline-flex items-center justify-center gap-2 ${watched ? "border-seaglass text-seaglass bg-seaglass-soft" : "border-ink"}`}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill={watched ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8" aria-hidden>
            <path d="M6 3h12v18l-6-4-6 4z" strokeLinejoin="round" />
          </svg>
          {watched ? `Nella tua lista dal ${utc(watched.day).toLocaleDateString("it-IT")}` : "Segui nella tua lista"}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-10">
        <section aria-labelledby="prezzo">
          <h2 id="prezzo" className="display text-[1.8rem] mb-2">Prezzo, ultimi 12 mesi</h2>
          <LineChart points={data.prices} label={`Prezzo di ${data.ticker}`} />
          {snap && (
            <dl className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-3 mt-4 text-sm">
              <Metric label="Prezzo" value={num(snap.price as number, 2)} />
              <Metric label="1 mese" value={pct(snap.ret_1m as number)} />
              <Metric label="3 mesi" value={pct(snap.ret_3m as number)} />
              <Metric label="12 mesi" value={pct(snap.ret_12m as number)} />
              <Metric label="Volumi 20g / 120g" value={snap.vol_ratio == null ? "n.d." : `${num(snap.vol_ratio as number, 2)}x`} />
              <Metric label="Dal massimo 52 sett." value={pct(snap.dist_52w_high as number)} />
              <Metric label={`Contro ${data.benchmark}, 3 mesi`} value={pct(snap.rs_bench_3m as number)} />
              <Metric label="Volatilità annua" value={snap.rvol_20 == null ? "n.d." : `${Math.round((snap.rvol_20 as number) * 100)}%`} />
            </dl>
          )}
        </section>
        <aside>
          <h2 className="display text-[1.8rem] mb-3">Scomposizione</h2>
          {s ? (
            <>
              <AxisBars s={s as unknown as Record<string, number>} />
              <p className="text-sm text-muted mt-3">Qualità dati {Math.round(s.data_quality * 100)}%. La tacca al centro indica il valore neutro 50.</p>
              <div className="mt-4">
                <Flags flags={s.flags} />
              </div>
            </>
          ) : (
            <p className="text-muted">Nessun punteggio ancora.</p>
          )}
          {data.briefings.length > 0 && (
            <>
              <h3 className="font-semibold mt-8 mb-2">Briefing automatici</h3>
              <ul className="text-sm divide-y divide-rule border-y border-rule">
                {data.briefings.map((b) => (
                  <li key={b.id}>
                    <Link href={`/briefing/?id=${b.id}`} className="flex justify-between items-center min-h-11 gap-3 hover:underline">
                      <span>{utc(b.created_at).toLocaleString("it-IT", { dateStyle: "medium", timeStyle: "short" })}</span>
                      <span className="text-muted">confidenza {b.confidenza}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}
        </aside>
      </div>

      <section className="mt-12" aria-labelledby="evidenze">
        <h2 id="evidenze" className="display text-[1.8rem] mb-3">Da dove vengono i numeri</h2>
        <EvidenceTable items={s?.evidence ?? []} />
      </section>
    </article>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-t border-rule pt-1.5">
      <dt className="text-muted">{label}</dt>
      <dd className="font-semibold text-base">{value}</dd>
    </div>
  );
}
