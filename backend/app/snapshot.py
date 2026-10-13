"""Sincronizza il database SQLite locale con lo snapshot pubblicato dalla pipeline
(GitHub Actions → branch `data`). Usato dal servizio briefing su Render free, che non ha
disco persistente: a ogni avvio, e quando lo snapshot è vecchio, lo riscarica."""
import logging
import os
import time
from pathlib import Path

import httpx

from .config import get_settings

log = logging.getLogger("nexus.snapshot")
_last = 0.0


def _db_path() -> Path:
    url = get_settings().database_url
    if not url.startswith("sqlite:///"):
        raise RuntimeError("Lo snapshot funziona solo con DATABASE_URL SQLite")
    return Path(url.replace("sqlite:///", "", 1))


def refresh(force: bool = False) -> bool:
    global _last
    s = get_settings()
    if not force and time.time() - _last < s.snapshot_max_age_minutes * 60:
        return False
    path = _db_path()
    tmp = path.with_suffix(".download")
    try:
        with httpx.stream("GET", s.db_snapshot_url, timeout=60, follow_redirects=True) as r:
            r.raise_for_status()
            with open(tmp, "wb") as f:
                for chunk in r.iter_bytes():
                    f.write(chunk)
        from .db import engine

        engine.dispose()  # chiude le connessioni al vecchio file prima di sostituirlo
        os.replace(tmp, path)
        _last = time.time()
        log.info("snapshot aggiornato (%d KB)", path.stat().st_size // 1024)
        return True
    except Exception as e:
        log.warning("snapshot non scaricato: %s", e)
        return False
