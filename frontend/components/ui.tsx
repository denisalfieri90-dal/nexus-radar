"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { Evidence, FLAGS, Point, QUADRANTS, Quadrant } from "@/lib/api";

export function Loading({ what = "dati" }: { what?: string }) {
  return (
    <div className="py-16 flex items-center gap-3 text-muted" role="status">
      <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden>
        <circle cx="12" cy="12" r="10" fill="none" stroke="var(--contour)" strokeWidth="2" />
        <path d="M12 2a10 10 0 0 1 10 10" fill="none" stroke="var(--seaglass)" strokeWidth="2.4" strokeLinecap="round" style={{ transformOrigin: "12px 12px", animation: "sweep 0.9s linear infinite" }} />
      </svg>
      Caricamento {what}…
    </div>
  );
}

export function NoData({ children }: { children?: React.ReactNode }) {
  return (
    <div className="my-10 border border-dashed border-rule px-5 py-8 max-w-[60ch]">
      <p className="display text-2xl">La prima raccolta dati non è ancora pubblicata</p>
      <p className="mt-2 text-muted">
        La pipeline gira automaticamente ogni due ore. Appena termina, qui compaiono radar, temi e segnali.
      </p>
      {children}
    </div>
  );
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="border-l-4 border-buoy bg-buoy/10 px-4 py-3 my-6">
      <p>{message}</p>
      {onRetry && (
        <button onClick={onRetry} className="mt-2 underline">
          Riprova
        </button>
      )}
    </div>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <div className="border border-dashed border-rule px-5 py-6 text-muted my-4">{children}</div>;
}

export function QuadrantTag({ q }: { q: Quadrant | string }) {
  const meta = QUADRANTS[q as Quadrant];
  if (!meta) return <span className="text-muted">{q || "n.d."}</span>;
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap" title={meta.meaning}>
      <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: meta.color }} />
      {meta.label}
    </span>
  );
}

export function Flags({ flags }: { flags: string[] }) {
  if (!flags?.length) return null;
  return (
    <ul className="flex flex-wrap gap-1.5">
      {flags.map((f) => (
        <li
          key={f}
          className={`text-[0.78rem] px-2 py-0.5 rounded-full border ${
            f === "trappola_retail" || f === "dati_insufficienti" ? "border-buoy text-buoy" : "border-seaglass text-seaglass"
          }`}
        >
          {FLAGS[f] ?? f}
        </li>
      ))}
    </ul>
  );
}

const AXES: { key: "adoption" | "accumulation" | "catalyst" | "heat"; label: string; hint: string }[] = [
  { key: "adoption", label: "Adozione", hint: "curva ad S: l'interesse accelera prima del picco" },
  { key: "accumulation", label: "Accumulo", hint: "volumi, soglie del 5%, forza relativa" },
  { key: "catalyst", label: "Catalizzatori", hint: "contratti pubblici, eventi societari" },
  { key: "heat", label: "Attenzione", hint: "quanto se ne parla, in assoluto e rispetto al solito" },
];

export function AxisBars({ s }: { s: Record<string, number> }) {
  return (
    <dl className="grid gap-3">
      {AXES.map((a) => {
        const v = s[a.key] ?? 0;
        return (
          <div key={a.key} title={a.hint} className="grid grid-cols-[1fr_auto] gap-y-1 text-sm">
            <dt>{a.label}</dt>
            <dd className="font-semibold text-right">{Math.round(v)}</dd>
            <dd className="col-span-2 h-1.5 bg-paper-2 relative" aria-hidden>
              <span
                className="absolute inset-y-0 left-0 block"
                style={{ width: `${v}%`, background: a.key === "heat" ? "var(--buoy)" : "var(--depth)" }}
              />
              <span className="absolute inset-y-[-3px] left-1/2 w-px bg-muted/60 block" />
            </dd>
          </div>
        );
      })}
    </dl>
  );
}

