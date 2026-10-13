"""Utility comuni ai connettori: client HTTP, upsert, registro di salute delle fonti."""
import logging
import time
from datetime import date

import httpx
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import Metric, SourceRun

log = logging.getLogger("nexus.connectors")

DEFAULT_HEADERS = {"User-Agent": "NexusRadar/1.0 (research tool)"}


def client(headers: dict | None = None, timeout: float = 30.0) -> httpx.Client:
    return httpx.Client(headers={**DEFAULT_HEADERS, **(headers or {})}, timeout=timeout, follow_redirects=True)


def get_json(c: httpx.Client, url: str, params: dict | None = None, retries: int = 2, pause: float = 2.0):
    last: Exception | None = None
    for attempt in range(retries + 1):
        try:
            r = c.get(url, params=params)
            if r.status_code == 429:
                time.sleep(pause * (attempt + 2))
                continue
            r.raise_for_status()
            return r.json()
        except (httpx.HTTPError, ValueError) as e:  # ValueError: JSON non valido (GDELT a volte risponde testo)
            last = e
            time.sleep(pause)
    raise RuntimeError(f"GET {url} fallita: {last}")


def upsert_metric(db: Session, key: str, day: date, value: float, source: str) -> None:
    row = db.scalar(select(Metric).where(Metric.key == key, Metric.day == day))
    if row:
        row.value, row.source = value, source
    else:
        db.add(Metric(key=key, day=day, value=value, source=source))


def record_run(db: Session, source: str, ok: bool, items: int = 0, message: str = "") -> None:
    db.add(SourceRun(source=source, ok=ok, items=items, message=message[:2000]))
    db.commit()
    (log.info if ok else log.warning)("%s ok=%s items=%s %s", source, ok, items, message[:200])
