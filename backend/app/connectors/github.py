"""GitHub — proxy di adozione tecnologica: quanti nuovi repository nascono su un topic
negli ultimi 30 giorni rispetto ai 30 precedenti (la parte bassa della curva ad S)."""
import time
from datetime import date, timedelta

from sqlalchemy.orm import Session

from ..config import get_settings
from ..themes import THEMES
from .base import client, get_json, record_run, upsert_metric

API = "https://api.github.com/search/repositories"


def _count(c, topic: str, start: date, end: date) -> int:
    q = f"topic:{topic} created:{start.isoformat()}..{end.isoformat()}"
    return int(get_json(c, API, {"q": q, "per_page": 1}).get("total_count", 0))


def run(db: Session) -> None:
    token = get_settings().github_token
    headers = {"Accept": "application/vnd.github+json", **({"Authorization": f"Bearer {token}"} if token else {})}
    today = date.today()
    errors, n = [], 0
    with client(headers) as c:
        for t in THEMES:
            if not t.github_topics:
                continue
            try:
                cur = sum(_count(c, tp, today - timedelta(days=30), today) for tp in t.github_topics)
                prev = sum(_count(c, tp, today - timedelta(days=60), today - timedelta(days=31)) for tp in t.github_topics)
                upsert_metric(db, f"github:{t.slug}:30d", today, cur, "github")
                upsert_metric(db, f"github:{t.slug}:prev30d", today, prev, "github")
                db.commit()
                n += 1
                time.sleep(2 if token else 7)  # senza token: 10 ricerche/minuto
            except Exception as e:
                db.rollback()
                errors.append(f"{t.slug}: {e}")
    record_run(db, "github", ok=n > 0, items=n, message="; ".join(errors))
