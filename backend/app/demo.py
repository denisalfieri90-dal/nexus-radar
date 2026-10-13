"""Dati DEMO sintetici per vedere la dashboard senza chiavi né rete.

Tutto ciò che viene creato qui ha source='demo' e la UI mostra un banner. I numeri sono
inventati e non dicono nulla sui mercati reali. Per rimuoverli: `python -m app.cli clear-demo`.
"""
import math
import random
from datetime import date, datetime, timedelta

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from . import journal, scoring
from .connectors.base import upsert_metric
from .models import AssetSnapshot, Contract, JournalEntry, Metric, NewsItem, Score, SourceRun
from .themes import CHOKEPOINTS, FRED_SERIES, THEMES

# profilo narrativo dei temi demo:
# (livello di copertura, trend 90g, picco recente, crescita github, crescita contratti)
PROFILES = {
    "rare_earths": (4, 1.6, 0.0, None, 1.8),      # di nicchia, in salita senza picco: candidato stealth
    "nuclear": (6, 1.4, 0.0, None, 1.5),
    "quantum": (5, 1.5, 0.1, 1.4, 1.3),
    "photonics": (2, 1.3, 0.0, 1.3, None),
    "crypto": (40, 1.1, 2.8, 1.0, None),          # mainstream con picco: zona hype/consenso
    "defense_cyber": (30, 1.2, 1.6, 1.1, 1.2),
    "gold_dedollar": (12, 1.1, 0.5, None, None),
    "overton_cbdc": (8, 1.5, 0.8, None, None),
    "overton_digital_id": (9, 1.7, 1.2, None, None),
}


def _attention(rng: random.Random, level: float, trend: float, spike: float) -> list[float]:
    vals = []
    for i in range(95):
        base = level * (1 + (trend - 1) * i / 94)
        noise = rng.gauss(0, 0.2 * level)
        bump = spike * level * math.exp(-((94 - i) / 3) ** 2) if spike else 0
        vals.append(max(0.05, base + noise + bump))
    return vals


def clear(db: Session) -> None:
    db.execute(delete(Metric).where(Metric.source == "demo"))
    db.execute(delete(AssetSnapshot).where(AssetSnapshot.source == "demo"))
    db.execute(delete(Contract).where(Contract.source == "demo"))
    db.execute(delete(NewsItem).where(NewsItem.source == "demo"))
    db.execute(delete(SourceRun).where(SourceRun.source == "demo"))
    db.execute(delete(JournalEntry).where(JournalEntry.notes.like("DEMO%")))
    db.execute(delete(Score))  # i punteggi demo vanno ricalcolati sui dati reali
    db.commit()


