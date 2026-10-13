"""Decoder della narrazione: dati per la lente "psicologia delle masse".

Non giudica chi ha ragione: mette a confronto ciò che si misura.
- Rumore e silenzio: dove l'attenzione dei media si stacca dalla sostanza misurata.
- Due racconti: titoli mainstream e titoli di contro-narrazione sullo stesso tema.
- Finestra di Overton: la traiettoria dell'attenzione sui temi un tempo impensabili.
Le domande proposte sono strumenti di verifica, non conclusioni.
"""
import re
from datetime import datetime, timedelta
from statistics import mean

from sqlalchemy import select
from sqlalchemy.orm import Session

from .models import NewsItem, Score
from .scoring import attention_series, latest_run_id
from .themes import THEMES

# Parole chiave (inglese e italiano) per riconoscere un tema nei titoli delle fonti alternative.
TERMS: dict[str, list[str]] = {
    "semis_chokepoints": ["semiconductor", "chip", "tsmc", "asml", "nvidia", "export control", "semicondutt"],
    "rare_earths": ["rare earth", "terre rare", "gallium", "germanium", "antimony", "critical mineral", "minerali critici"],
    "defense_cyber": ["defense", "defence", "nato", "military", "drone", "cyber", "pentagon", "difesa", "riarmo", "missil"],
    "space": ["space", "satellite", "spazio", "starlink", "rocket"],
    "nuclear": ["nuclear", "uranium", "nucleare", "uranio", "reactor", "reattor"],
    "grid_power": ["grid", "power", "electricity", "blackout", "data center", "rete elettrica", "energia elettrica"],
    "metals": ["copper", "silver", "rame", "argento", "metal"],
    "gold_dedollar": ["gold", " oro", "dollar", "dollaro", "brics", "dedollar", "de-dollar", "treasur", "debt", "debito"],
    "crypto": ["bitcoin", "crypto", "stablecoin", "ethereum", "btc"],
    "quantum": ["quantum", "quantistic"],
    "photonics": ["photonic", "optical", "fotonic", "ai bubble", "bolla ai", "artificial intelligence", "intelligenza artificiale"],
    "synbio": ["biotech", "gene", "crispr", "synthetic bio", "pharma"],
    "food_water": ["food", "wheat", "fertiliz", "drought", "grano", "cibo", "siccit", "fertilizzant", "water", "acqua"],
    "overton_cbdc": ["cbdc", "digital euro", "euro digitale", "central bank digital", "e-cny", "cashless", "contante"],
    "overton_digital_id": ["digital id", "identità digitale", "age verification", "surveillance", "sorveglianza", "eudi"],
    "overton_energy_rationing": ["rationing", "razionament", "austerity", "load shedding", "blackout"],
}

QUESTIONS = {
    "rumore": [
        "Chi guadagna se il pubblico si convince adesso? Emittenti, venditori di prodotti, chi deve vendere posizioni?",
        "I titoli citano numeri verificabili o solo aggettivi e paura/entusiasmo?",
        "La copertura è arrivata prima o dopo il movimento dei prezzi?",
    ],
    "silenzio": [
        "Perché un tema con contratti, volumi e adozione in crescita ha così poca copertura?",
        "Chi ha interesse che resti fuori dai riflettori finché accumula?",
        "Quale evento potrebbe farlo diventare notizia, e quando?",
    ],
    "allineato": [
        "Attenzione e sostanza si muovono insieme: cosa cambierebbe questo equilibrio?",
        "Qual è la narrativa dominante e quale dato la smentirebbe?",
    ],
}

OVERTON_STEPS = ["Impensabile", "Radicale", "Accettabile", "Ragionevole", "Popolare", "Legge"]


def _matches(title: str, terms: list[str]) -> bool:
    t = f" {title.lower()} "
    return any(term in t for term in terms)


def _headlines(db: Session, where, limit: int) -> list[dict]:
    rows = db.scalars(select(NewsItem).where(*where).order_by(NewsItem.published_at.desc()).limit(limit))
    return [{"title": n.title, "url": n.url, "source": n.domain or n.source, "published_at": n.published_at.isoformat()} for n in rows]


def build(db: Session) -> dict:
    rid = latest_run_id(db)
    scores = list(db.scalars(select(Score).where(Score.run_id == rid))) if rid else []
    by_theme_assets: dict[str, list[Score]] = {}
    theme_score: dict[str, Score] = {}
    for s in scores:
        if s.entity_type == "asset":
            by_theme_assets.setdefault(s.theme, []).append(s)
        else:
            theme_score[s.entity_id] = s

    since7 = datetime.utcnow() - timedelta(days=7)
    since21 = datetime.utcnow() - timedelta(days=21)
    contrarian = list(db.scalars(select(NewsItem).where(NewsItem.channel == "contrarian", NewsItem.published_at >= since21)
                                 .order_by(NewsItem.published_at.desc()).limit(400)))

    themes_out, overton_out = [], []
    for t in THEMES:
        ts = theme_score.get(t.slug)
        assets = by_theme_assets.get(t.slug, [])
        heat = ts.heat if ts else None
        substance = mean(a.substance for a in assets) if assets else (ts.substance if ts else None)
        mainstream = _headlines(db, [NewsItem.channel == t.slug, NewsItem.published_at >= since7], 4)
        alt = [{"title": n.title, "url": n.url, "source": n.source.replace("rss:", ""), "published_at": n.published_at.isoformat()}
               for n in contrarian if _matches(n.title, TERMS.get(t.slug, []))][:4]
        pts, src = attention_series(db, t.slug)
        if t.overton:
            vals = [v for _, v in pts]
            trend = None
            if len(vals) >= 6:
                half = len(vals) // 2
                a, b = mean(vals[:half]), mean(vals[half:])
                trend = (b / a - 1) if a else None
            overton_out.append({
                "slug": t.slug, "name": t.name, "hint": t.thesis_hint,
                "trend": trend, "heat": heat, "points": [{"day": d.isoformat(), "value": round(v, 2)} for d, v in pts],
                "source": src, "mainstream": mainstream, "alternative": alt,
            })
            continue
        if heat is None or substance is None:
            bucket = "allineato"
        elif heat >= 58 and substance < 52:
            bucket = "rumore"
        elif substance >= 55 and heat < 45:
            bucket = "silenzio"
        else:
            bucket = "allineato"
        themes_out.append({
            "slug": t.slug, "name": t.name, "heat": heat, "substance": substance,
            "gap": (heat - substance) if heat is not None and substance is not None else None,
            "bucket": bucket, "questions": QUESTIONS[bucket],
            "mainstream": mainstream, "alternative": alt,
        })

    themes_out.sort(key=lambda x: -(abs(x["gap"]) if x["gap"] is not None else 0))
    return {
        "generated_at": datetime.utcnow().isoformat(),
        "themes": themes_out,
        "overton": overton_out,
        "overton_steps": OVERTON_STEPS,
        "alternative_latest": [{"title": n.title, "url": n.url, "source": n.source.replace("rss:", ""),
                                "published_at": n.published_at.isoformat()} for n in contrarian[:20]],
    }


def clean_title(title: str) -> str:
    return re.sub(r"\s+-\s+[^-]+$", "", title)
