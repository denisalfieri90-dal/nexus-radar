"use client";

import { useCallback, useEffect, useState } from "react";

/** Dati statici prodotti dalla pipeline (GitHub Actions) e serviti dal sito stesso. */
export const DATA = process.env.NEXT_PUBLIC_DATA_URL ?? "/data";
/** Servizio per i briefing su richiesta (Render free). Vuoto = funzione disattivata. */
export const BRAIN = process.env.NEXT_PUBLIC_BRAIN_URL ?? "";
export const REPO_URL = process.env.NEXT_PUBLIC_REPO_URL ?? "";

export type Evidence = { label: string; value: string; source: string; reading: string };
export type Quadrant = "stealth" | "consenso" | "hype" | "dormiente";

export type Score = {
  entity_type: "asset" | "theme";
  entity_id: string;
  theme: string;
  adoption: number;
  accumulation: number;
  catalyst: number;
  heat: number;
  substance: number;
  asymmetry: number;
  quadrant: Quadrant;
  flags: string[];
  evidence: Evidence[];
  data_quality: number;
  computed_at: string;
};

export type RadarRow = Score & {
  name: string;
  kind: string;
  theme_name: string;
  price: number | null;
  ret_3m: number | null;
  ret_1m?: number | null;
  spark?: number[];
};
export type Point = { day: string; value: number };
export type NewsItem = { id: number; title: string; url: string; source: string; domain: string; channel: string; published_at: string };
export type Health = {
  demo: boolean;
  last_score_at: string | null;
  exported_at?: string;
  llm_configured: boolean;
  model: string;
};

/** Nome file sicuro per un ticker (GC=F → GC_F). Stessa regola in backend/app/export.py. */
export const safeName = (t: string) => t.replace(/[=^/]/g, "_");

export class NotFound extends Error {
  constructor() {
    super("not-found");
  }
}

/* Cache in memoria condivisa tra le pagine: cambiando sezione i dati compaiono subito,
   e vengono aggiornati in background se hanno più di un minuto. */
const cache = new Map<string, { data: unknown; at: number }>();
const inflight = new Map<string, Promise<unknown>>();
const FRESH_MS = 60_000;

export async function getData<T>(file: string, force = false): Promise<T> {
  const hit = cache.get(file);
  if (!force && hit && Date.now() - hit.at < FRESH_MS) return hit.data as T;
  const running = inflight.get(file);
  if (running) return running as Promise<T>;
  const p = fetch(`${DATA}/${file}`, { cache: "no-cache" })
    .then(async (r) => {
      if (r.status === 404) throw new NotFound();
      if (!r.ok) throw new Error(`Errore ${r.status} leggendo ${file}`);
      const d = await r.json();
      cache.set(file, { data: d, at: Date.now() });
      return d;
    })
    .finally(() => inflight.delete(file));
  inflight.set(file, p);
  return p as Promise<T>;
}

/** Scarica in anticipo un file (es. al passaggio del dito su una card): l'apertura sarà istantanea. */
export function prefetchData(file: string) {
  if (!cache.has(file)) getData(file).catch(() => {});
}

export function useData<T>(file: string | null) {
  const cached = file ? (cache.get(file)?.data as T | undefined) : undefined;
  const [data, setData] = useState<T | null>(cached ?? null);
  const [error, setError] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);
  const [loading, setLoading] = useState(!cached);
  const load = useCallback(
    (force = false) => {
      if (!file) return;
      const c = cache.get(file)?.data as T | undefined;
      if (c !== undefined) {
        setData(c);
        setLoading(false);
      } else setLoading(true);
      getData<T>(file, force)
        .then((d) => {
          setData(d);
          setError(null);
          setMissing(false);
        })
        .catch((e) => {
          if (e instanceof NotFound) setMissing(true);
          else if (c === undefined)
            setError(navigator.onLine ? String(e.message ?? e) : "Sei offline e questi dati non sono ancora salvati sul dispositivo.");
        })
        .finally(() => setLoading(false));
    },
    [file],
  );
  useEffect(() => load(), [load]);
  return { data, error, missing, loading, reload: () => load(true) };
}