def seed(db: Session) -> str:
    rng = random.Random(42)
    today = date.today()
    for t in THEMES:
        level, trend, spike, gh, ct = PROFILES.get(
            t.slug, (rng.uniform(5, 25), rng.uniform(0.85, 1.15), rng.uniform(0, 0.8), None, None))
        for i, v in enumerate(_attention(rng, level, trend, spike)):
            d = today - timedelta(days=94 - i)
            upsert_metric(db, f"attention:{t.slug}", d, v, "demo")
            upsert_metric(db, f"tone:{t.slug}", d, rng.gauss(-1.5 - spike * 0.6 * (i > 80), 0.6), "demo")
        if t.github_topics:
            prev = rng.randint(80, 400)
            upsert_metric(db, f"github:{t.slug}:prev30d", today, prev, "demo")
            upsert_metric(db, f"github:{t.slug}:30d", today, round(prev * (gh or rng.uniform(0.9, 1.15))), "demo")
        if t.contract_keywords:
            q = rng.uniform(50e6, 900e6)
            upsert_metric(db, f"contracts:{t.slug}:prior_q", today, q, "demo")
            upsert_metric(db, f"contracts:{t.slug}:90d", today, q * (ct or rng.uniform(0.8, 1.15)), "demo")
            for k in range(3):
                db.add(Contract(award_id=f"DEMO-{t.slug}-{k}", theme=t.slug, recipient=f"[DEMO] Fornitore {k + 1}",
                                agency="Department of Defense", amount=rng.uniform(5e6, 120e6),
                                start_date=today - timedelta(days=rng.randint(5, 80)),
                                description=f"[DEMO] Contratto illustrativo — {t.name}", source="demo"))
        for k in range(6):
            db.add(NewsItem(source="demo", channel=t.slug, title=f"[DEMO] Titolo illustrativo {k + 1} — {t.name}",
                            url=f"https://example.com/demo/{t.slug}/{k}", domain="example.com",
                            published_at=datetime.utcnow() - timedelta(hours=rng.randint(1, 240))))
        for a in t.assets:
            px, closes = rng.uniform(20, 300), []
            drift = {"crypto": 0.004, "rare_earths": 0.0005, "quantum": 0.002}.get(t.slug, 0.0004)
            for i in range(400):
                px *= math.exp(rng.gauss(drift, 0.022))
                closes.append(px)
                upsert_metric(db, f"px:{a.ticker}", today - timedelta(days=399 - i), px, "demo")
            quiet = t.slug in ("rare_earths", "nuclear", "photonics")
            c = closes
            db.add(AssetSnapshot(
                ticker=a.ticker, day=today, price=c[-1], ret_1m=(rng.uniform(-0.05, 0.05) if quiet else c[-1] / c[-22] - 1),
                ret_3m=c[-1] / c[-64] - 1, ret_12m=c[-1] / c[-253] - 1,
                vol_ratio=rng.uniform(1.3, 1.8) if quiet else rng.uniform(0.7, 2.2),
                rvol_20=rng.uniform(0.2, 0.8), dist_52w_high=c[-1] / max(c[-252:]) - 1,
                rs_bench_3m=rng.uniform(-0.15, 0.25), source="demo",
            ))
            if a.kind == "equity" and "." not in a.ticker:
                upsert_metric(db, f"edgar:{a.ticker}:form4_30d", today, rng.randint(0, 9), "demo")
                upsert_metric(db, f"edgar:{a.ticker}:form4_base30", today, rng.uniform(1, 4), "demo")
                upsert_metric(db, f"edgar:{a.ticker}:sched13_90d", today, rng.choice([0, 0, 0, 1, 2]), "demo")
                upsert_metric(db, f"edgar:{a.ticker}:8k_30d", today, rng.randint(0, 5), "demo")
    for i, (src, title) in enumerate([
        ("ZeroHedge", "[DEMO] Central banks keep buying gold while the dollar story cracks"),
        ("Scenari Economici", "[DEMO] Euro digitale: cosa cambia davvero per il contante"),
        ("Doomberg", "[DEMO] Uranium enrichment is the bottleneck nobody prices"),
        ("Naked Capitalism", "[DEMO] Defense spending boom: who writes the narrative?"),
        ("Lyn Alden", "[DEMO] Bitcoin, stablecoins and the Treasury market"),
    ]):
        db.add(NewsItem(source=f"rss:{src}", channel="contrarian", title=title, url=f"https://example.com/demo/alt/{i}",
                        domain="example.com", published_at=datetime.utcnow() - timedelta(hours=3 * i + 1)))
    for b in ("SPY",):
        px = 500.0
        for i in range(400):
            px *= math.exp(rng.gauss(0.0004, 0.01))
            upsert_metric(db, f"px:{b}", today - timedelta(days=399 - i), px, "demo")
    for k in CHOKEPOINTS:
        spike = 2.5 if k == "bab_el_mandeb" else 1.2 if k == "taiwan" else 0.2
        for i, v in enumerate(_attention(rng, 10, 1.0, spike)):
            d = today - timedelta(days=94 - i)
            upsert_metric(db, f"attention:choke:{k}", d, v, "demo")
            upsert_metric(db, f"tone:choke:{k}", d, rng.gauss(-3 - spike * (i > 85), 0.5), "demo")
        db.add(NewsItem(source="demo", channel=f"choke:{k}", title=f"[DEMO] Aggiornamento illustrativo — {CHOKEPOINTS[k]['name']}",
                        url=f"https://example.com/demo/choke/{k}", domain="example.com", published_at=datetime.utcnow()))
    base = {"DGS10": 4.3, "T10Y2Y": 0.4, "DTWEXBGS": 121.0, "BAMLH0A0HYM2": 3.1, "VIXCLS": 17.0, "DCOILBRENTEU": 72.0, "WALCL": 6.6e6}
    for sid in FRED_SERIES:
        v = base[sid]
        for i in range(400):
            v *= math.exp(rng.gauss(0, 0.006))
            upsert_metric(db, f"fred:{sid}", today - timedelta(days=399 - i), v, "demo")
    db.add(SourceRun(source="demo", ok=True, items=0, message="dati sintetici caricati"))
    db.commit()

    run_id = scoring.run(db)
    # journal demo retrodatato, per vedere il track record in azione
    for s in db.scalars(select(Score).where(Score.run_id == run_id, Score.entity_type == "asset").order_by(Score.asymmetry.desc()).limit(8)):
        e = journal.create_entry(db, s.entity_id, auto=True, notes="DEMO — retrodatato")
        e.entry_day = today - timedelta(days=rng.choice([45, 120, 200]))
        e.entry_price = journal.price_on(db, e.ticker, e.entry_day) or e.entry_price
        e.bench_entry = journal.price_on(db, e.bench_ticker, e.entry_day) or e.bench_entry
    db.commit()
    journal.evaluate(db)
    return run_id
