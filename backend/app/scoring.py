"""Motore di scoring.

Ogni asset riceve quattro misure 0-100:
  adoption      curva ad S: l'adozione accelera ma il tema non ha ancora raggiunto il picco mediatico
  accumulation  tracce di accumulo: volumi in crescita a prezzo fermo, soglie 5% (13D/G), forza relativa
  catalyst      catalizzatori: flusso di contratti pubblici, eventi societari (8-K)
  heat          temperatura mediatica: attenzione globale (GDELT) + euforia di prezzo

substance = media di adoption, accumulation, catalyst
asymmetry = substance - 0.4 * (heat - 50)   → premia sostanza alta con poca attenzione

Quadranti (attenzione: soglia 55; sostanza: 60° percentile dell'universo, minimo 55):
  stealth    sostanza alta, attenzione bassa   ← la zona che cerchiamo
  consenso   sostanza alta, attenzione alta    ← tesi già nel prezzo
  hype       sostanza bassa, attenzione alta   ← possibile trappola per il retail
  dormiente  sostanza bassa, attenzione bassa

Ogni numero porta con sé un'evidenza (valore, fonte, interpretazione). Nessun punteggio
senza tracciabilità: quando un input manca, data_quality scende e il flag lo dice.
"""
import re
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta
from statistics import mean, pstdev
from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session

from .models import AssetSnapshot, Metric, Score
from .themes import THEMES, Theme

THRESHOLD = 55.0


def clamp(x: float, lo: float = 0.0, hi: float = 100.0) -> float:
    return max(lo, min(hi, x))


def _avg(vals: list[float | None], default: float = 50.0) -> tuple[float, int]:
    v = [x for x in vals if x is not None]
    return (mean(v), len(v)) if v else (default, 0)


@dataclass
class Evidence:
    label: str
    value: str
    source: str
    reading: str

    def as_dict(self) -> dict:
        # formato numerico italiano: 1,475.5 → 1.475,5 (solo tra cifre)
        value = re.sub(r"(?<=\d)[.,](?=\d)", lambda m: "," if m.group() == "." else ".", self.value)
        return {**self.__dict__, "value": value}


def quadrant_of(substance: float, heat: float, sub_thr: float = THRESHOLD, heat_thr: float = THRESHOLD) -> str:
    if substance >= sub_thr:
        return "stealth" if heat < heat_thr else "consenso"
    return "hype" if heat >= heat_thr else "dormiente"


# ------------------------------------------------------------------ accesso dati
def series(db: Session, key: str, days: int) -> list[tuple[date, float]]:
    since = date.today() - timedelta(days=days)
    rows = db.execute(select(Metric.day, Metric.value).where(Metric.key == key, Metric.day >= since).order_by(Metric.day))
    return [(d, v) for d, v in rows]


def attention_series(db: Session, channel: str, days: int = 95) -> tuple[list[tuple[date, float]], str]:
    """Serie di attenzione mediatica: GDELT se ha una storia sufficiente, altrimenti il conteggio
    di articoli da Google/Bing News accumulato giro dopo giro."""
    g = series(db, f"attention:{channel}", days)
    if len(g) >= 30:
        return g, "GDELT"
    n = series(db, f"news:{channel}", days)
    if n:
        return n, "Google/Bing News"
    return g, "GDELT"


def latest(db: Session, key: str) -> float | None:
    return db.scalar(select(Metric.value).where(Metric.key == key).order_by(Metric.day.desc()).limit(1))


# ------------------------------------------------------------------ tema
@dataclass
class ThemeFeatures:
    attention_z: float | None = None  # ultimi 7 giorni vs baseline 8-90 giorni
    attention_level: float | None = None  # quota media ultimi 14 giorni (per 100k articoli)
    attention_pct: float | None = None  # percentile del livello tra tutti i temi (0-1)
    attention_accel: float | None = None  # media ultimi 30 / media 30 precedenti
    github_growth: float | None = None  # nuovi repo 30g / 30g precedenti
    contracts_ratio: float | None = None  # spesa 90g / media trimestrale precedente
    contracts_90d: float | None = None
    tone_delta: float | None = None  # variazione del tono medio (ultimi 14g vs precedenti)
    attention_source: str = "GDELT"


