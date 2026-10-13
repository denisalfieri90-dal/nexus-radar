"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { NewsItem, Point, Score, num, useData, utc, when } from "@/lib/api";
import { BriefButton } from "./brief-button";
import { Chevron } from "./dashboard";
import { AxisBars, Empty, ErrorBox, EvidenceTable, Flags, LineChart, Loading, NoData, QuadrantTag, Sparkline } from "./ui";

type ThemeRow = {
  slug: string;
  name: string;
  thesis_hint: string;
  module: string;
  overton: boolean;
  tags: string[];
  assets: string[];
  score: Score | null;
  attention: Point[];
};

export function ThemesList() {
  const { data, error, loading, missing, reload } = useData<ThemeRow[]>("themes.json");
  if (missing) return <NoData />;
  if (error) return <ErrorBox message={error} onRetry={reload} />;
  if (loading || !data) return <Loading what="i temi" />;
  const radar = data.filter((t) => !t.overton);
  const overton = data.filter((t) => t.overton);
  return (
    <div className="pt-8 md:pt-12">
      <h1 className="display text-[clamp(2.7rem,8vw,4.6rem)]">Temi monitorati</h1>
      <p className="mt-3 max-w-[64ch]">
        Ogni tema ha un paniere di asset di osservazione e una misura dell&apos;attenzione mediatica globale. La linea mostra quanto se
        ne è parlato negli ultimi tre mesi.
      </p>
      <ThemeTable rows={radar} />
      <h2 className="display text-[2.2rem] mt-14">Finestra di Overton</h2>
      <p className="mt-2 max-w-[64ch]">
        Narrative che passano da impensabili ad accettate. Qui si misura solo la traiettoria dell&apos;attenzione e del tono, senza
        paniere di asset.
      </p>
      <ThemeTable rows={overton} />
    </div>
  );
}

