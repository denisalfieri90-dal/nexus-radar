"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BriefingDoc, KEYS, Point, WatchItem, getData, num, pct, safeName, useData, useLocal, utc } from "@/lib/api";
import { Chevron } from "./dashboard";
import { Empty, ErrorBox, Loading, NoData, QuadrantTag } from "./ui";

type Summary = { n: number; hit_rate?: number; excess_medio?: number };
type Stats = { totale: number; aperti: number; per_checkpoint: Record<string, Summary>; auto_vs_manuale: Record<string, Summary> };
type Entry = {
  id: number;
  ticker: string;
  quadrant: string;
  thesis: string;
  entry_day: string;
  entry_price: number;
  bench_ticker: string;
  auto: boolean;
  status: string;
  notes: string;
  briefing_id: number | null;
  ret_to_date: number | null;
  excess_to_date: number | null;
};
type BriefRow = { id: number; subject: string; ticker: string; created_at: string; confidenza: string; quadrante: string };

const CP = ["30", "90", "180", "365"];

export function JournalView() {
  const stats = useData<Stats>("journal_stats.json");
  const entries = useData<Entry[]>("journal.json");
  const briefs = useData<BriefRow[]>("briefings.json");
  const [localBriefs] = useLocal<BriefingDoc[]>(KEYS.briefings, []);

  if (stats.missing) return <NoData />;
  if (stats.error) return <ErrorBox message={stats.error} onRetry={stats.reload} />;
  if (!stats.data || !entries.data) return <Loading what="il journal" />;
  const s = stats.data;

  return (
    <div className="pt-8 md:pt-12">
      <h1 className="display text-[clamp(2.7rem,8vw,4.6rem)]">Il radar funziona?</h1>
      <p className="mt-3 max-w-[66ch]">
        Ogni settimana il sistema registra da solo i primi cinque asset in zona stealth, senza scelta umana, e li confronta con il
        benchmark a 30, 90, 180 e 365 giorni. È il campione che dice se il metodo ha un vantaggio o se ricordiamo solo i successi.
      </p>

      <section className="mt-8 grid grid-cols-2 lg:grid-cols-4 border-y border-ink">
        {CP.map((cp, i) => {
          const x = s.per_checkpoint[cp];
          return (
            <div key={cp} className={`py-5 px-3 md:px-4 border-rule ${i % 2 === 0 ? "border-r" : ""} ${i < 2 ? "border-b lg:border-b-0" : ""} lg:border-r lg:last:border-r-0`}>
              <p className="text-sm text-muted">Dopo {cp} giorni</p>
              {x?.n ? (
                <>
                  <p className="display text-[2.4rem] md:text-[2.9rem] leading-none mt-1" style={{ color: (x.excess_medio ?? 0) >= 0 ? "var(--seaglass)" : "var(--buoy)" }}>
                    {pct(x.excess_medio)}
                  </p>
                  <p className="text-sm mt-1">
                    in eccesso medio. {Math.round((x.hit_rate ?? 0) * 100)}% sopra il benchmark, su {x.n}
                  </p>
                </>
              ) : (
                <p className="mt-2 text-muted text-sm">Nessun segnale ancora maturato.</p>
              )}
            </div>
          );
        })}
      </section>

      <Watchlist />

      {(localBriefs.length > 0 || (briefs.data?.length ?? 0) > 0) && (
        <section className="mt-12" aria-labelledby="briefs">
          <h2 id="briefs" className="display text-[2rem] mb-3">Briefing</h2>
          <ul className="divide-y divide-rule border-y border-rule">
            {[
              ...localBriefs.map((b) => ({ id: String(b.id), title: b.subject, when: b.created_at, conf: b.payload?.confidenza, mine: true })),
              ...(briefs.data ?? []).map((b) => ({ id: String(b.id), title: b.subject, when: b.created_at, conf: b.confidenza, mine: false })),
            ]
              .sort((a, b) => utc(b.when).getTime() - utc(a.when).getTime())
              .slice(0, 30)
              .map((b) => (
                <li key={b.id}>
                  <Link href={`/briefing/?id=${encodeURIComponent(b.id)}`} className="flex items-center gap-3 min-h-14 py-2 hover:bg-paper-2/60">
                    <span className="flex-1 min-w-0">
                      <span className="font-semibold">{b.title}</span>
                      <span className="block text-sm text-muted">
                        {utc(b.when).toLocaleString("it-IT", { dateStyle: "medium", timeStyle: "short" })}, confidenza {b.conf ?? "n.d."}
                        {b.mine ? ", richiesto da te" : ", automatico"}
                      </span>
                    </span>
                    <Chevron />
                  </Link>
                </li>
              ))}
          </ul>
        </section>
      )}

      <section className="mt-12" aria-labelledby="registro">
        <h2 id="registro" className="display text-[2rem] mb-3">Registro automatico</h2>
        {entries.data.length === 0 ? (
          <Empty>Nessun segnale registrato: la prima registrazione automatica avviene con la raccolta quotidiana.</Empty>
        ) : (
          <ul className="divide-y divide-rule border-y border-rule">
            {entries.data.map((e) => (
              <li key={e.id}>
                <Link href={`/asset/?t=${encodeURIComponent(e.ticker)}`} className="grid grid-cols-[1fr_auto] gap-x-4 py-3 items-center hover:bg-paper-2/60">
                  <span className="min-w-0">
                    <span className="font-semibold">{e.ticker}</span>
                    <span className="text-sm text-muted ml-2">dal {utc(e.entry_day).toLocaleDateString("it-IT")}</span>
                    <span className="flex items-center gap-3 text-sm mt-0.5">
                      <QuadrantTag q={e.quadrant} />
                      <span className="text-muted">prezzo {pct(e.ret_to_date)}</span>
                    </span>
                  </span>
                  <span className="text-right">
                    <span className="display text-[1.7rem] block leading-none" style={{ color: (e.excess_to_date ?? 0) >= 0 ? "var(--seaglass)" : "var(--buoy)" }}>
                      {pct(e.excess_to_date)}
                    </span>
                    <span className="text-xs text-muted">contro {e.bench_ticker}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

/** Lista personale: salvata sul dispositivo, misurata contro il benchmark con i prezzi del radar. */
function Watchlist() {
  const [watch, setWatch] = useLocal<WatchItem[]>(KEYS.watchlist, []);
  const [now, setNow] = useState<Record<string, number>>({});
  const [bench, setBench] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!watch.length) return;
    watch.forEach((w) =>
      getData<{ prices: Point[] }>(`assets/${safeName(w.ticker)}.json`)
        .then((a) => setNow((m) => ({ ...m, [w.ticker]: a.prices[a.prices.length - 1]?.value })))
        .catch(() => {}),
    );
    getData<Record<string, Point[]>>("benchmarks.json")
      .then((b) => setBench(Object.fromEntries(Object.entries(b).map(([k, v]) => [k, v[v.length - 1]?.value]))))
      .catch(() => {});
  }, [watch]);

  return (
    <section className="mt-12" aria-labelledby="lista">
      <h2 id="lista" className="display text-[2rem]">La tua lista</h2>
      <p className="text-sm text-muted mt-1 mb-3">Gli asset che segui, salvati solo su questo dispositivo.</p>
      {watch.length === 0 ? (
        <Empty>Apri un asset e tocca &ldquo;Segui nella tua lista&rdquo;: qui vedrai come si è mosso da quel giorno rispetto al benchmark.</Empty>
      ) : (
        <ul className="divide-y divide-rule border-y border-rule">
          {watch.map((w) => {
            const p = now[w.ticker];
            const r = p ? p / w.price - 1 : null;
            const b = w.benchPrice && bench[w.bench] ? bench[w.bench] / w.benchPrice - 1 : null;
            const ex = r !== null && b !== null ? r - b : null;
            return (
              <li key={w.ticker} className="grid grid-cols-[1fr_auto_auto] gap-x-3 py-3 items-center">
                <Link href={`/asset/?t=${encodeURIComponent(w.ticker)}`} className="min-w-0">
                  <span className="font-semibold">{w.ticker}</span>
                  <span className="text-sm text-muted ml-2 truncate">{w.name}</span>
                  <span className="block text-sm text-muted">
                    dal {utc(w.day).toLocaleDateString("it-IT")} a {num(w.price, 2)}, prezzo {pct(r)}
                  </span>
                </Link>
                <span className="text-right">
                  <span className="display text-[1.7rem] block leading-none" style={{ color: (ex ?? 0) >= 0 ? "var(--seaglass)" : "var(--buoy)" }}>
                    {pct(ex)}
                  </span>
                  <span className="text-xs text-muted">contro {w.bench}</span>
                </span>
                <button
                  onClick={() => setWatch(watch.filter((x) => x.ticker !== w.ticker))}
                  className="w-11 h-11 grid place-items-center text-muted hover:text-buoy"
                  aria-label={`Rimuovi ${w.ticker} dalla lista`}
                >
                  <svg width="18" height="18" viewBox="0 0 20 20" stroke="currentColor" strokeWidth="1.8" aria-hidden>
                    <path d="M5 5l10 10M15 5 5 15" strokeLinecap="round" />
                  </svg>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