def theme_features(db: Session, t: Theme) -> ThemeFeatures:
    f = ThemeFeatures()
    pts, f.attention_source = attention_series(db, t.slug)
    att = [v for _, v in pts]
    if att:
        f.attention_level = mean(att[-14:])
    if len(att) >= 14:
        recent, base = att[-7:], att[:-7]
        sd = pstdev(base) or max(mean(base) * 0.25, 1e-9)
        f.attention_z = (mean(recent) - mean(base)) / sd
        if len(att) >= 60:
            last, prev = att[-30:], att[-60:-30]
        else:
            last, prev = att[-7:], att[-14:-7]
        if prev and mean(prev) > 0:
            f.attention_accel = mean(last) / mean(prev)
    tone = [v for _, v in series(db, f"tone:{t.slug}", 95)]
    if len(tone) >= 28:
        f.tone_delta = mean(tone[-14:]) - mean(tone[:-14])
    g_cur, g_prev = latest(db, f"github:{t.slug}:30d"), latest(db, f"github:{t.slug}:prev30d")
    if g_cur is not None and g_prev:
        f.github_growth = g_cur / g_prev
    c90, cq = latest(db, f"contracts:{t.slug}:90d"), latest(db, f"contracts:{t.slug}:prior_q")
    if c90 is not None:
        f.contracts_90d = c90
        if cq:
            f.contracts_ratio = c90 / cq
    return f


def theme_scores(f: ThemeFeatures) -> dict:
    """Funzione pura: dalle feature del tema ad adoption / catalyst / heat + evidenze."""
    ev: list[Evidence] = []
    adoption_parts: list[float | None] = []
    if f.attention_accel is not None:
        adoption_parts.append(clamp(50 + 60 * (f.attention_accel - 1)))
        ev.append(Evidence("Accelerazione dell'attenzione", f"{f.attention_accel:.2f}x (30g vs 30g prec.)", f.attention_source,
                           "in crescita" if f.attention_accel > 1.1 else "stabile o in calo"))
    else:
        adoption_parts.append(None)
    if f.github_growth is not None:
        adoption_parts.append(clamp(50 + 50 * (f.github_growth - 1)))
        ev.append(Evidence("Nuovi repository GitHub", f"{f.github_growth:.2f}x (30g vs 30g prec.)", "GitHub",
                           "sviluppatori in arrivo: adozione precoce" if f.github_growth > 1.15 else "nessuna accelerazione"))
    adoption, n_ad = _avg(adoption_parts)
    early = f.attention_accel is not None and f.attention_accel > 1.2 and (f.attention_z is None or f.attention_z < 1.5)
    if early:
        adoption = clamp(adoption + 12)
        ev.append(Evidence("Fase della curva ad S", "salita senza picco", "calcolo",
                           "l'interesse accelera ma non è ancora esploso: possibile punto di flesso"))

    catalyst_parts: list[float | None] = []
    if f.contracts_ratio is not None:
        catalyst_parts.append(clamp(50 + 35 * (f.contracts_ratio - 1)))
        ev.append(Evidence("Contratti pubblici USA", f"${(f.contracts_90d or 0) / 1e6:,.0f} mln in 90g ({f.contracts_ratio:.2f}x)",
                           "USAspending", "spesa pubblica in accelerazione" if f.contracts_ratio > 1.2 else "flusso nella norma"))

    # Temperatura = quanto se ne parla in assoluto (percentile tra i temi) + quanto è anomalo
    # rispetto alla propria storia (z-score). Un tema di nicchia in crescita resta 'freddo'.
    heat_parts: list[float | None] = []
    if f.attention_pct is not None:
        heat_parts.append(100 * f.attention_pct)
        ev.append(Evidence("Volume di copertura (vs altri temi)", f"{f.attention_pct * 100:.0f}° percentile", f.attention_source,
                           "tema già mainstream" if f.attention_pct > 0.7 else "tema di nicchia" if f.attention_pct < 0.35 else "copertura intermedia"))
    if f.attention_z is not None:
        heat_parts.append(clamp(50 + 12 * max(-4.0, min(4.0, f.attention_z))))
        ev.append(Evidence("Anomalia di copertura (7g vs storia)", f"z = {f.attention_z:+.2f}", f.attention_source,
                           "picco mediatico in corso" if f.attention_z > 2 else "copertura sotto la norma" if f.attention_z < -0.5 else "nessun picco"))
    heat, _ = _avg(heat_parts)
    if f.tone_delta is not None:
        ev.append(Evidence("Variazione del tono", f"{f.tone_delta:+.2f}", "GDELT",
                           "narrativa più allarmata" if f.tone_delta < -0.5 else "narrativa più ottimista" if f.tone_delta > 0.5 else "tono stabile"))
    inputs = [f.attention_z, f.attention_accel, f.github_growth, f.contracts_ratio]
    return {
        "adoption": adoption, "adoption_n": n_ad, "catalyst_parts": catalyst_parts, "heat": heat,
        "early_inflection": early, "evidence": ev,
        "quality": sum(x is not None for x in inputs) / len(inputs),
    }