function ThemeTable({ rows }: { rows: ThemeRow[] }) {
  return (
    <>
      <ul className="md:hidden mt-5 divide-y divide-rule border-y border-rule">
        {rows.map((t) => (
          <li key={t.slug}>
            <Link href={`/tema/?s=${t.slug}`} className="flex items-center gap-3 py-4 active:bg-paper-2">
              <span className="flex-1 min-w-0">
                <span className="font-semibold block">{t.name}</span>
                <span className="text-sm text-muted line-clamp-2">{t.thesis_hint}</span>
                <span className="flex items-center gap-3 mt-1.5 text-sm">
                  {t.score && <QuadrantTag q={t.score.quadrant} />}
                  <span className="w-24 inline-block"><Sparkline points={t.attention} color="var(--buoy)" height={22} /></span>
                </span>
              </span>
              <Chevron />
            </Link>
          </li>
        ))}
      </ul>
      <div className="hidden md:block overflow-x-auto mt-6">
        <table className="w-full border-collapse">
          <thead>
            <tr className="text-left text-muted text-sm border-b border-ink">
              <th className="py-2 pr-4 font-normal">Tema</th>
              <th className="py-2 pr-4 font-normal w-44">Attenzione, 3 mesi</th>
              <th className="py-2 pr-4 font-normal">Quadrante</th>
              <th className="py-2 pr-4 font-normal text-right">Adozione</th>
              <th className="py-2 pr-4 font-normal text-right">Catalizzatori</th>
              <th className="py-2 font-normal text-right">Attenzione</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((t) => (
              <tr key={t.slug} className="border-b border-rule align-top hover:bg-paper-2/60">
                <td className="py-3 pr-4 max-w-[46ch]">
                  <Link href={`/tema/?s=${t.slug}`} className="font-semibold underline decoration-rule hover:decoration-ink">
                    {t.name}
                  </Link>
                  <p className="text-sm text-muted mt-0.5">{t.thesis_hint}</p>
                </td>
                <td className="py-3 pr-4">
                  <Sparkline points={t.attention} color="var(--buoy)" />
                </td>
                <td className="py-3 pr-4">{t.score ? <QuadrantTag q={t.score.quadrant} /> : "n.d."}</td>
                <td className="py-3 pr-4 text-right">{t.score ? Math.round(t.score.adoption) : "n.d."}</td>
                <td className="py-3 pr-4 text-right">{t.score ? Math.round(t.score.catalyst) : "n.d."}</td>
                <td className="py-3 text-right">{t.score ? Math.round(t.score.heat) : "n.d."}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

type ThemeDetail = {
  slug: string;
  name: string;
  thesis_hint: string;
  overton: boolean;
  theme_score: Score | null;
  assets: (Score & { name: string })[];
  attention: Point[];
  tone: Point[];
  news: NewsItem[];
  contracts: { award_id: string; recipient: string; agency: string; amount: number; start_date: string | null; description: string }[];
};

export function ThemeDetailView() {
  const slug = useSearchParams().get("s") ?? "";
  const { data, error, loading, missing, reload } = useData<ThemeDetail>(slug ? `themes/${slug}.json` : null);
  if (!slug || missing) return <ErrorBox message="Tema non trovato." />;
  if (error) return <ErrorBox message={error} onRetry={reload} />;
  if (loading || !data) return <Loading what="il tema" />;
  const s = data.theme_score;

  return (
    <article className="pt-6 md:pt-8">
      <Link href="/temi/" className="inline-flex items-center min-h-10 text-sm underline decoration-rule hover:decoration-ink">Tutti i temi</Link>
      <h1 className="display text-[clamp(2.6rem,8vw,4.8rem)] max-w-[18ch]">{data.name}</h1>
      <p className="text-lg mt-3 max-w-[60ch]">{data.thesis_hint}</p>
      <div className="mt-5">
        <BriefButton target={{ theme: data.slug }} label="Genera briefing sul tema" />
      </div>

      <div className="grid lg:grid-cols-[minmax(0,1fr)_300px] gap-10 mt-10">
        <section>
          <h2 className="display text-[1.8rem] mb-2">Quota di copertura mediatica globale</h2>
          <LineChart points={data.attention} color="var(--buoy)" label="Attenzione mediatica" />
          <p className="text-sm text-muted">Articoli sul tema ogni 100.000 monitorati da GDELT, media giornaliera.</p>
          {data.tone.length > 0 && (
            <>
              <h2 className="display text-[1.8rem] mb-2 mt-8">Tono medio degli articoli</h2>
              <LineChart points={data.tone} height={160} label="Tono" />
              <p className="text-sm text-muted">Valori negativi indicano una narrativa allarmata.</p>
            </>
          )}
        </section>
        <aside>
          {s ? (
            <>
              <p className="mb-3"><QuadrantTag q={s.quadrant} /></p>
              <AxisBars s={s as unknown as Record<string, number>} />
              <div className="mt-4"><Flags flags={s.flags} /></div>
            </>
          ) : (
            <p className="text-muted">Nessun punteggio ancora.</p>
          )}
        </aside>
      </div>

      {data.assets.length > 0 && (
        <section className="mt-12">
          <h2 className="display text-[1.8rem] mb-3">Paniere di osservazione</h2>
          <ul className="md:hidden divide-y divide-rule border-y border-rule">
            {[...data.assets].sort((a, b) => b.asymmetry - a.asymmetry).map((a) => (
              <li key={a.entity_id}>
                <Link href={`/asset/?t=${encodeURIComponent(a.entity_id)}`} className="flex items-center gap-4 py-3.5">
                  <span className="display text-[1.9rem] w-11 text-right" style={{ color: a.quadrant === "stealth" ? "var(--seaglass)" : undefined }}>
                    {Math.round(a.asymmetry)}
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="font-semibold">{a.entity_id}</span>
                    <span className="block text-sm text-muted truncate">{a.name}</span>
                    <span className="block text-sm mt-0.5"><QuadrantTag q={a.quadrant} /></span>
                  </span>
                  <Chevron />
                </Link>
              </li>
            ))}
          </ul>
          <table className="hidden md:table w-full border-collapse text-[0.95rem]">
            <thead>
              <tr className="text-left text-muted text-sm border-b border-ink">
                <th className="py-2 pr-4 font-normal">Asset</th>
                <th className="py-2 pr-4 font-normal">Quadrante</th>
                <th className="py-2 pr-4 font-normal text-right">Asimmetria</th>
                <th className="py-2 font-normal">Segnali</th>
              </tr>
            </thead>
            <tbody>
              {[...data.assets].sort((a, b) => b.asymmetry - a.asymmetry).map((a) => (
                <tr key={a.entity_id} className="border-b border-rule">
                  <td className="py-2.5 pr-4">
                    <Link href={`/asset/?t=${encodeURIComponent(a.entity_id)}`} className="font-semibold underline decoration-rule hover:decoration-ink">{a.entity_id}</Link>
                    <span className="text-muted ml-2">{a.name}</span>
                  </td>
                  <td className="py-2.5 pr-4"><QuadrantTag q={a.quadrant} /></td>
                  <td className="py-2.5 pr-4 text-right font-semibold">{Math.round(a.asymmetry)}</td>
                  <td className="py-2.5"><Flags flags={a.flags} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <section className="mt-12">
        <h2 className="display text-[1.8rem] mb-3">Evidenze del tema</h2>
        <EvidenceTable items={s?.evidence ?? []} />
      </section>

      <section className="mt-12 grid lg:grid-cols-2 gap-10">
        <div>
          <h2 className="display text-[1.8rem] mb-3">Contratti pubblici principali</h2>
          {data.contracts.length ? (
            <ul className="divide-y divide-rule border-y border-rule">
              {data.contracts.map((c) => (
                <li key={c.award_id} className="py-2.5">
                  <p className="flex justify-between gap-3">
                    <span className="font-semibold">{c.recipient}</span>
                    <span className="whitespace-nowrap">${num(c.amount / 1e6, 1)} mln</span>
                  </p>
                  <p className="text-sm text-muted">{c.agency}{c.start_date ? `, dal ${utc(c.start_date).toLocaleDateString("it-IT")}` : ""}</p>
                  <p className="text-sm mt-0.5 line-clamp-2">{c.description}</p>
                </li>
              ))}
            </ul>
          ) : (
            <Empty>Nessun contratto registrato per questo tema.</Empty>
          )}
        </div>
        <div>
          <h2 className="display text-[1.8rem] mb-3">Titoli recenti</h2>
          {data.news.length ? (
            <ul className="divide-y divide-rule border-y border-rule">
              {data.news.map((n) => (
                <li key={n.id} className="py-2.5">
                  <a href={n.url} target="_blank" rel="noreferrer" className="hover:underline">{n.title}</a>
                  <p className="text-xs text-muted mt-0.5">{n.domain || n.source}, {when(n.published_at)}</p>
                </li>
              ))}
            </ul>
          ) : (
            <Empty>Nessun titolo nelle ultime tre settimane.</Empty>
          )}
        </div>
      </section>
    </article>
  );
}
