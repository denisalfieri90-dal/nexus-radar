"""Journal dei segnali e track record.

Ogni segnale registrato fissa prezzo e benchmark al momento della registrazione e viene
valutato a 30/90/180/365 giorni sul rendimento in eccesso rispetto al benchmark.
`auto_log` registra ogni settimana i primi 5 'stealth' senza scelta umana: è il campione
non selezionato che dice se il radar funziona davvero (contro il bias del sopravvissuto).
"""
from collections import defaultdict
from datetime import date, datetime, timedelta
from statistics import mean

from sqlalchemy import select
from sqlalchemy.orm import Session

from .config import get_settings
from .models import Briefing, JournalEntry, Metric, Score
from .scoring import latest_run_id
from .themes import theme_of_ticker

CHECKPOINTS = (30, 90, 180, 365)


def price_on(db: Session, ticker: str, day: date) -> float | None:
    """Ultimo prezzo disponibile alla data (o prima)."""
    return db.scalar(select(Metric.value).where(Metric.key == f"px:{ticker}", Metric.day <= day).order_by(Metric.day.desc()).limit(1))


def create_entry(db: Session, ticker: str, briefing_id: int | None = None, auto: bool = False,
                 horizon_months: int | None = None, notes: str = "") -> JournalEntry:
    theme = theme_of_ticker(ticker)
    if not theme:
        raise ValueError(f"{ticker} non è nell'universo monitorato")
    bench = theme.benchmark or get_settings().default_benchmark
    today = date.today()
    px, bpx = price_on(db, ticker, today), price_on(db, bench, today)
    if px is None or bpx is None:
        raise ValueError("Prezzi non disponibili: eseguire prima l'aggiornamento mercati")
    rid = latest_run_id(db)
    score = db.scalar(select(Score).where(Score.run_id == rid, Score.entity_id == ticker)) if rid else None
    thesis, invalidation, horizon = "", [], horizon_months or 12
    if briefing_id:
        b = db.get(Briefing, briefing_id)
        if b:
            p = b.payload
            thesis = p.get("tesi_asimmetrica", {}).get("tesi", "")
            invalidation = p.get("red_flags", {}).get("criteri_invalidazione", [])
            horizon = horizon_months or int(p.get("tesi_asimmetrica", {}).get("orizzonte_mesi") or 12)
    e = JournalEntry(
        briefing_id=briefing_id, ticker=ticker, theme=theme.slug,
        quadrant=score.quadrant if score else "", asymmetry=score.asymmetry if score else 0,
        thesis=thesis, invalidation=invalidation, entry_day=today, entry_price=px,
        bench_ticker=bench, bench_entry=bpx, horizon_months=horizon, auto=auto, notes=notes,
    )
    db.add(e)
    db.commit()
    return e


def evaluate(db: Session) -> int:
    today, n = date.today(), 0
    for e in db.scalars(select(JournalEntry).where(JournalEntry.status == "aperto")):
        evals = dict(e.evaluations or {})
        for cp in CHECKPOINTS:
            if str(cp) in evals or (today - e.entry_day).days < cp:
                continue
            d = e.entry_day + timedelta(days=cp)
            px, bpx = price_on(db, e.ticker, d), price_on(db, e.bench_ticker, d)
            if px is None or bpx is None:
                continue
            r, br = px / e.entry_price - 1, bpx / e.bench_entry - 1
            evals[str(cp)] = {"day": d.isoformat(), "ret": round(r, 4), "bench_ret": round(br, 4),
                              "excess": round(r - br, 4), "hit": r > br}
            n += 1
        e.evaluations = evals
        if (today - e.entry_day).days > e.horizon_months * 30.5 + 5:
            e.status = "chiuso"
    db.commit()
    return n


def auto_log(db: Session, top_n: int = 5, cooldown_days: int = 28) -> list[str]:
    rid = latest_run_id(db)
    if not rid:
        return []
    candidates = db.scalars(select(Score).where(Score.run_id == rid, Score.entity_type == "asset", Score.quadrant == "stealth",
                                                 Score.data_quality >= 0.4).order_by(Score.asymmetry.desc()).limit(top_n))
    since = date.today() - timedelta(days=cooldown_days)
    logged = []
    for s in candidates:
        exists = db.scalar(select(JournalEntry.id).where(JournalEntry.ticker == s.entity_id, JournalEntry.auto.is_(True),
                                                         JournalEntry.entry_day >= since))
        if exists:
            continue
        try:
            create_entry(db, s.entity_id, auto=True, notes=f"auto-log run {rid}")
            logged.append(s.entity_id)
        except ValueError:
            continue
    return logged


def stats(db: Session) -> dict:
    entries = list(db.scalars(select(JournalEntry)))
    out: dict = {"totale": len(entries), "aperti": sum(e.status == "aperto" for e in entries), "per_checkpoint": {}, "per_quadrante": {}, "auto_vs_manuale": {}}

    def summarize(rows: list[dict]) -> dict:
        if not rows:
            return {"n": 0}
        return {"n": len(rows), "hit_rate": round(mean(r["hit"] for r in rows), 3),
                "excess_medio": round(mean(r["excess"] for r in rows), 4),
                "excess_mediano": round(sorted(r["excess"] for r in rows)[len(rows) // 2], 4)}

    for cp in CHECKPOINTS:
        rows = [e.evaluations[str(cp)] for e in entries if str(cp) in (e.evaluations or {})]
        out["per_checkpoint"][str(cp)] = summarize(rows)
    by_q, by_auto = defaultdict(list), defaultdict(list)
    for e in entries:
        ev = (e.evaluations or {}).get("90")
        if ev:
            by_q[e.quadrant or "n.d."].append(ev)
            by_auto["auto" if e.auto else "manuale"].append(ev)
    out["per_quadrante"] = {k: summarize(v) for k, v in by_q.items()}
    out["auto_vs_manuale"] = {k: summarize(v) for k, v in by_auto.items()}
    out["aggiornato"] = datetime.utcnow().isoformat()
    return out