# ------------------------------------------------------------------ asset
@dataclass
class AssetFeatures:
    ret_1m: float | None = None
    ret_3m: float | None = None
    ret_12m: float | None = None
    vol_ratio: float | None = None
    dist_52w_high: float | None = None
    rs_bench_3m: float | None = None
    form4_30d: float | None = None
    form4_base30: float | None = None
    sched13_90d: float | None = None
    k8_30d: float | None = None
    extra: dict = field(default_factory=dict)


def asset_features(db: Session, ticker: str) -> AssetFeatures:
    snap = db.scalar(select(AssetSnapshot).where(AssetSnapshot.ticker == ticker).order_by(AssetSnapshot.day.desc()).limit(1))
    f = AssetFeatures()
    if snap:
        for k in ("ret_1m", "ret_3m", "ret_12m", "vol_ratio", "dist_52w_high", "rs_bench_3m"):
            setattr(f, k, getattr(snap, k))
        f.extra["price"] = snap.price
        f.extra["day"] = snap.day.isoformat()
    f.form4_30d = latest(db, f"edgar:{ticker}:form4_30d")
    f.form4_base30 = latest(db, f"edgar:{ticker}:form4_base30")
    f.sched13_90d = latest(db, f"edgar:{ticker}:sched13_90d")
    f.k8_30d = latest(db, f"edgar:{ticker}:8k_30d")
    return f


def _pct(x: float | None) -> str:
    return "n.d." if x is None else f"{x * 100:+.1f}%"


def score_asset(a: AssetFeatures, th: dict) -> dict:
    """Funzione pura: combina feature dell'asset e del tema."""
    ev: list[Evidence] = []
    flags: list[str] = []

    acc_parts: list[float | None] = []
    if a.vol_ratio is not None:
        acc_parts.append(clamp(50 + 55 * (a.vol_ratio - 1)))
        ev.append(Evidence("Volumi", f"{a.vol_ratio:.2f}x (20g vs 120g)", "Yahoo Finance",
                           "volumi in espansione" if a.vol_ratio > 1.2 else "volumi nella norma o in calo"))
    quiet = a.vol_ratio is not None and a.ret_1m is not None and a.vol_ratio > 1.25 and abs(a.ret_1m) < 0.08
    if quiet:
        acc_parts.append(80.0)
        flags.append("accumulo_silenzioso")
        ev.append(Evidence("Accumulo silenzioso", f"volumi {a.vol_ratio:.2f}x, prezzo {_pct(a.ret_1m)} a 1 mese",
                           "calcolo", "qualcuno compra (o vende) molto senza muovere il prezzo: tipico assorbimento"))
    if a.dist_52w_high is not None:
        # una base costruita 10-45% sotto i massimi è più asimmetrica di un titolo già sui massimi
        base = 70.0 if -0.45 <= a.dist_52w_high <= -0.10 else 45.0 if a.dist_52w_high > -0.10 else 35.0
        acc_parts.append(base)
        ev.append(Evidence("Distanza dai massimi 52 sett.", _pct(a.dist_52w_high), "Yahoo Finance",
                           "in costruzione di base" if base == 70 else "vicino ai massimi" if a.dist_52w_high > -0.10 else "in forte ribasso"))
    if a.rs_bench_3m is not None:
        acc_parts.append(clamp(50 + 100 * a.rs_bench_3m))
        ev.append(Evidence("Forza relativa vs benchmark (3m)", _pct(a.rs_bench_3m), "Yahoo Finance",
                           "sovraperforma" if a.rs_bench_3m > 0 else "sottoperforma"))
    if a.sched13_90d:
        acc_parts.append(clamp(60 + 10 * a.sched13_90d))
        ev.append(Evidence("Schedule 13D/13G (90g)", f"{a.sched13_90d:.0f} depositi", "SEC EDGAR",
                           "investitori sopra la soglia del 5%: chi sono è nel documento"))
    accumulation, n_acc = _avg(acc_parts)

    if a.form4_30d is not None:
        base = max(a.form4_base30 or 0, 1.0)
        spike = a.form4_30d / base
        ev.append(Evidence("Operazioni insider (Form 4, 30g)", f"{a.form4_30d:.0f} vs media {a.form4_base30 or 0:.1f}", "SEC EDGAR",
                           "attività anomala: verificare se acquisti o vendite" if spike >= 2.5 else "attività nella norma"))
        if spike >= 2.5 and a.form4_30d >= 4:
            flags.append("insider_anomalo")

    cat_parts = list(th["catalyst_parts"])
    if a.k8_30d is not None:
        cat_parts.append(clamp(45 + 8 * a.k8_30d))
        ev.append(Evidence("Eventi societari (8-K, 30g)", f"{a.k8_30d:.0f}", "SEC EDGAR",
                           "flusso di notizie rilevanti" if a.k8_30d >= 3 else "pochi eventi"))
    catalyst, n_cat = _avg(cat_parts)

    price_heat = clamp(50 + 80 * a.ret_3m) if a.ret_3m is not None else None
    heat = th["heat"] if price_heat is None else 0.65 * th["heat"] + 0.35 * price_heat
    if a.ret_3m is not None:
        ev.append(Evidence("Rendimento 3 mesi", _pct(a.ret_3m), "Yahoo Finance",
                           "movimento parabolico" if a.ret_3m > 0.5 else "movimento contenuto"))

    substance = mean([th["adoption"], accumulation, catalyst])
    asymmetry = clamp(substance - 0.4 * (heat - 50))
    quadrant = quadrant_of(substance, heat)

    if heat >= 70 and (a.ret_3m or 0) > 0.6 and (a.vol_ratio or 0) > 1.8 and substance < THRESHOLD:
        flags.append("trappola_retail")
    if th["early_inflection"] and heat < THRESHOLD:
        flags.append("tipping_point")
    quality = (th["quality"] + (n_acc / 4 if n_acc else 0) + (1.0 if n_cat else 0)) / 3
    if quality < 0.4:
        flags.append("dati_insufficienti")

    return {
        "adoption": round(th["adoption"], 1), "accumulation": round(accumulation, 1), "catalyst": round(catalyst, 1),
        "heat": round(heat, 1), "substance": round(substance, 1), "asymmetry": round(asymmetry, 1),
        "quadrant": quadrant, "flags": flags, "data_quality": round(quality, 2),
        "evidence": [e.as_dict() for e in th["evidence"] + ev],
    }


