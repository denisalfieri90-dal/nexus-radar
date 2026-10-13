"""Attenzione mediatica di riserva: Google News RSS e Bing News RSS.

GDELT limita spesso gli IP dei server cloud (es. i runner di GitHub Actions). Quando succede,
misuriamo l'attenzione contando gli articoli per giorno restituiti dalle ricerche di Google News
(ultimi 7 giorni, massimo 100 risultati) e, se anche Google non risponde, di Bing News.
Ogni esecuzione aggiorna gli ultimi 7 giorni: la storia si accumula nel database giro dopo giro.
Metrica: `news:<canale>` = numero di articoli pubblicati in quel giorno.
"""
import re
import time
from collections import Counter
from datetime import date, datetime, timedelta
from time import mktime
from urllib.parse import quote_plus, urlparse

import feedparser
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import NewsItem
from ..themes import CHOKEPOINTS, THEMES
from .base import client, record_run, upsert_metric

GOOGLE = "https://news.google.com/rss/search?q={q}&hl=en-US&gl=US&ceid=US:en"
BING = "https://www.bing.com/news/search?q={q}&format=rss&count=100"


def _plain(query: str) -> str:
    """Le query GDELT usano già OR e virgolette: le ripuliamo dai filtri specifici di GDELT."""
    return re.sub(r"\s+", " ", query).strip()


def _fetch(c, url: str):
    r = c.get(url)
    r.raise_for_status()
    return feedparser.parse(r.content)


def daily_counts(entries, today: date, days: int = 7, cap: int = 95) -> dict[date, float]:
    """Funzione pura: articoli per giorno negli ultimi `days` giorni.

    Le ricerche restituiscono al massimo ~100 risultati: se il feed è saturo i giorni più vecchi
    sarebbero falsamente vuoti. In quel caso stimiamo solo il ritmo di oggi (articoli / giorni
    coperti dal feed) e non scriviamo gli altri giorni, per non sovrascrivere dati validi."""
    stamps = []
    for e in entries:
        ts = e.get("published_parsed") or e.get("updated_parsed")
        if ts:
            stamps.append(datetime.fromtimestamp(mktime(ts)))
    if not stamps:
        return {}
    if len(entries) >= cap:
        span_days = max((max(stamps) - min(stamps)).total_seconds() / 86400, 1 / 24)
        return {today: round(len(stamps) / span_days, 1)}
    cnt: Counter = Counter(s.date() for s in stamps)
    return {today - timedelta(days=i): float(cnt.get(today - timedelta(days=i), 0)) for i in range(days)}


def run(db: Session) -> None:
    targets = [(t.slug, t.gdelt_query) for t in THEMES] + [(f"choke:{k}", v["query"]) for k, v in CHOKEPOINTS.items()]
    today = date.today()
    ok, errors, used = 0, [], Counter()
    with client({"Accept-Language": "en-US,en;q=0.8"}, timeout=20) as c:
        for channel, query in targets:
            q = quote_plus(_plain(query) + " when:7d")
            parsed, src = None, ""
            for name, tpl in (("google", GOOGLE), ("bing", BING)):
                try:
                    p = _fetch(c, tpl.format(q=q if name == "google" else quote_plus(_plain(query))))
                    if p.entries:
                        parsed, src = p, name
                        break
                except Exception as e:
                    errors.append(f"{channel}/{name}: {str(e)[:80]}")
            if not parsed:
                continue
            for d, n in daily_counts(parsed.entries, today).items():
                upsert_metric(db, f"news:{channel}", d, float(n), f"newsrss:{src}")
            for e in parsed.entries[:12]:
                url = e.get("link")
                if not url or db.scalar(select(NewsItem.id).where(NewsItem.url == url)):
                    continue
                ts = e.get("published_parsed")
                source = getattr(e, "source", None)
                db.add(NewsItem(
                    source=f"{src}-news", channel=channel, title=(e.get("title") or "")[:1000], url=url[:1024],
                    domain=(source.get("title") if isinstance(source, dict) else None) or urlparse(url).netloc,
                    published_at=datetime.fromtimestamp(mktime(ts)) if ts else datetime.utcnow(),
                ))
            db.commit()
            ok += 1
            used[src] += 1
            time.sleep(1.5)
    record_run(db, "news_rss", ok=ok > 0, items=ok,
               message=f"fonti: {dict(used)}; " + "; ".join(errors[:12]))
