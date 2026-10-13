"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ALMANAC, AlmanacEntry, CATEGORIES, entryOfTheDay } from "@/lib/almanac";
import { Point, Quadrant, Score, when, useData } from "@/lib/api";
import { Empty, ErrorBox, Loading, NoData, QuadrantTag, Sparkline } from "./ui";

type Headline = { title: string; url: string; source: string; published_at: string };
type DecoderTheme = {
  slug: string;
  name: string;
  heat: number | null;
  substance: number | null;
  gap: number | null;
  bucket: "rumore" | "silenzio" | "allineato";
  questions: string[];
  mainstream: Headline[];
  alternative: Headline[];
};
type OvertonTheme = { slug: string; name: string; hint: string; trend: number | null; heat: number | null; points: Point[]; source: string; mainstream: Headline[]; alternative: Headline[] };
type Decoder = { themes: DecoderTheme[]; overton: OvertonTheme[]; overton_steps: string[]; alternative_latest: Headline[] };
type ThemeRow = { slug: string; name: string; score: Score | null };

const FILTERS = [
  "Chi possiede il media che dà la notizia?",
  "Chi paga la pubblicità accanto all'articolo?",
  "Qual è la fonte primaria: un dato, un documento o un comunicato?",
  "Chi avrebbe da perdere se la notizia fosse raccontata diversamente?",
  "C'è un nemico comune che rende la storia più facile da accettare?",
];

