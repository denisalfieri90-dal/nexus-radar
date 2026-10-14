"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { BriefingDoc, KEYS, readLocal, useData, utc } from "@/lib/api";
import { ErrorBox, Loading } from "./ui";

/* eslint-disable @typescript-eslint/no-explicit-any */

const STATO_COLOR: Record<string, string> = {
  "supportata da dati": "var(--seaglass)",
  "parzialmente supportata": "var(--sand)",
  "ipotesi non verificata": "var(--buoy)",
};

export function BriefingView() {
  const id = useSearchParams().get("id") ?? "";
  const isLocal = id.startsWith("local-");
  const remote = useData<BriefingDoc>(id && !isLocal ? `briefings/${id}.json` : null);
  const [local, setLocal] = useState<BriefingDoc | null | undefined>(undefined);
  useEffect(() => {
    if (isLocal) setLocal(readLocal<BriefingDoc[]>(KEYS.briefings, []).find((b) => String(b.id) === id) ?? null);
  }, [id, isLocal]);

  const data = isLocal ? local : remote.data;
  if (isLocal && local === null) return <ErrorBox message="Questo briefing non è salvato su questo dispositivo." />;
  if (!isLocal && (remote.missing || !id)) return <ErrorBox message="Briefing non trovato." />;
  if (!isLocal && remote.error) return <ErrorBox message={remote.error} onRetry={remote.reload} />;
  if (!data) return <Loading what="il briefing" />;
  const p = data.payload;
  const rs = p.radar_signal ?? {}, ta = p.tesi_asimmetrica ?? {}, bg = p.background_geomacro ?? {};
  const dn = p.decoder_narrazione ?? {}, ps = p.parallelo_storico ?? {}, rf = p.red_flags ?? {};

  return (
    <article className="pt-6 md:pt-8 max-w-[880px]">
      <p className="text-sm text-muted">
        Briefing del {utc(data.created_at).toLocaleString("it-IT", { dateStyle: "long", timeStyle: "short" })}, modello {data.model}
        {isLocal ? ", salvato su questo dispositivo" : ""}
      </p>

      <Section n="⚡" title="Radar signal">
        <h1 className="display text-[clamp(2.4rem,6vw,4.2rem)]">
          {rs.nome} {rs.ticker && <span className="text-muted">{rs.ticker}</span>}
        </h1>
        <p className="mt-2">
          {rs.tema}, quadrante <b>{rs.quadrante}</b>. Confidenza <b>{p.confidenza}</b>.
        </p>
        <p className="prose-brief mt-3">{rs.sintesi}</p>
      </Section>

      <Section n="🎯" title={`Tesi asimmetrica, orizzonte ${ta.orizzonte_mesi ?? "n.d."} mesi`}>
        <p className="prose-brief">{ta.tesi}</p>
        {ta.effetti_secondo_ordine && <p className="prose-brief mt-3"><b>Secondo ordine.</b> {ta.effetti_secondo_ordine}</p>}
        {ta.catalizzatori?.length > 0 && (
          <table className="w-full text-sm mt-5 border-collapse">
            <thead>
              <tr className="text-left text-muted border-b border-rule">
                <th className="py-1.5 pr-3 font-normal">Catalizzatore</th>
                <th className="py-1.5 pr-3 font-normal">Finestra</th>
                <th className="py-1.5 font-normal">Come verificarlo</th>
              </tr>
            </thead>
            <tbody>
              {ta.catalizzatori.map((c: any, i: number) => (
                <tr key={i} className="border-b border-rule/70 align-top">
                  <td className="py-2 pr-3">{c.evento}</td>
                  <td className="py-2 pr-3 whitespace-nowrap">{c.finestra}</td>
                  <td className="py-2">{c.come_verificarlo}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-5">
          <div className="border-l-2 border-seaglass pl-4">
            <h3 className="font-semibold">Se va bene</h3>
            <p className="prose-brief text-base mt-1">{ta.scenario_rialzista}</p>
          </div>
          <div className="border-l-2 border-buoy pl-4">
            <h3 className="font-semibold">Se va male</h3>
            <p className="prose-brief text-base mt-1">{ta.scenario_ribassista}</p>
          </div>
        </div>
      </Section>

      <Section n="🌐" title="Background geopolitico e macro">
        <p className="prose-brief">{bg.sintesi}</p>
        <ul className="mt-4 space-y-2">
          {bg.vettori?.map((v: any, i: number) => (
            <li key={i} className="prose-brief text-base">
              <b>{v.vettore}.</b> {v.collegamento}
            </li>
          ))}
        </ul>
      </Section>

      <Section n="🧠" title="Decoder della narrazione">
        <p className="inline-flex items-center gap-2 text-sm border px-2 py-0.5 mb-4" style={{ borderColor: STATO_COLOR[dn.stato], color: STATO_COLOR[dn.stato] }}>
          {dn.stato}
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h3 className="font-semibold">Cosa raccontano i media</h3>
            <p className="prose-brief text-base mt-1">{dn.narrativa_mainstream}</p>
          </div>
          <div>
            <h3 className="font-semibold">Lettura alternativa</h3>
            <p className="prose-brief text-base mt-1">{dn.lettura_alternativa}</p>
          </div>
        </div>
        <h3 className="font-semibold mt-5">Cui prodest</h3>
        <p className="prose-brief text-base mt-1">{dn.cui_prodest}</p>
        <h3 className="font-semibold mt-5">Meccanismo psicologico</h3>
        <p className="prose-brief text-base mt-1">{dn.meccanismo_psicologico}</p>
        {dn.finestra_overton && (
          <>
            <h3 className="font-semibold mt-5">Finestra di Overton</h3>
            <p className="prose-brief text-base mt-1">{dn.finestra_overton}</p>
          </>
        )}
        <h3 className="font-semibold mt-5">Evidenze a supporto</h3>
        {dn.evidenze_a_supporto?.length ? (
          <ul className="list-disc pl-5 mt-1 prose-brief text-base">
            {dn.evidenze_a_supporto.map((e: string, i: number) => <li key={i}>{e}</li>)}
          </ul>
        ) : (
          <p className="text-buoy mt-1">Nessuna evidenza nei dati: la lettura alternativa resta un&apos;ipotesi.</p>
        )}
        <div className="mt-5 bg-paper-2 px-4 py-3">
          <h3 className="font-semibold">Contro-lettura</h3>
          <p className="prose-brief text-base mt-1">{dn.contro_lettura}</p>
        </div>
      </Section>

      <Section n="🏛️" title="Parallelo storico e cultura">
        <p className="display text-2xl">{ps.precedente}</p>
        <p className="prose-brief mt-2">{ps.analogia}</p>
        <p className="prose-brief mt-3"><b>Dove il parallelo non regge.</b> {ps.dove_non_regge}</p>
        {ps.quadro_teorico && <p className="prose-brief mt-3"><b>Quadro teorico.</b> {ps.quadro_teorico}</p>}
      </Section>

      <Section n="⚠️" title="Red flags e scenari avversi">
        <ul className="list-disc pl-5 prose-brief text-base">
          {rf.rischi?.map((r: string, i: number) => <li key={i}>{r}</li>)}
        </ul>
        <h3 className="font-semibold mt-5 mb-2">La tesi è invalidata se</h3>
        <table className="w-full text-sm border-collapse">
          <tbody>
            {rf.criteri_invalidazione?.map((c: any, i: number) => (
              <tr key={i} className="border-b border-rule align-top">
                <td className="py-2 pr-3">{c.criterio}</td>
                <td className="py-2 pr-3 text-muted">{c.metrica}</td>
                <td className="py-2 font-semibold">{c.soglia}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      <section className="border-t border-ink pt-6 mt-10">
        <p className="prose-brief text-base"><b>Perché questa confidenza.</b> {p.motivazione_confidenza}</p>
        {p.dati_mancanti?.length > 0 && (
          <p className="prose-brief text-base mt-2"><b>Dati mancanti.</b> {p.dati_mancanti.join("; ")}.</p>
        )}
        <div className="flex flex-wrap gap-3 mt-6 items-center">
          {data.ticker ? (
            <Link href={`/asset/?t=${encodeURIComponent(data.ticker)}`} className="bg-ink text-paper px-5 min-h-12 rounded-full font-semibold inline-flex items-center">
              Apri la scheda di {data.ticker}
            </Link>
          ) : data.theme ? (
            <Link href={`/tema/?s=${data.theme}`} className="bg-ink text-paper px-5 min-h-12 rounded-full font-semibold inline-flex items-center">
              Apri il tema
            </Link>
          ) : null}
        </div>
        <details className="mt-8">
          <summary className="cursor-pointer text-sm">Pacchetto di contesto inviato al modello</summary>
          <pre className="text-xs bg-paper-2 p-4 overflow-auto max-h-[480px] mt-2">{JSON.stringify(data.context, null, 2)}</pre>
        </details>
      </section>
    </article>
  );
}

function Section({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-rule pt-6 mt-8 grid grid-cols-[32px_1fr] md:grid-cols-[48px_1fr] gap-x-3 md:gap-x-4">
      <span className="text-xl md:text-2xl" aria-hidden>{n}</span>
      <div>
        <h2 className="text-sm text-muted mb-3">{title}</h2>
        {children}
      </div>
    </section>
  );
}
