"use client";

import Link from "next/link";
import { RadarRow, pct, prefetchData, safeName } from "@/lib/api";
import { Verdict, verdictOf } from "@/lib/verdict";

export function VerdictBadge({ v, size = "md" }: { v: Verdict | { label: string; color: string; text: string; soft: string }; size?: "sm" | "md" | "lg" }) {
  const cls = size === "lg" ? "text-base px-3.5 py-1.5" : size === "sm" ? "text-[0.72rem] px-2 py-0.5" : "text-sm px-2.5 py-1";
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full font-semibold whitespace-nowrap ${cls}`} style={{ background: v.soft, color: v.text }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: v.color }} aria-hidden />
      {v.label}
    </span>
  );
}

/** Anello del punteggio di asimmetria (0-100). */
export function ScoreRing({ value, color, size = 54 }: { value: number; color: string; size?: number }) {
  const r = size / 2 - 4;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(100, value));
  return (
    <span className="relative inline-grid place-items-center shrink-0" style={{ width: size, height: size }} role="img" aria-label={`Asimmetria ${Math.round(v)} su 100`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--rule)" strokeWidth="4" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={`${(v / 100) * c} ${c}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <span className="absolute display leading-none" style={{ fontSize: size * 0.4 }}>
        {Math.round(v)}
      </span>
    </span>
  );
}

export function MiniSpark({ values, width = 96, height = 30, color }: { values?: number[]; width?: number; height?: number; color?: string }) {
  if (!values || values.length < 2) return <span style={{ width, height }} className="inline-block" aria-hidden />;
  const min = Math.min(...values), max = Math.max(...values), span = max - min || 1;
  const up = values[values.length - 1] >= values[0];
  const stroke = color ?? (up ? "var(--seaglass)" : "var(--buoy)");
  const pts = values.map((v, i) => `${((i / (values.length - 1)) * width).toFixed(1)},${(height - 2 - ((v - min) / span) * (height - 4)).toFixed(1)}`);
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden className="shrink-0">
      <polyline points={pts.join(" ")} fill="none" stroke={stroke} strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

/** Card di un asset con verdetto, punteggio, motivi e andamento. */
export function AssetCard({ r, compact = false }: { r: RadarRow; compact?: boolean }) {
  const v = verdictOf(r);
  const href = `/asset/?t=${encodeURIComponent(r.entity_id)}`;
  const warm = () => prefetchData(`assets/${safeName(r.entity_id)}.json`);
  return (
    <Link
      href={href}
      onPointerEnter={warm}
      onTouchStart={warm}
      onFocus={warm}
      className="group block rounded-2xl border border-rule bg-paper hover:border-ink active:scale-[0.99] transition-[transform,border-color] duration-150 p-4 h-full"
      aria-label={`${r.entity_id}, ${r.name}: ${v.label}, asimmetria ${Math.round(r.asymmetry)}`}
    >
      <div className="flex items-start gap-3">
        <ScoreRing value={r.asymmetry} color={v.color} />
        <div className="min-w-0 flex-1">
          <p className="display text-[1.55rem] leading-none truncate">{r.entity_id}</p>
          <p className="text-sm text-muted truncate mt-1">{r.name}</p>
        </div>
      </div>
      <div className="flex items-center justify-between gap-2 mt-3">
        <VerdictBadge v={v} size="sm" />
        <span className="flex items-center gap-2">
          <MiniSpark values={r.spark} width={64} height={22} />
          <span className={`text-sm font-semibold ${(r.ret_3m ?? 0) >= 0 ? "text-seaglass" : "text-buoy"}`}>{pct(r.ret_3m, 0)}</span>
        </span>
      </div>
      {!compact && (
        <ul className="mt-3 space-y-1 text-[0.85rem] leading-snug">
          {v.reasons.slice(0, 2).map((x) => (
            <li key={x.text} className="flex gap-1.5">
              <span aria-hidden style={{ color: x.good ? "var(--seaglass)" : "var(--buoy)" }}>
                {x.good ? "+" : "−"}
              </span>
              <span>{x.text}</span>
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-muted mt-3 truncate">{r.theme_name}</p>
    </Link>
  );
}

/** Riga compatta per elenchi lunghi. */
export function AssetRow({ r }: { r: RadarRow }) {
  const v = verdictOf(r);
  const warm = () => prefetchData(`assets/${safeName(r.entity_id)}.json`);
  return (
    <Link
      href={`/asset/?t=${encodeURIComponent(r.entity_id)}`}
      onPointerEnter={warm}
      onTouchStart={warm}
      className="flex items-center gap-3 py-3 px-1 hover:bg-paper-2/70 active:bg-paper-2 rounded-lg"
    >
      <ScoreRing value={r.asymmetry} color={v.color} size={42} />
      <span className="flex-1 min-w-0">
        <span className="flex items-baseline gap-2">
          <span className="font-semibold">{r.entity_id}</span>
          <span className="text-sm text-muted truncate">{r.name}</span>
        </span>
        <span className="flex items-center gap-2 mt-1">
          <VerdictBadge v={v} size="sm" />
          <span className="text-xs text-muted truncate hidden sm:inline">{v.reasons[0]?.text}</span>
        </span>
      </span>
      <MiniSpark values={r.spark} width={56} height={22} />
      <span className={`w-14 text-right text-sm font-semibold ${(r.ret_3m ?? 0) >= 0 ? "text-seaglass" : "text-buoy"}`}>{pct(r.ret_3m, 0)}</span>
    </Link>
  );
}
