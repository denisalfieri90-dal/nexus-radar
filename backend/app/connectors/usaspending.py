"""USAspending.gov — contratti federali USA per parola chiave (gratuito, senza chiave).

Nota: i contratti della Difesa vengono pubblicati con un ritardo fino a 90 giorni.
Misuriamo il flusso di spesa per tema: ultimi 90 giorni vs i 270 precedenti (normalizzato).
"""
from datetime import date, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import Contract
from ..themes import THEMES
from .base import client, record_run, upsert_metric

API = "https://api.usaspending.gov/api/v2/search/spending_by_award/"
FIELDS = ["Award ID", "Recipient Name", "Award Amount", "Awarding Agency", "Start Date", "Description"]


def _search(c, keywords: list[str], start: date, end: date, limit: int = 100) -> list[dict]:
    body = {
        "filters": {
            "keywords": keywords,
            "award_type_codes": ["A", "B", "C", "D"],
            "time_period": [{"start_date": start.isoformat(), "end_date": end.isoformat()}],
        },
        "fields": FIELDS, "limit": limit, "page": 1, "sort": "Award Amount", "order": "desc",
    }
    r = c.post(API, json=body)
    r.raise_for_status()
    return r.json().get("results", [])


def run(db: Session) -> None:
    today = date.today()
    errors, n = [], 0
    with client(timeout=60) as c:
        for t in THEMES:
            if not t.contract_keywords:
                continue
            try:
                recent = _search(c, list(t.contract_keywords), today - timedelta(days=90), today)
                prior = _search(c, list(t.contract_keywords), today - timedelta(days=360), today - timedelta(days=91))
                rec_sum = sum(float(x.get("Award Amount") or 0) for x in recent)
                prior_q = sum(float(x.get("Award Amount") or 0) for x in prior) / 3.0  # media trimestrale
                upsert_metric(db, f"contracts:{t.slug}:90d", today, rec_sum, "usaspending")
                upsert_metric(db, f"contracts:{t.slug}:prior_q", today, prior_q, "usaspending")
                for x in recent[:30]:
                    aid = str(x.get("Award ID") or x.get("generated_internal_id") or "")
                    if not aid or db.scalar(select(Contract.id).where(Contract.award_id == aid)):
                        continue
                    sd = x.get("Start Date")
                    db.add(Contract(
                        award_id=aid, theme=t.slug, recipient=x.get("Recipient Name") or "",
                        agency=x.get("Awarding Agency") or "", amount=float(x.get("Award Amount") or 0),
                        start_date=date.fromisoformat(sd) if sd else None,
                        description=(x.get("Description") or "")[:2000],
                    ))
                    n += 1
                db.commit()
            except Exception as e:
                db.rollback()
                errors.append(f"{t.slug}: {e}")
    record_run(db, "usaspending", ok=len(errors) == 0, items=n, message="; ".join(errors))
