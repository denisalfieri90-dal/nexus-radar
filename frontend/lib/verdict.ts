/** Verdetto in parole semplici per ogni asset, ricavato dai punteggi del radar.
 *  Non è un consiglio di acquisto: dice quanto un titolo è interessante da studiare oggi. */
import type { Quadrant } from "./api";

export type VerdictKey = "appetibile" | "interessante" | "scontato" | "evitare" | "fermo" | "incerto";

export type VerdictMeta = {
  key: VerdictKey;
  label: string;
  short: string;
  color: string;
  text: string;
  soft: string;
  rank: number;
  meaning: string;
  plural: string;
};

export const VERDICTS: Record<VerdictKey, VerdictMeta> = {
  appetibile: {
    key: "appetibile",
    plural: "appetibili",
    label: "Appetibile",
    short: "Da studiare subito",
    color: "var(--seaglass)",
    text: "var(--seaglass-text)",
    soft: "var(--seaglass-soft)",
    rank: 0,
    meaning: "Fatti solidi e pochi occhi addosso: il tipo di asimmetria che il radar cerca.",
  },
  interessante: {
    key: "interessante",
    plural: "interessanti",
    label: "Interessante",
    short: "Da tenere d'occhio",
    color: "var(--depth)",
    text: "var(--depth-text)",
    soft: "color-mix(in srgb, var(--depth) 16%, transparent)",
    rank: 1,
    meaning: "Segnali positivi ma meno netti: vale la pena seguirlo.",
  },
  scontato: {
    key: "scontato",
    plural: "già nel prezzo",
    label: "Già nel prezzo",
    short: "Buono ma noto",
    color: "var(--sand)",
    text: "var(--sand-text)",
    soft: "color-mix(in srgb, var(--sand) 18%, transparent)",
    rank: 2,
    meaning: "I fondamentali ci sono, ma ne parlano tutti: l'asimmetria è in gran parte sparita.",
  },
  fermo: {
    key: "fermo",
    plural: "fermi",
    label: "Fermo",
    short: "Niente da segnalare",
    color: "var(--muted)",
    text: "var(--muted-text)",
    soft: "color-mix(in srgb, var(--muted) 14%, transparent)",
    rank: 3,
    meaning: "Né sostanza né attenzione: per ora non c'è una storia.",
  },
  evitare: {
    key: "evitare",
    plural: "da evitare",
    label: "Da evitare",
    short: "Rumore senza sostanza",
    color: "var(--buoy)",
    text: "var(--buoy-text)",
    soft: "var(--buoy-soft)",
    rank: 4,
    meaning: "Molta attenzione e dati deboli: il terreno delle trappole per i piccoli investitori.",
  },
  incerto: {
    key: "incerto",
    plural: "con dati scarsi",
    label: "Dati scarsi",
    short: "Giudizio sospeso",
    color: "var(--muted)",
    text: "var(--muted-text)",
    soft: "color-mix(in srgb, var(--muted) 14%, transparent)",
    rank: 5,
    meaning: "Mancano troppe fonti per dare un giudizio affidabile.",
  },
};

export type VerdictInput = {
  quadrant: Quadrant;
  asymmetry: number;
  substance: number;
  heat: number;
  adoption: number;
  accumulation: number;
  catalyst: number;
  flags: string[];
  data_quality: number;
  ret_3m?: number | null;
  ret_1m?: number | null;
};

export type Verdict = VerdictMeta & { reasons: { text: string; good: boolean }[] };

const pctTxt = (x: number) => `${x >= 0 ? "+" : "−"}${Math.abs(Math.round(x * 100))}%`;

export function verdictOf(r: VerdictInput): Verdict {
  // Soglie tarate sui dati reali: il verdetto deve separare davvero, non etichettare tutto.
  let key: VerdictKey;
  if (r.data_quality < 0.25) key = "incerto";
  else if (r.flags.includes("trappola_retail") || (r.heat >= 65 && r.substance < 52)) key = "evitare";
  else if (r.asymmetry >= 60 && r.substance >= 56 && r.heat < 55) key = "appetibile";
  else if (r.asymmetry >= 55 && r.substance >= 50 && r.heat < 60) key = "interessante";
  else if (r.substance >= 55 && r.heat >= 55) key = "scontato";
  else key = "fermo";

  const reasons: { text: string; good: boolean; w: number }[] = [];
  const add = (text: string, good: boolean, w: number) => reasons.push({ text, good, w });

  if (r.flags.includes("accumulo_silenzioso")) add("Volumi in aumento a prezzo fermo: qualcuno accumula", true, 9);
  if (r.flags.includes("tipping_point")) add("L'interesse per il tema accelera prima del picco", true, 8);
  if (r.flags.includes("insider_anomalo")) add("Attività anomala degli insider: da verificare", true, 5);
  if (r.flags.includes("trappola_retail")) add("Salita parabolica con poca sostanza", false, 10);
  if (r.catalyst >= 62) add("Contratti pubblici o eventi in accelerazione", true, 7);
  if (r.adoption >= 62) add("Adozione del tema in crescita", true, 6);
  if (r.accumulation >= 66 && !r.flags.includes("accumulo_silenzioso")) add("Segnali di accumulo sul titolo", true, 6);
  if (r.heat < 40) add("Pochi media ne parlano", true, 7);
  if (r.heat >= 68) add("Già sotto i riflettori dei media", false, 7);
  if (r.ret_3m != null && r.ret_3m > 0.5) add(`Già salito molto: ${pctTxt(r.ret_3m)} in 3 mesi`, false, 8);
  if (r.ret_3m != null && r.ret_3m < -0.3) add(`In forte calo: ${pctTxt(r.ret_3m)} in 3 mesi`, false, 5);
  if (r.substance < 45) add("Fondamentali misurati deboli", false, 6);
  if (r.data_quality < 0.5) add("Alcune fonti non hanno dati", false, 3);

  // prima i motivi coerenti con il verdetto, poi gli altri
  const positive = key === "appetibile" || key === "interessante";
  reasons.sort((a, b) => Number(b.good === positive) - Number(a.good === positive) || b.w - a.w);
  return { ...VERDICTS[key], reasons: reasons.slice(0, 3).map(({ text, good }) => ({ text, good })) };
}

export const VERDICT_ORDER: VerdictKey[] = ["appetibile", "interessante", "scontato", "fermo", "evitare", "incerto"];
