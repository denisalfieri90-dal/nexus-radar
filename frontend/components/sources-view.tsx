"use client";

import { useData, utc } from "@/lib/api";
import { ErrorBox, Loading, NoData } from "./ui";

type Source = { source: string; ok: boolean; ran_at: string; items: number; message: string; last_ok_at: string | null };

const fmt = (iso: string | null) =>
  iso ? utc(iso).toLocaleString("it-IT", { dateStyle: "short", timeStyle: "short" }) : "mai";

export function SourcesView() {
  const { data, error, loading, missing, reload } = useData<Source[]>("sources.json");
  if (missing) return <NoData />;
  if (error) return <ErrorBox message={error} onRetry={reload} />;
  if (loading || !data) return <Loading what="lo stato delle fonti" />;
  const failing = data.filter((s) => !s.ok).length;
  return (
    <div className="pt-8 md:pt-12">
      <h1 className="display text-[clamp(2.7rem,8vw,4.6rem)]">Stato delle fonti</h1>
      <p className="mt-3 max-w-[64ch]">
        {data.length === 0
          ? "Nessuna fonte ancora interrogata."
          : failing
            ? `${failing} fonti su ${data.length} hanno fallito l'ultimo tentativo. I punteggi che dipendono da loro hanno qualità dati ridotta.`
            : `Tutte le ${data.length} fonti hanno risposto all'ultimo tentativo.`}
      </p>
      {data.length === 0 ? null : (
        <div className="overflow-x-auto mt-6 -mx-4 px-4 md:mx-0 md:px-0">
          <table className="w-full border-collapse min-w-[720px]">
            <thead>
              <tr className="text-left text-muted text-sm border-b border-ink">
                <th className="py-2 pr-4 font-normal">Fonte</th>
                <th className="py-2 pr-4 font-normal">Esito</th>
                <th className="py-2 pr-4 font-normal">Ultimo tentativo</th>
                <th className="py-2 pr-4 font-normal">Ultimo successo</th>
                <th className="py-2 pr-4 font-normal text-right">Elementi</th>
                <th className="py-2 font-normal">Dettaglio</th>
              </tr>
            </thead>
            <tbody>
              {data.map((s) => (
                <tr key={s.source} className="border-b border-rule align-top">
                  <td className="py-2.5 pr-4 font-semibold">{s.source.replace(/^rss:/, "")}</td>
                  <td className="py-2.5 pr-4" style={{ color: s.ok ? "var(--seaglass)" : "var(--buoy)" }}>{s.ok ? "Ok" : "Errore"}</td>
                  <td className="py-2.5 pr-4 whitespace-nowrap">{fmt(s.ran_at)}</td>
                  <td className="py-2.5 pr-4 whitespace-nowrap">{fmt(s.last_ok_at)}</td>
                  <td className="py-2.5 pr-4 text-right">{s.items}</td>
                  <td className="py-2.5 text-sm text-muted max-w-[50ch] break-words">{s.message || ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
