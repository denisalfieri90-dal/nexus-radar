"""FRED (Federal Reserve Bank of St. Louis) — cruscotto macro: tassi, curva, dollaro,
spread di credito, volatilità, petrolio, bilancio Fed. Chiave gratuita: FRED_API_KEY."""
from datetime import date, timedelta

from sqlalchemy.orm import Session

from ..config import get_settings
from ..themes import FRED_SERIES
from .base import client, get_json, record_run, upsert_metric

API = "https://api.stlouisfed.org/fred/series/observations"


def run(db: Session) -> None:
    key = get_settings().fred_api_key
    if not key:
        record_run(db, "fred", ok=False, message="FRED_API_KEY mancante")
        return
    start = (date.today() - timedelta(days=400)).isoformat()
    errors, n = [], 0
    with client() as c:
        for sid in FRED_SERIES:
            try:
                data = get_json(c, API, {"series_id": sid, "api_key": key, "file_type": "json", "observation_start": start})
                for o in data.get("observations", []):
                    if o["value"] not in (".", ""):
                        upsert_metric(db, f"fred:{sid}", date.fromisoformat(o["date"]), float(o["value"]), "fred")
                db.commit()
                n += 1
            except Exception as e:
                db.rollback()
                errors.append(f"{sid}: {e}")
    record_run(db, "fred", ok=n > 0, items=n, message="; ".join(errors))
