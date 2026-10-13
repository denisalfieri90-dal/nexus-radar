"use client";

import Link from "next/link";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { QUADRANTS, RadarRow, pct } from "@/lib/api";
import { Flags, QuadrantTag } from "./ui";

/** Carta batimetrica del radar.
 *  In alto a sinistra le acque profonde e silenziose (molta sostanza, poca attenzione):
 *  le isobate concentriche ne misurano la distanza. All'apertura un fascio spazza la carta
 *  e accende i punti nell'ordine in cui li incontra. */
export function RadarChart({ rows, labelTop = 12 }: { rows: RadarRow[]; labelTop?: number }) {
  const box = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(0);
  const [selected, setSelected] = useState<RadarRow | null>(null);
  const [animate, setAnimate] = useState(false);

  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.round(e.contentRect.width)));
    ro.observe(el);
    setW(Math.round(el.getBoundingClientRect().width));
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    try {
      if (!sessionStorage.getItem("nexus-swept")) {
        setAnimate(true);
        sessionStorage.setItem("nexus-swept", "1");
      }
    } catch {
      setAnimate(true);
    }
  }, []);

  const mobile = W > 0 && W < 640;
  const H = mobile ? Math.round(W * 1.15) : Math.round(W * 0.66);
  const P = mobile ? { l: 34, r: 10, t: 12, b: 40 } : { l: 52, r: 18, t: 16, b: 46 };

  const geo = useMemo(() => {
    const subs = rows.map((r) => r.substance).sort((a, b) => a - b);
    const subThr = subs.length ? Math.max(55, subs[Math.floor(subs.length * 0.6)]) : 55;
    const yMin = Math.max(0, Math.floor((subs[0] ?? 30) / 5) * 5 - 5);
    const yMax = Math.min(100, Math.ceil((subs[subs.length - 1] ?? 80) / 5) * 5 + 5);
    const sx = (v: number) => P.l + (v / 100) * (W - P.l - P.r);
    const sy = (v: number) => P.t + (1 - (v - yMin) / (yMax - yMin || 1)) * (H - P.t - P.b);
    return { subThr, yMin, yMax, sx, sy };
  }, [rows, W, H, P.l, P.r, P.t, P.b]);

  const labelled = useMemo(
    () => new Set([...rows].sort((a, b) => b.asymmetry - a.asymmetry).slice(0, mobile ? Math.min(8, labelTop) : labelTop).map((r) => r.entity_id)),
    [rows, labelTop, mobile],
  );

  if (!W) return <div ref={box} className="w-full aspect-[3/2]" />;

  const { sx, sy, subThr, yMin, yMax } = geo;
  const fs = mobile ? 11 : 12.5;

  // Etichette senza sovrapposizioni: le più asimmetriche scelgono per prime il lato libero.
  const placed: { x: number; y: number; w: number; h: number }[] = [];
  const labelPos = new Map<string, { x: number; anchor: "start" | "end" }>();
  const dots = rows.map((r) => ({ x: sx(r.heat), y: sy(r.substance) }));
  const hits = (b: { x: number; y: number; w: number; h: number }) =>
    placed.some((p) => b.x < p.x + p.w && b.x + b.w > p.x && b.y < p.y + p.h && b.y + b.h > p.y) ||
    dots.some((d) => d.x > b.x - 3 && d.x < b.x + b.w + 3 && d.y > b.y - 3 && d.y < b.y + b.h + 3);
  [...rows]
    .sort((a, b) => b.asymmetry - a.asymmetry)
    .forEach((r) => {
      if (!labelled.has(r.entity_id)) return;
      const cx = sx(r.heat), cy = sy(r.substance);
      const w = r.entity_id.length * fs * 0.56 + 2, h = fs + 2;
      for (const side of ["start", "end"] as const) {
        const box = { x: side === "start" ? cx + 8 : cx - 8 - w, y: cy - h / 2, w, h };
        if (box.x < P.l || box.x + w > W - P.r) continue;
        if (!hits(box)) {
          placed.push(box);
          labelPos.set(r.entity_id, { x: side === "start" ? cx + 9 : cx - 9, anchor: side });
          return;
        }
      }
    });
  const ox = sx(0), oy = sy(yMax);
  const diag = Math.hypot(W, H);
  const isobaths = [0.12, 0.24, 0.37, 0.51, 0.66, 0.82].map((f) => f * diag);
  const yTicks: number[] = [];
  for (let v = Math.ceil(yMin / 10) * 10; v <= yMax; v += 10) yTicks.push(v);
  const SWEEP = 1.6;
  const beamR = diag;
  const wedge = `M${ox},${oy} L${ox + beamR},${oy} A${beamR},${beamR} 0 0 0 ${ox + beamR * Math.cos((-22 * Math.PI) / 180)},${oy + beamR * Math.sin((-22 * Math.PI) / 180)} Z`;
  return (
    <div ref={box} className="relative">
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="block select-none" role="group" aria-label="Mappa degli asset: sostanza in verticale, attenzione mediatica in orizzontale">
        <defs>
          <clipPath id="plot">
            <rect x={P.l} y={P.t} width={W - P.l - P.r} height={H - P.t - P.b} rx="3" />
          </clipPath>
          <radialGradient id="deep" cx={ox} cy={oy} r={diag * 0.75} gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="var(--seaglass)" stopOpacity="0.16" />
            <stop offset="0.45" stopColor="var(--seaglass)" stopOpacity="0.04" />
            <stop offset="1" stopColor="var(--seaglass)" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="beamFill" gradientUnits="userSpaceOnUse" x1={ox} y1={oy} x2={ox + beamR * 0.4} y2={oy}>
            <stop offset="0" stopColor="var(--seaglass)" stopOpacity="0.45" />
            <stop offset="1" stopColor="var(--seaglass)" stopOpacity="0.05" />
          </linearGradient>
        </defs>

        <rect x={P.l} y={P.t} width={W - P.l - P.r} height={H - P.t - P.b} fill="var(--paper-2)" rx="3" />
        <g clipPath="url(#plot)">
          <rect x={P.l} y={P.t} width={W - P.l - P.r} height={H - P.t - P.b} fill="url(#deep)" />
          {isobaths.map((r, i) => (
            <circle key={i} cx={ox} cy={oy} r={r} fill="none" stroke="var(--contour)" strokeWidth={i === 0 ? 1.6 : 1} strokeDasharray={i % 2 ? "3 5" : undefined} />
          ))}
          <line x1={sx(55)} x2={sx(55)} y1={P.t} y2={H - P.b} stroke="var(--muted)" strokeOpacity="0.45" />
          <line x1={P.l} x2={W - P.r} y1={sy(subThr)} y2={sy(subThr)} stroke="var(--muted)" strokeOpacity="0.45" />
          {animate && <path d={wedge} fill="url(#beamFill)" className="beam" style={{ transformOrigin: `${ox}px ${oy}px` }} />}
        </g>

        <g fontFamily="var(--font-serif)" fontStyle="italic" fontSize={mobile ? 14 : 17} fill="var(--muted)">
          <text x={P.l + 10} y={P.t + (mobile ? 20 : 26)}>Stealth</text>
          <text x={W - P.r - 10} y={P.t + (mobile ? 20 : 26)} textAnchor="end">Consenso</text>
          <text x={P.l + 10} y={H - P.b - 10}>Dormiente</text>
          <text x={W - P.r - 10} y={H - P.b - 10} textAnchor="end">Hype</text>
        </g>

        {yTicks.map((t) => (
          <text key={t} x={P.l - 7} y={sy(t) + 4} fontSize={fs - 0.5} fill="var(--muted)" textAnchor="end">
            {t}
          </text>
        ))}
        {[0, 25, 50, 75, 100].map((t) => (
          <text key={t} x={sx(t)} y={H - P.b + 17} fontSize={fs - 0.5} fill="var(--muted)" textAnchor={t === 0 ? "start" : t === 100 ? "end" : "middle"}>
            {t}
          </text>
        ))}
        <text x={(W + P.l) / 2} y={H - 6} fontSize={fs + 0.5} fill="var(--ink)" textAnchor="middle">
          Attenzione mediatica →
        </text>
        <text transform={`translate(${mobile ? 11 : 14} ${(H - P.b + P.t) / 2}) rotate(-90)`} fontSize={fs + 0.5} fill="var(--ink)" textAnchor="middle">
          Sostanza →
        </text>

        {rows.map((r) => {
          const cx = sx(r.heat), cy = sy(r.substance);
          const meta = QUADRANTS[r.quadrant];
          const on = selected?.entity_id === r.entity_id;
          const angle = (Math.atan2(cy - oy, cx - ox) * 180) / Math.PI; // 0 = destra, 90 = giù
          const delay = animate ? (SWEEP * Math.max(0, angle + 12)) / 108 : 0;
          const anim = animate ? { animationDelay: `${delay.toFixed(2)}s` } : { opacity: 1, animation: "none" };
          return (
            <g key={r.entity_id}>
              {animate && r.quadrant === "stealth" && (
                <circle cx={cx} cy={cy} r={6} fill="none" stroke={meta.color} strokeWidth="1.5" className="blip-ring" style={{ animationDelay: `${(delay + 0.2).toFixed(2)}s` }} />
              )}
              <circle
                role="button"
                tabIndex={0}
                aria-label={`${r.name}, ${meta.label}: sostanza ${Math.round(r.substance)}, attenzione ${Math.round(r.heat)}, asimmetria ${Math.round(r.asymmetry)}`}
                aria-pressed={on}
                cx={cx}
                cy={cy}
                r={on ? 8.5 : mobile ? 6 : 5.5}
                fill={meta.color}
                stroke={on ? "var(--ink)" : "var(--paper)"}
                strokeWidth={on ? 2 : 1.5}
                opacity={r.data_quality < 0.4 ? 0.45 : 1}
                className="blip cursor-pointer outline-none"
                style={anim}
                onMouseEnter={() => !mobile && setSelected(r)}
                onFocus={() => setSelected(r)}
                onClick={() => setSelected(on && mobile ? null : r)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    window.location.href = `/asset/?t=${encodeURIComponent(r.entity_id)}`;
                  }
                }}
              />
              {/* area di tocco più ampia sul telefono */}
              {mobile && <circle cx={cx} cy={cy} r={16} fill="transparent" onClick={() => setSelected(on ? null : r)} aria-hidden />}
              {(labelPos.has(r.entity_id) || on) && (
                <text
                  x={labelPos.get(r.entity_id)?.x ?? cx + 9}
                  textAnchor={labelPos.get(r.entity_id)?.anchor ?? "start"}
                  y={cy + 4}
                  fontSize={fs}
                  fontWeight={on ? 760 : 600}
                  fill="var(--ink)"
                  className="blip condensed pointer-events-none"
                  style={anim}
                  paintOrder="stroke"
                  stroke="var(--paper-2)"
                  strokeWidth="3"
                >
                  {r.entity_id}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      <div aria-live="polite" className={mobile ? "mt-3" : "absolute right-4 top-14 w-64"}>
        {selected ? (
          <div className="bg-paper border border-ink px-4 py-3 shadow-[4px_4px_0_var(--contour)] rise">
            <div className="flex items-baseline justify-between gap-3">
              <p className="display text-[1.7rem]">{selected.entity_id}</p>
              <QuadrantTag q={selected.quadrant} />
            </div>
            <p className="text-sm">{selected.name}</p>
            <p className="text-sm text-muted">{selected.theme_name}</p>
            <dl className="grid grid-cols-3 gap-2 mt-2 text-sm">
              <div>
                <dt className="text-muted text-xs">Asimmetria</dt>
                <dd className="font-semibold">{Math.round(selected.asymmetry)}</dd>
              </div>
              <div>
                <dt className="text-muted text-xs">Sostanza</dt>
                <dd className="font-semibold">{Math.round(selected.substance)}</dd>
              </div>
              <div>
                <dt className="text-muted text-xs">3 mesi</dt>
                <dd className="font-semibold">{pct(selected.ret_3m)}</dd>
              </div>
            </dl>
            <div className="mt-2">
              <Flags flags={selected.flags} />
            </div>
            <Link href={`/asset/?t=${encodeURIComponent(selected.entity_id)}`} className="inline-flex items-center min-h-11 mt-1 font-semibold underline">
              Apri la scheda di {selected.entity_id}
            </Link>
          </div>
        ) : mobile ? (
          <p className="text-sm text-muted">Tocca un punto per vedere i dettagli.</p>
        ) : null}
      </div>
    </div>
  );
}