// ------------------------------------------------------------------ archivio locale (sul dispositivo)
export function readLocal<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function writeLocal(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    window.dispatchEvent(new Event("nexus-storage"));
  } catch {}
}

export function useLocal<T>(key: string, fallback: T): [T, (v: T) => void] {
  const [value, setValue] = useState<T>(fallback);
  useEffect(() => {
    const sync = () => setValue(readLocal(key, fallback));
    sync();
    window.addEventListener("nexus-storage", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("nexus-storage", sync);
      window.removeEventListener("storage", sync);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return [value, (v: T) => writeLocal(key, v)];
}

export const KEYS = {
  accessCode: "nexus-access-code",
  briefings: "nexus-briefings",
  watchlist: "nexus-watchlist",
  theme: "nexus-theme",
};

export type WatchItem = { ticker: string; name: string; day: string; price: number; bench: string; benchPrice: number | null; quadrant: string };

// ------------------------------------------------------------------ briefing su richiesta
/* eslint-disable @typescript-eslint/no-explicit-any */
export type BriefingDoc = { id: number | string; subject: string; ticker: string; theme: string; model: string; created_at: string; payload: any; context: any };

export async function requestBriefing(target: { ticker?: string; theme?: string }, code: string): Promise<BriefingDoc> {
  if (!BRAIN) throw new Error("Il servizio briefing non è configurato in questo sito.");
  const r = await fetch(`${BRAIN}/api/briefings`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Access-Code": code },
    body: JSON.stringify(target),
  });
  if (!r.ok) {
    let detail = `Errore ${r.status}`;
    try {
      detail = (await r.json()).detail ?? detail;
    } catch {}
    if (r.status === 401) throw new AuthError(detail);
    throw new Error(detail);
  }
  const doc = (await r.json()) as BriefingDoc;
  const local = { ...doc, id: `local-${Date.now()}` };
  const all = readLocal<BriefingDoc[]>(KEYS.briefings, []);
  writeLocal(KEYS.briefings, [local, ...all].slice(0, 40));
  return local;
}

export class AuthError extends Error {}

// ------------------------------------------------------------------ formati e significati
export const QUADRANTS: Record<Quadrant, { label: string; color: string; meaning: string }> = {
  stealth: { label: "Stealth", color: "var(--seaglass)", meaning: "sostanza alta, attenzione bassa" },
  consenso: { label: "Consenso", color: "var(--depth)", meaning: "sostanza alta, già sotto i riflettori" },
  hype: { label: "Hype", color: "var(--buoy)", meaning: "molta attenzione, poca sostanza" },
  dormiente: { label: "Dormiente", color: "var(--muted)", meaning: "nessun segnale per ora" },
};

export const FLAGS: Record<string, string> = {
  accumulo_silenzioso: "Accumulo silenzioso",
  insider_anomalo: "Insider anomali",
  tipping_point: "Possibile punto di flesso",
  trappola_retail: "Rischio trappola retail",
  dati_insufficienti: "Dati insufficienti",
  overton: "Finestra di Overton",
};

export const pct = (x: number | null | undefined, digits = 1) =>
  x === null || x === undefined || Number.isNaN(x) ? "n.d." : `${x >= 0 ? "+" : "−"}${Math.abs(x * 100).toFixed(digits).replace(".", ",")}%`;

export const num = (x: number | null | undefined, digits = 0) =>
  x === null || x === undefined ? "n.d." : x.toLocaleString("it-IT", { maximumFractionDigits: digits, minimumFractionDigits: digits });

/** Le date del backend sono UTC senza fuso: le marchiamo come tali. */
export const utc = (iso: string) => new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(iso) ? iso : iso + "Z");

export const when = (iso: string) => {
  const d = utc(iso);
  const h = (Date.now() - d.getTime()) / 36e5;
  if (h < 1) return "meno di un'ora fa";
  if (h < 24) return `${Math.round(h)} ore fa`;
  return d.toLocaleDateString("it-IT", { day: "numeric", month: "short" });
};

export const stamp = (iso: string) => utc(iso).toLocaleString("it-IT", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