# ------------------------------------------------------------------ esecuzione
def run(db: Session) -> str:
    run_id = datetime.utcnow().strftime("%Y%m%d%H%M%S") + uuid4().hex[:4]
    feats = {t.slug: theme_features(db, t) for t in THEMES}
    # percentile calcolato solo tra temi misurati con la stessa fonte (scale diverse non si confrontano)
    for src in {f.attention_source for f in feats.values()}:
        group = [f for f in feats.values() if f.attention_source == src and f.attention_level is not None]
        levels = sorted(f.attention_level for f in group)
        for f in group:
            if len(levels) > 1:
                f.attention_pct = sum(lv < f.attention_level for lv in levels) / (len(levels) - 1)
    asset_rows: list[tuple[str, str, dict]] = []
    for t in THEMES:
        tf = feats[t.slug]
        th = theme_scores(tf)
        cat, _ = _avg(th["catalyst_parts"])
        sub = mean([th["adoption"], cat])
        db.add(Score(
            run_id=run_id, entity_type="theme", entity_id=t.slug, theme=t.slug,
            adoption=round(th["adoption"], 1), accumulation=50.0, catalyst=round(cat, 1), heat=round(th["heat"], 1),
            substance=round(sub, 1), asymmetry=round(clamp(sub - 0.4 * (th["heat"] - 50)), 1),
            quadrant=quadrant_of(sub, th["heat"]),
            flags=(["tipping_point"] if th["early_inflection"] else []) + (["overton"] if t.overton else []),
            evidence=[e.as_dict() for e in th["evidence"]], data_quality=round(th["quality"], 2),
        ))
        for asset in t.assets:
            asset_rows.append((t.slug, asset.ticker, score_asset(asset_features(db, asset.ticker), th)))
    # Il radar è relativo: la soglia di 'sostanza' è il 60° percentile dell'universo (minimo 55),
    # così anche in fasi di euforia generale solo i migliori finiscono nei quadranti alti.
    subs = sorted(r["substance"] for _, _, r in asset_rows)
    sub_thr = max(THRESHOLD, subs[int(len(subs) * 0.6)]) if subs else THRESHOLD
    for theme_slug, ticker, r in asset_rows:
        r["quadrant"] = quadrant_of(r["substance"], r["heat"], sub_thr)
        db.add(Score(run_id=run_id, entity_type="asset", entity_id=ticker, theme=theme_slug, **r))
    db.commit()
    return run_id


def latest_run_id(db: Session) -> str | None:
    return db.scalar(select(Score.run_id).order_by(Score.computed_at.desc(), Score.id.desc()).limit(1))
