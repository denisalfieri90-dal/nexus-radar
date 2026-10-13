"""Esporta lo stato del database come file JSON statici.

Il sito pubblicato è statico (Render Static Site, gratuito e sempre acceso): ogni endpoint
GET dell'API diventa un file in `<out>/`. Il frontend legge questi file invece di chiamare
un server, così funziona anche offline dall'app installata sul telefono.
"""
import json
from datetime import datetime
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.orm import Session

from . import main as api
from .models import Briefing
from .themes import THEMES, all_assets


def safe_name(ticker: str) -> str:
    """Nome file sicuro per un ticker (GC=F → GC_F). Stessa regola in frontend/lib/api.ts."""
    return ticker.replace("=", "_").replace("^", "_").replace("/", "_")


def _dump(path: Path, data) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, default=str, separators=(",", ":")))


def export(db: Session, out: str | Path) -> int:
    out = Path(out)
    n = 0

    def put(rel: str, data) -> None:
        nonlocal n
        _dump(out / rel, data)
        n += 1

    health = api.health(db) | {"exported_at": datetime.utcnow().isoformat(), "static": True}
    put("health.json", health)
    put("radar.json", api.radar(db))
    put("themes.json", api.themes_list(db))
    for t in THEMES:
        put(f"themes/{t.slug}.json", api.theme_detail(t.slug, db))
    for _, a in all_assets():
        put(f"assets/{safe_name(a.ticker)}.json", api.asset_detail(a.ticker, db))
    from .scoring import series

    benches = sorted({t.benchmark for t in THEMES} | {"SPY"})
    put("benchmarks.json", {b: [{"day": d.isoformat(), "value": round(v, 4)} for d, v in series(db, f"px:{b}", 400)] for b in benches})
    put("geo.json", api.geo(db))
    put("macro.json", api.macro(db))
    put("feed.json", api.feed(channel=None, limit=120, db=db))
    put("sources.json", api.sources(db))
    put("journal.json", api.list_journal(db))
    put("journal_stats.json", api.journal_stats(db))
    put("briefings.json", api.list_briefings(db))
    for bid in db.scalars(select(Briefing.id).order_by(Briefing.created_at.desc()).limit(200)):
        put(f"briefings/{bid}.json", api.get_briefing(bid, db))
    return n
