"""GDELT DOC 2.0 — attenzione mediatica globale (65 lingue, aggiornamento ogni 15 minuti).

Usiamo tre modalità:
- timelinevolraw: quota di articoli che citano il tema sul totale monitorato → 'temperatura'
- timelinetone:   tono medio degli articoli (negativo = paura/allarme)
- artlist:        ultimi titoli, per il feed e per il contesto del briefing
Limite d'uso: ~1 richiesta ogni 5 secondi.
Doc: https://blog.gdeltproject.org/gdelt-doc-2-0-api-debuts/
"""
import time
from collections import defaultdict
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import NewsItem
from ..themes import CHOKEPOINTS, THEMES
from .base import client, get_json, record_run, upsert_metric

API = "https://api.gdeltproject.org/api/v2/doc/doc"
PAUSE = 5.5
BUDGET_SECONDS = 15 * 60  # tetto complessivo: GDELT a volte rallenta molto gli IP dei runner


def _parse_ts(s: str) -> datetime:
    return datetime.strptime(s[:15], "%Y%m%dT%H%M%S")


def _timeline(c, query: str, mode: str, timespan: str = "3months") -> dict:
    data = get_json(c, API, {"query": query, "mode": mode, "format": "json", "timespan": timespan}, retries=1, pause=6)
    by_day: dict = defaultdict(list)
    for series in data.get("timeline", []):
        for pt in series.get("data", []):
            d = _parse_ts(pt["date"]).date()
            if mode == "timelinevolraw":
                norm = pt.get("norm") or 0
                # quota per 100.000 articoli monitorati: neutralizza le variazioni del volume totale
                by_day[d].append((pt.get("value", 0) / norm * 1e5) if norm else 0.0)
            else:
                by_day[d].append(float(pt.get("value", 0)))
    return {d: sum(v) / len(v) for d, v in by_day.items() if v}


def _articles(c, query: str, timespan: str = "24h", maxrecords: int = 25) -> list[dict]:
    data = get_json(
        c, API,
        {"query": f"{query} sourcelang:english", "mode": "artlist", "format": "json",
         "timespan": timespan, "maxrecords": maxrecords, "sort": "datedesc"},
        retries=1, pause=6,
    )
    return data.get("articles", []) or []


def _store_articles(db: Session, channel: str, arts: list[dict]) -> int:
    n = 0
    for a in arts:
        url = a.get("url")
        if not url or db.scalar(select(NewsItem.id).where(NewsItem.url == url)):
            continue
        db.add(NewsItem(
            source="gdelt", channel=channel, title=(a.get("title") or "").strip()[:1000], url=url[:1024],
            domain=a.get("domain", ""), country=a.get("sourcecountry", ""),
            published_at=_parse_ts(a["seendate"]) if a.get("seendate") else datetime.utcnow(),
        ))
        n += 1
    return n


def run(db: Session) -> None:
    targets = [(t.slug, t.gdelt_query, t.overton) for t in THEMES] + [
        (f"choke:{k}", v["query"], True) for k, v in CHOKEPOINTS.items()
    ]
    # rotazione: se il tempo finisce, il giro successivo riparte dai temi rimasti indietro
    shift = (datetime.utcnow().hour // 2) % len(targets)
    targets = targets[shift:] + targets[:shift]
    total, errors, done = 0, [], 0
    started = time.monotonic()
    with client(timeout=20) as c:
        for channel, query, with_tone in targets:
            if time.monotonic() - started > BUDGET_SECONDS:
                errors.append(f"tempo esaurito: {len(targets) - done} temi rinviati al prossimo giro")
                break
            done += 1
            try:
                for d, v in _timeline(c, query, "timelinevolraw").items():
                    upsert_metric(db, f"attention:{channel}", d, v, "gdelt")
                time.sleep(PAUSE)
                if with_tone:
                    for d, v in _timeline(c, query, "timelinetone").items():
                        upsert_metric(db, f"tone:{channel}", d, v, "gdelt")
                    time.sleep(PAUSE)
                total += _store_articles(db, channel, _articles(c, query))
                db.commit()
                time.sleep(PAUSE)
            except Exception as e:  # una fonte che fallisce non deve fermare le altre
                db.rollback()
                errors.append(f"{channel}: {e}")
    record_run(db, "gdelt", ok=len(errors) < len(targets), items=total, message="; ".join(errors))
