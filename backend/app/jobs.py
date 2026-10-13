"""Orchestrazione dei job di ingestione e calcolo."""
import logging

from .connectors import edgar, fred, gdelt, github, markets, rss, usaspending
from .db import SessionLocal
from . import journal, scoring

log = logging.getLogger("nexus.jobs")


def _wrap(fn):
    def runner():
        db = SessionLocal()
        try:
            return fn(db)
        finally:
            db.close()
    return runner


JOBS = {
    "rss": _wrap(rss.run),
    "gdelt": _wrap(gdelt.run),
    "markets": _wrap(markets.run),
    "edgar": _wrap(edgar.run),
    "contracts": _wrap(usaspending.run),
    "github": _wrap(github.run),
    "fred": _wrap(fred.run),
    "score": _wrap(scoring.run),
    "journal_evaluate": _wrap(journal.evaluate),
    "journal_autolog": _wrap(journal.auto_log),
}

# Gruppi pensati per il cron: le notizie spesso, il resto una o due volte al giorno.
GROUPS = {
    "news": ["rss", "gdelt", "score"],
    "daily": ["markets", "edgar", "contracts", "github", "fred", "score", "journal_evaluate", "journal_autolog"],
    "all": ["rss", "gdelt", "markets", "edgar", "contracts", "github", "fred", "score", "journal_evaluate", "journal_autolog"],
}


def run(name: str) -> dict:
    names = GROUPS.get(name, [name])
    results = {}
    for n in names:
        if n not in JOBS:
            raise KeyError(f"job sconosciuto: {n}")
        log.info("job %s: avvio", n)
        try:
            results[n] = {"ok": True, "result": JOBS[n]()}
        except Exception as e:  # un job che fallisce non blocca gli altri
            log.exception("job %s fallito", n)
            results[n] = {"ok": False, "error": str(e)}
    return results