export function EvidenceTable({ items }: { items: Evidence[] }) {
  if (!items?.length) return <Empty>Nessuna evidenza: le fonti non hanno ancora prodotto dati per questo elemento.</Empty>;
  return (
    <>
      <ul className="md:hidden divide-y divide-rule border-y border-rule">
        {items.map((e, i) => (
          <li key={i} className="py-3">
            <div className="flex items-baseline justify-between gap-3">
              <span>{e.label}</span>
              <span className="text-xs text-muted shrink-0">{e.source}</span>
            </div>
            <p className="font-semibold mt-0.5">{e.value}</p>
            <p className="text-sm text-muted">{e.reading}</p>
          </li>
        ))}
      </ul>
      <table className="hidden md:table w-full text-sm border-collapse">
        <thead>
          <tr className="text-left text-muted border-b border-rule">
            <th className="py-2 pr-3 font-normal">Segnale</th>
            <th className="py-2 pr-3 font-normal">Valore</th>
            <th className="py-2 pr-3 font-normal">Lettura</th>
            <th className="py-2 font-normal">Fonte</th>
          </tr>
        </thead>
        <tbody>
          {items.map((e, i) => (
            <tr key={i} className="border-b border-rule/70 align-top">
              <td className="py-2 pr-3">{e.label}</td>
              <td className="py-2 pr-3 font-semibold whitespace-nowrap">{e.value}</td>
              <td className="py-2 pr-3">{e.reading}</td>
              <td className="py-2 text-muted whitespace-nowrap">{e.source}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

export function Sparkline({ points, color = "var(--depth)", height = 36, width = 160 }: { points: Point[]; color?: string; height?: number; width?: number }) {
  if (!points || points.length < 2) return <svg width={width} height={height} aria-hidden />;
  const vals = points.map((p) => p.value);
  const min = Math.min(...vals), max = Math.max(...vals), span = max - min || 1;
  const d = vals
    .map((v, i) => `${i ? "L" : "M"}${((i / (vals.length - 1)) * width).toFixed(1)},${(height - 2 - ((v - min) / span) * (height - 4)).toFixed(1)}`)
    .join(" ");
  return (
    <svg width="100%" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" style={{ height }} aria-hidden>
      <path d={d} fill="none" stroke={color} strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export function LineChart({ points, height = 220, color = "var(--depth)", label }: { points: Point[]; height?: number; color?: string; label: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.round(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  if (!points || points.length < 2) return <Empty>Serie non ancora disponibile.</Empty>;
  const H = W && W < 500 ? Math.round(height * 0.8) : height;
  const pad = { l: 4, r: 52, t: 10, b: 22 };
  const vals = points.map((p) => p.value);
  const min = Math.min(...vals), max = Math.max(...vals), span = max - min || 1;
  const x = (i: number) => pad.l + (i / (points.length - 1)) * (W - pad.l - pad.r);
  const y = (v: number) => pad.t + (1 - (v - min) / span) * (H - pad.t - pad.b);
  const d = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(" ");
  const area = `${d} L${x(points.length - 1).toFixed(1)},${H - pad.b} L${pad.l},${H - pad.b} Z`;
  const ticks = [min, min + span / 2, max];
  const gid = `g-${label.replace(/\W/g, "")}`;
  return (
    <div ref={ref} className="w-full">
      {W > 0 && (
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="block" role="img" aria-label={label}>
          <defs>
            <linearGradient id={gid} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor={color} stopOpacity="0.22" />
              <stop offset="1" stopColor={color} stopOpacity="0" />
            </linearGradient>
          </defs>
          {ticks.map((t, i) => (
            <g key={i}>
              <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke="var(--rule)" strokeDasharray="2 4" />
              <text x={W - pad.r + 6} y={y(t) + 4} fontSize="12" fill="var(--muted)">
                {t.toLocaleString("it-IT", { maximumFractionDigits: Math.abs(t) > 100 ? 0 : 2 })}
              </text>
            </g>
          ))}
          <path d={area} fill={`url(#${gid})`} />
          <path d={d} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" />
          <circle cx={x(points.length - 1)} cy={y(vals[vals.length - 1])} r="3.5" fill={color} />
          <text x={pad.l} y={H - 4} fontSize="12" fill="var(--muted)">
            {new Date(points[0].day).toLocaleDateString("it-IT", { month: "short", year: "2-digit" })}
          </text>
          <text x={W - pad.r} y={H - 4} fontSize="12" fill="var(--muted)" textAnchor="end">
            {new Date(points[points.length - 1].day).toLocaleDateString("it-IT", { day: "numeric", month: "short" })}
          </text>
        </svg>
      )}
    </div>
  );
}