export function DecoderView() {
  const dec = useData<Decoder>("decoder.json");
  const themes = useData<ThemeRow[]>("themes.json");
  const quadrantOf = useMemo(() => {
    const m: Record<string, { name: string; q?: Quadrant }> = {};
    themes.data?.forEach((t) => (m[t.slug] = { name: t.name, q: t.score?.quadrant }));
    return m;
  }, [themes.data]);

  if (dec.missing) return <NoData />;
  if (dec.error) return <ErrorBox message={dec.error} onRetry={dec.reload} />;
  if (!dec.data) return <Loading what="il decoder" />;
  const d = dec.data;
  const noise = d.themes.filter((t) => t.bucket === "rumore");
  const silence = d.themes.filter((t) => t.bucket === "silenzio");

  return (
    <div className="pt-8 md:pt-12">
      <h1 className="display text-[clamp(2.7rem,8vw,4.8rem)] max-w-[14ch]">Dietro la superficie della notizia</h1>
      <p className="mt-4 max-w-[64ch] text-lg">
        Ogni racconto ha una superficie, quella per il pubblico, e una funzione, quella per chi detiene il capitale. Qui confronti ciò
        che dicono i media con ciò che si misura, leggi la contro-narrazione e ritrovi i precedenti storici.
      </p>
      <p className="mt-2 max-w-[64ch] text-sm text-muted">
        Le domande sono strumenti di verifica, non conclusioni. Le fonti alternative valgono come termometro del sentimento, non come prova.
      </p>

      <TodayCard entry={entryOfTheDay()} quadrantOf={quadrantOf} />

      <Section id="rumore" title="Rumore e silenzio" intro="Dove l'attenzione dei media si stacca dalla sostanza misurata dal radar.">
        <div className="grid md:grid-cols-2 gap-8">
          <GapList
            title="Molto rumore, poca sostanza"
            hint="Copertura alta, dati deboli: il terreno dell'entusiasmo indotto e della liquidità d'uscita."
            items={noise}
            tone="var(--buoy)"
          />
          <GapList
            title="Sostanza senza copertura"
            hint="Contratti, volumi e adozione crescono mentre i media guardano altrove."
            items={silence}
            tone="var(--seaglass)"
          />
        </div>
      </Section>

      <TwoStories themes={d.themes.filter((t) => t.mainstream.length || t.alternative.length)} />

      <Section id="overton" title="Finestra di Overton" intro="Come un'idea passa da impensabile a legge. Qui si misura quanto se ne parla, giorno dopo giorno.">
        <ol className="flex flex-wrap gap-1.5 mb-6" aria-label="Le tappe della finestra">
          {d.overton_steps.map((s, i) => (
            <li key={s} className="flex items-center gap-1.5 text-sm">
              <span className="px-3 py-1 rounded-full border border-rule" style={{ background: `color-mix(in srgb, var(--seaglass) ${6 + i * 5}%, transparent)` }}>
                {s}
              </span>
              {i < d.overton_steps.length - 1 && <span aria-hidden className="text-muted">›</span>}
            </li>
          ))}
        </ol>
        <div className="grid md:grid-cols-3 gap-6">
          {d.overton.map((o) => (
            <article key={o.slug} className="border-t-2 border-ink pt-3">
              <h3 className="display text-[1.6rem] leading-tight">{o.name}</h3>
              <p className="text-sm text-muted mt-1">{o.hint}</p>
              <div className="mt-3">
                <Sparkline points={o.points} color="var(--seaglass)" height={44} />
              </div>
              <p className="text-sm mt-1">
                {o.trend === null
                  ? "Traiettoria in costruzione: servono alcuni giorni di dati."
                  : o.trend > 0.1
                    ? `Attenzione in salita (${Math.round(o.trend * 100)}% sul periodo precedente): la finestra si sta muovendo.`
                    : o.trend < -0.1
                      ? `Attenzione in calo (${Math.round(o.trend * 100)}%): il tema esce dai riflettori.`
                      : "Attenzione stabile."}
              </p>
              <HeadlineList title="Mainstream" items={o.mainstream.slice(0, 2)} />
              <HeadlineList title="Contro-narrazione" items={o.alternative.slice(0, 2)} />
            </article>
          ))}
        </div>
      </Section>

      <Almanac quadrantOf={quadrantOf} />

      <Section id="alt" title="Ultime dalla contro-narrazione" intro="ZeroHedge, Naked Capitalism, Doomberg, Lyn Alden, Scenari Economici. Da leggere con lo stesso spirito critico dei media tradizionali.">
        {d.alternative_latest.length ? (
          <ul className="divide-y divide-rule border-y border-rule">
            {d.alternative_latest.map((h) => (
              <li key={h.url} className="py-2.5">
                <a href={h.url} target="_blank" rel="noreferrer" className="hover:underline">
                  {h.title}
                </a>
                <p className="text-xs text-muted mt-0.5">
                  {h.source}, {when(h.published_at)}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <Empty>Le fonti alternative compaiono dopo la prossima raccolta delle notizie.</Empty>
        )}
      </Section>
    </div>
  );
}

function Section({ id, title, intro, children }: { id: string; title: string; intro: string; children: React.ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-t`} className="mt-14 scroll-mt-24">
      <h2 id={`${id}-t`} className="display text-[2.3rem]">
        {title}
      </h2>
      <p className="text-muted mt-1 mb-5 max-w-[64ch]">{intro}</p>
      {children}
    </section>
  );
}

function TodayCard({ entry, quadrantOf }: { entry: AlmanacEntry; quadrantOf: Record<string, { name: string; q?: Quadrant }> }) {
  return (
    <section aria-labelledby="oggi" className="mt-10 relative overflow-hidden rounded-2xl bg-ink text-paper px-5 md:px-8 py-7">
      <svg aria-hidden className="absolute -right-16 -top-16 opacity-20" width="260" height="260" viewBox="0 0 260 260">
        {[40, 80, 120].map((r) => (
          <circle key={r} cx="130" cy="130" r={r} fill="none" stroke="currentColor" strokeWidth="1.5" />
        ))}
      </svg>
      <p className="text-sm opacity-80">
        Curiosità del giorno, {entry.category.toLowerCase()}
      </p>
      <h2 id="oggi" className="display text-[clamp(2rem,6vw,3.2rem)] mt-2 max-w-[20ch]">
        {entry.title}
      </h2>
      <p className="text-sm opacity-80 mt-1">{entry.when}</p>
      <p className="prose-brief mt-4 max-w-[62ch]">{entry.story}</p>
      <p className="prose-brief mt-3 max-w-[62ch]">
        <b>Oggi.</b> {entry.today}
      </p>
      <p className="mt-4 text-lg font-semibold max-w-[50ch]">{entry.question}</p>
      <ThemeChips slugs={entry.themes} quadrantOf={quadrantOf} dark />
    </section>
  );
}

function ThemeChips({ slugs, quadrantOf, dark = false }: { slugs: string[]; quadrantOf: Record<string, { name: string; q?: Quadrant }>; dark?: boolean }) {
  return (
    <ul className="flex flex-wrap gap-2 mt-4" aria-label="Temi collegati nel radar">
      {slugs.map((s) => (
        <li key={s}>
          <Link
            href={`/tema/?s=${s}`}
            className={`inline-flex items-center gap-2 text-sm px-3 min-h-10 rounded-full border ${dark ? "border-paper/40 hover:bg-paper/10" : "border-rule hover:border-ink"}`}
          >
            {quadrantOf[s]?.name ?? s}
            {quadrantOf[s]?.q && (
              <span className={dark ? "opacity-90" : ""}>
                <QuadrantTag q={quadrantOf[s].q!} />
              </span>
            )}
          </Link>
        </li>
      ))}
    </ul>
  );
}

function GapList({ title, hint, items, tone }: { title: string; hint: string; items: DecoderTheme[]; tone: string }) {
  return (
    <div>
      <h3 className="font-semibold text-lg" style={{ color: tone }}>
        {title}
      </h3>
      <p className="text-sm text-muted mb-3">{hint}</p>
      {items.length === 0 ? (
        <Empty>Nessun tema in questa situazione oggi.</Empty>
      ) : (
        <ul className="divide-y divide-rule border-y border-rule">
          {items.map((t) => (
            <li key={t.slug} className="py-3">
              <details>
                <summary className="cursor-pointer list-none">
                  <span className="flex items-baseline justify-between gap-3">
                    <span className="font-semibold">{t.name}</span>
                    <span className="text-sm text-muted shrink-0">apri le domande</span>
                  </span>
                  <span className="grid grid-cols-[80px_1fr_32px] items-center gap-2 text-xs mt-2">
                    <span className="text-muted">Attenzione</span>
                    <span className="h-1.5 bg-paper-2 relative">
                      <span className="absolute inset-y-0 left-0" style={{ width: `${t.heat ?? 0}%`, background: "var(--buoy)" }} />
                    </span>
                    <span className="text-right">{Math.round(t.heat ?? 0)}</span>
                    <span className="text-muted">Sostanza</span>
                    <span className="h-1.5 bg-paper-2 relative">
                      <span className="absolute inset-y-0 left-0" style={{ width: `${t.substance ?? 0}%`, background: "var(--depth)" }} />
                    </span>
                    <span className="text-right">{Math.round(t.substance ?? 0)}</span>
                  </span>
                </summary>
                <ul className="mt-3 space-y-1.5 text-sm list-disc pl-5">
                  {t.questions.map((q) => (
                    <li key={q}>{q}</li>
                  ))}
                </ul>
                <Link href={`/tema/?s=${t.slug}`} className="inline-flex items-center min-h-10 text-sm underline mt-1">
                  Apri il tema
                </Link>
              </details>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function TwoStories({ themes }: { themes: DecoderTheme[] }) {
  const [slug, setSlug] = useState<string | null>(null);
  const current = themes.find((t) => t.slug === slug) ?? themes.find((t) => t.alternative.length) ?? themes[0];
  return (
    <Section id="racconti" title="Due racconti" intro="Lo stesso tema visto dai media tradizionali e dalle fonti di contro-narrazione. Poi le cinque domande di Herman e Chomsky.">
      {!current ? (
        <Empty>I titoli compaiono dopo la prossima raccolta delle notizie.</Empty>
      ) : (
        <>
          <div className="-mx-4 px-4 md:mx-0 md:px-0 flex gap-2 overflow-x-auto no-scrollbar md:flex-wrap mb-5" role="group" aria-label="Scegli il tema">
            {themes.map((t) => (
              <button
                key={t.slug}
                onClick={() => setSlug(t.slug)}
                aria-pressed={current.slug === t.slug}
                className={`shrink-0 text-sm px-3.5 min-h-10 rounded-full border ${current.slug === t.slug ? "bg-ink text-paper border-ink" : "border-rule hover:border-ink"}`}
              >
                {t.name}
                {t.alternative.length > 0 && <span className="ml-1.5 opacity-70">({t.alternative.length})</span>}
              </button>
            ))}
          </div>
          <div className="grid md:grid-cols-2 gap-8">
            <HeadlineList title="Cosa raccontano i media" items={current.mainstream} big />
            <HeadlineList title="Cosa dice la contro-narrazione" items={current.alternative} big emptyText="Nessun titolo alternativo su questo tema nelle ultime tre settimane." />
          </div>
          <div className="mt-6 bg-paper-2 rounded-xl px-5 py-4">
            <h3 className="font-semibold">Le cinque domande prima di crederci</h3>
            <ol className="list-decimal pl-5 mt-2 space-y-1 text-[0.95rem]">
              {FILTERS.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ol>
          </div>
        </>
      )}
    </Section>
  );
}

function HeadlineList({ title, items, big = false, emptyText }: { title: string; items: Headline[]; big?: boolean; emptyText?: string }) {
  return (
    <div className={big ? "" : "mt-3"}>
      <h4 className={big ? "font-semibold text-lg mb-2" : "text-xs text-muted mb-1"}>{title}</h4>
      {items.length === 0 ? (
        <p className="text-sm text-muted">{emptyText ?? "Nessun titolo recente."}</p>
      ) : (
        <ul className={big ? "divide-y divide-rule border-y border-rule" : "space-y-1.5"}>
          {items.map((h) => (
            <li key={h.url} className={big ? "py-2.5" : "text-sm leading-snug"}>
              <a href={h.url} target="_blank" rel="noreferrer" className="hover:underline">
                {h.title}
              </a>
              {big && (
                <p className="text-xs text-muted mt-0.5">
                  {h.source}, {when(h.published_at)}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Almanac({ quadrantOf }: { quadrantOf: Record<string, { name: string; q?: Quadrant }> }) {
  const [cat, setCat] = useState<string>("Tutto");
  const items = ALMANAC.filter((e) => cat === "Tutto" || e.category === cat);
  return (
    <Section id="almanacco" title="Almanacco" intro="Niente accade per la prima volta. Precedenti storici, psicologia delle masse e modelli economici, ognuno collegato ai temi del radar in cui oggi si vede.">
      <div className="-mx-4 px-4 md:mx-0 md:px-0 flex gap-2 overflow-x-auto no-scrollbar md:flex-wrap mb-5" role="group" aria-label="Filtra l'almanacco">
        {["Tutto", ...CATEGORIES].map((c) => (
          <button
            key={c}
            onClick={() => setCat(c)}
            aria-pressed={cat === c}
            className={`shrink-0 text-sm px-3.5 min-h-10 rounded-full border ${cat === c ? "bg-ink text-paper border-ink" : "border-rule hover:border-ink"}`}
          >
            {c}
          </button>
        ))}
      </div>
      <ul className="grid md:grid-cols-2 gap-x-10">
        {items.map((e) => (
          <li key={e.id} className="border-t border-rule py-4">
            <details>
              <summary className="cursor-pointer list-none">
                <span className="text-xs text-muted">
                  {e.category}, {e.when}
                </span>
                <span className="display text-[1.55rem] leading-tight block mt-1">{e.title}</span>
                <span className="text-sm text-muted block mt-1">{e.question}</span>
              </summary>
              <p className="prose-brief text-base mt-3">{e.story}</p>
              <p className="prose-brief text-base mt-2">
                <b>Oggi.</b> {e.today}
              </p>
              {e.reference && <p className="text-xs text-muted mt-2">{e.reference}</p>}
              <ThemeChips slugs={e.themes} quadrantOf={quadrantOf} />
            </details>
          </li>
        ))}
      </ul>
    </Section>
  );
}
