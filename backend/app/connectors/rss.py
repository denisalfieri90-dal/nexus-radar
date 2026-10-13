"""Feed RSS: notizie da fonti ufficiali e specializzate (lista in feeds.yaml)."""
from datetime import datetime
from pathlib import Path
from time import mktime
from urllib.parse import urlparse

import feedparser
import yaml
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import NewsItem
from .base import client, record_run

FEEDS_FILE = Path(__file__).with_name("feeds.yaml")


def load_feeds() -> list[dict]:
    return yaml.safe_load(FEEDS_FILE.read_text())["feeds"]


def run(db: Session) -> None:
    for feed in load_feeds():
        name = f"rss:{feed['name']}"
        try:
            with client() as c:
                r = c.get(feed["url"])
                r.raise_for_status()
            parsed = feedparser.parse(r.content)
            n = 0
            for e in parsed.entries[:40]:
                url = e.get("link")
                if not url or db.scalar(select(NewsItem.id).where(NewsItem.url == url)):
                    continue
                ts = e.get("published_parsed") or e.get("updated_parsed")
                db.add(NewsItem(
                    source=name, channel=feed.get("channel", ""), title=(e.get("title") or "")[:1000],
                    url=url[:1024], domain=urlparse(url).netloc,
                    published_at=datetime.fromtimestamp(mktime(ts)) if ts else datetime.utcnow(),
                ))
                n += 1
            db.commit()
            record_run(db, name, ok=True, items=n)
        except Exception as e:
            db.rollback()
            record_run(db, name, ok=False, message=str(e))
