"""API di NEXUS ASYMMETRY & RADAR."""
import logging
from contextlib import asynccontextmanager
from datetime import datetime, timedelta

from fastapi import BackgroundTasks, Depends, FastAPI, Header, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from . import journal
from .config import get_settings
from .db import get_db, init_db
from .llm import chokepoint_snapshot, macro_snapshot
from .models import AssetSnapshot, Briefing, Contract, JournalEntry, Metric, NewsItem, Score, SourceRun
from .scoring import attention_series, latest_run_id, series
from .themes import CHOKEPOINTS, FRED_SERIES, THEMES, asset_by_ticker, theme_by_slug, theme_of_ticker

logging.basicConfig(level=logging.INFO)
settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    if settings.db_snapshot_url:
        from .snapshot import refresh

        refresh(force=True)
    init_db()
    scheduler = None
    if settings.enable_scheduler:
        from apscheduler.schedulers.background import BackgroundScheduler

        from .jobs import run

        scheduler = BackgroundScheduler(timezone="Europe/Rome")
        scheduler.add_job(lambda: run("news"), "interval", minutes=60, id="news")
        scheduler.add_job(lambda: run("daily"), "cron", hour=7, minute=10, id="daily")
        scheduler.start()
    yield
    if scheduler:
        scheduler.shutdown()


app = FastAPI(title="NEXUS Asymmetry & Radar", version="1.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.cors_origins.split(",") if o.strip()],
    allow_methods=["*"], allow_headers=["*"],
)


def _score_dict(s: Score) -> dict:
    return {k: getattr(s, k) for k in ("entity_type", "entity_id", "theme", "adoption", "accumulation", "catalyst", "heat",
                                        "substance", "asymmetry", "quadrant", "flags", "evidence", "data_quality")} | {
        "computed_at": s.computed_at.isoformat()}


def _news_dict(n: NewsItem) -> dict:
    return {"id": n.id, "title": n.title, "url": n.url, "source": n.source, "domain": n.domain, "channel": n.channel,
            "country": n.country, "published_at": n.published_at.isoformat()}


def _latest_scores(db: Session, entity_type: str) -> list[Score]:
    rid = latest_run_id(db)
    if not rid:
        return []
    return list(db.scalars(select(Score).where(Score.run_id == rid, Score.entity_type == entity_type)))


# ------------------------------------------------------------------ stato
@app.get("/api/health")
def health(db: Session = Depends(get_db)):
    last = db.scalar(select(func.max(Score.computed_at)))
    return {
        "ok": True,
        "demo": bool(db.scalar(select(Metric.id).where(Metric.source == "demo").limit(1))),
        "last_score_at": last.isoformat() if last else None,
        "llm_configured": bool(settings.anthropic_api_key),
        "access_code_required": bool(settings.access_code),
        "model": settings.claude_model,
    }


@app.get("/api/sources")
def sources(db: Session = Depends(get_db)):
    names = db.scalars(select(SourceRun.source).distinct())
    out = []
    for n in names:
        last = db.scalar(select(SourceRun).where(SourceRun.source == n).order_by(SourceRun.ran_at.desc()).limit(1))
        last_ok = db.scalar(select(func.max(SourceRun.ran_at)).where(SourceRun.source == n, SourceRun.ok.is_(True)))
        out.append({"source": n, "ok": last.ok, "ran_at": last.ran_at.isoformat(), "items": last.items,
                    "message": last.message, "last_ok_at": last_ok.isoformat() if last_ok else None})
    return sorted(out, key=lambda x: x["source"])


# ------------------------------------------------------------------ radar
@app.get("/api/radar")
def radar(db: Session = Depends(get_db)):
    themes = {t.slug: t for t in THEMES}
    out = []
    for s in _latest_scores(db, "asset"):
        a = asset_by_ticker(s.entity_id)
        snap = db.scalar(select(AssetSnapshot).where(AssetSnapshot.ticker == s.entity_id).order_by(AssetSnapshot.day.desc()).limit(1))
        out.append(_score_dict(s) | {
            "name": a.name if a else s.entity_id, "kind": a.kind if a else "", "theme_name": themes[s.theme].name,
            "price": snap.price if snap else None, "ret_3m": snap.ret_3m if snap else None,
        })
    return sorted(out, key=lambda x: -x["asymmetry"])


@app.get("/api/themes")
def themes_list(db: Session = Depends(get_db)):
    scores = {s.entity_id: s for s in _latest_scores(db, "theme")}
    out = []
    for t in THEMES:
        s = scores.get(t.slug)
        att, _ = attention_series(db, t.slug)
        out.append({
            "slug": t.slug, "name": t.name, "thesis_hint": t.thesis_hint, "module": t.module, "overton": t.overton,
            "tags": list(t.tags), "assets": [a.ticker for a in t.assets],
            "score": _score_dict(s) if s else None,
            "attention": [{"day": d.isoformat(), "value": round(v, 3)} for d, v in att],
        })
    return out


@app.get("/api/themes/{slug}")
def theme_detail(slug: str, db: Session = Depends(get_db)):
    t = theme_by_slug(slug)
    if not t:
        raise HTTPException(404, "tema non trovato")
    rid = latest_run_id(db)
    scores = list(db.scalars(select(Score).where(Score.run_id == rid, Score.theme == slug))) if rid else []
    since = datetime.utcnow() - timedelta(days=21)
    news = db.scalars(select(NewsItem).where(NewsItem.channel == slug, NewsItem.published_at >= since).order_by(NewsItem.published_at.desc()).limit(40))
    contracts = db.scalars(select(Contract).where(Contract.theme == slug).order_by(Contract.amount.desc()).limit(15))
    return {
        "slug": t.slug, "name": t.name, "thesis_hint": t.thesis_hint, "overton": t.overton, "tags": list(t.tags),
        "theme_score": next((_score_dict(s) for s in scores if s.entity_type == "theme"), None),
        "assets": [_score_dict(s) | {"name": (asset_by_ticker(s.entity_id) or t).name} for s in scores if s.entity_type == "asset"],
        "attention": [{"day": d.isoformat(), "value": round(v, 3)} for d, v in attention_series(db, slug)[0]],
        "attention_source": attention_series(db, slug)[1],
        "tone": [{"day": d.isoformat(), "value": round(v, 3)} for d, v in series(db, f"tone:{slug}", 95)],
        "news": [_news_dict(n) for n in news],
        "contracts": [{"award_id": c.award_id, "recipient": c.recipient, "agency": c.agency, "amount": c.amount,
                       "start_date": c.start_date.isoformat() if c.start_date else None, "description": c.description} for c in contracts],
    }


@app.get("/api/assets/{ticker}")
def asset_detail(ticker: str, db: Session = Depends(get_db)):
    a, t = asset_by_ticker(ticker), theme_of_ticker(ticker)
    if not a or not t:
        raise HTTPException(404, "asset non nell'universo monitorato")
    rid = latest_run_id(db)
    s = db.scalar(select(Score).where(Score.run_id == rid, Score.entity_id == ticker)) if rid else None
    snap = db.scalar(select(AssetSnapshot).where(AssetSnapshot.ticker == ticker).order_by(AssetSnapshot.day.desc()).limit(1))
    briefs = db.scalars(select(Briefing).where(Briefing.ticker == ticker).order_by(Briefing.created_at.desc()).limit(10))
    return {
        "ticker": a.ticker, "name": a.name, "kind": a.kind, "theme": t.slug, "theme_name": t.name, "benchmark": t.benchmark,
        "score": _score_dict(s) if s else None,
        "snapshot": {k: getattr(snap, k) for k in ("day", "price", "ret_1m", "ret_3m", "ret_12m", "vol_ratio", "rvol_20",
                                                   "dist_52w_high", "rs_bench_3m", "source")} if snap else None,
        "prices": [{"day": d.isoformat(), "value": round(v, 4)} for d, v in series(db, f"px:{ticker}", 365)],
        "briefings": [{"id": b.id, "created_at": b.created_at.isoformat(), "confidenza": b.payload.get("confidenza")} for b in briefs],
    }


# ------------------------------------------------------------------ geo, macro, feed
@app.get("/api/geo")
def geo(db: Session = Depends(get_db)):
    return {"chokepoints": chokepoint_snapshot(db), "meta": CHOKEPOINTS}


@app.get("/api/macro")
def macro(db: Session = Depends(get_db)):
    snap = macro_snapshot(db)
    for row in snap:
        row["series"] = [{"day": d.isoformat(), "value": round(v, 4)} for d, v in series(db, f"fred:{row['serie']}", 180)]
    return {"indicators": snap, "labels": FRED_SERIES}


@app.get("/api/feed")
def feed(channel: str | None = None, limit: int = Query(60, le=300), db: Session = Depends(get_db)):
    q = select(NewsItem).order_by(NewsItem.published_at.desc()).limit(limit)
    if channel:
        q = q.where(NewsItem.channel == channel)
    return [_news_dict(n) for n in db.scalars(q)]


# ------------------------------------------------------------------ briefing
class BriefingRequest(BaseModel):
    ticker: str | None = None
    theme: str | None = None


@app.post("/api/briefings")
def create_briefing(req: BriefingRequest, x_access_code: str = Header("")):
    """Genera un briefing. Sul servizio pubblico richiede il codice d'accesso
    (protegge la chiave Anthropic) e lavora su uno snapshot aggiornato del database."""
    from .db import SessionLocal
    from .llm import generate

    if settings.access_code and x_access_code != settings.access_code:
        raise HTTPException(401, "Codice d'accesso non valido")
    if not req.ticker and not req.theme:
        raise HTTPException(400, "indicare ticker o theme")
    if settings.db_snapshot_url:
        from .snapshot import refresh

        refresh()
    with SessionLocal() as db:
        try:
            b = generate(db, ticker=req.ticker, theme_slug=req.theme)
        except (ValueError, RuntimeError) as e:
            raise HTTPException(400, str(e))
        return {"id": b.id, "subject": b.subject, "ticker": b.ticker, "theme": b.theme, "model": b.model,
                "created_at": b.created_at.isoformat(), "payload": b.payload, "context": b.context}


@app.get("/api/briefings")
def list_briefings(db: Session = Depends(get_db)):
    rows = db.scalars(select(Briefing).order_by(Briefing.created_at.desc()).limit(100))
    return [{"id": b.id, "subject": b.subject, "ticker": b.ticker, "theme": b.theme, "created_at": b.created_at.isoformat(),
             "confidenza": b.payload.get("confidenza"), "quadrante": b.payload.get("radar_signal", {}).get("quadrante")} for b in rows]


@app.get("/api/briefings/{bid}")
def get_briefing(bid: int, db: Session = Depends(get_db)):
    b = db.get(Briefing, bid)
    if not b:
        raise HTTPException(404, "briefing non trovato")
    return {"id": b.id, "subject": b.subject, "ticker": b.ticker, "theme": b.theme, "model": b.model,
            "created_at": b.created_at.isoformat(), "payload": b.payload, "context": b.context}


# ------------------------------------------------------------------ journal
class JournalRequest(BaseModel):
    ticker: str
    briefing_id: int | None = None
    horizon_months: int | None = None
    notes: str = ""


@app.post("/api/journal")
def add_journal(req: JournalRequest, db: Session = Depends(get_db)):
    try:
        e = journal.create_entry(db, req.ticker, req.briefing_id, horizon_months=req.horizon_months, notes=req.notes)
    except ValueError as ex:
        raise HTTPException(400, str(ex))
    return {"id": e.id}


@app.get("/api/journal")
def list_journal(db: Session = Depends(get_db)):
    rows = db.scalars(select(JournalEntry).order_by(JournalEntry.entry_day.desc()))
    out = []
    for e in rows:
        px = journal.price_on(db, e.ticker, datetime.utcnow().date())
        bpx = journal.price_on(db, e.bench_ticker, datetime.utcnow().date())
        out.append({
            "id": e.id, "ticker": e.ticker, "theme": e.theme, "quadrant": e.quadrant, "asymmetry": e.asymmetry,
            "thesis": e.thesis, "invalidation": e.invalidation, "entry_day": e.entry_day.isoformat(),
            "entry_price": e.entry_price, "bench_ticker": e.bench_ticker, "horizon_months": e.horizon_months,
            "auto": e.auto, "status": e.status, "evaluations": e.evaluations, "notes": e.notes, "briefing_id": e.briefing_id,
            "ret_to_date": (px / e.entry_price - 1) if px else None,
            "excess_to_date": ((px / e.entry_price) - (bpx / e.bench_entry)) if px and bpx else None,
        })
    return out


@app.get("/api/journal/stats")
def journal_stats(db: Session = Depends(get_db)):
    return journal.stats(db)


# ------------------------------------------------------------------ webhook TradingView
@app.post("/api/webhooks/tradingview")
async def tradingview_webhook(payload: dict, token: str = Query(""), db: Session = Depends(get_db)):
    """Riceve gli alert di TradingView (messaggio JSON con almeno 'ticker' e 'message').
    URL da configurare nell'alert: https://<api>/api/webhooks/tradingview?token=<ADMIN_TOKEN>"""
    if token != settings.admin_token:
        raise HTTPException(401, "token non valido")
    ticker = str(payload.get("ticker", "")).upper()
    t = theme_of_ticker(ticker)
    item = NewsItem(source="tradingview", channel=t.slug if t else "tradingview",
                    title=f"[Alert TradingView] {ticker}: {payload.get('message', '')}"[:1000],
                    url=f"tradingview://{ticker}/{datetime.utcnow().timestamp()}", domain="tradingview.com")
    db.add(item)
    db.commit()
    return {"stored": item.id}


# ------------------------------------------------------------------ job (protetti)
@app.post("/api/jobs/{name}")
def trigger_job(name: str, background: BackgroundTasks, x_admin_token: str = Header("")):
    if x_admin_token != settings.admin_token:
        raise HTTPException(401, "token non valido")
    from .jobs import GROUPS, JOBS, run

    if name not in JOBS and name not in GROUPS:
        raise HTTPException(404, "job sconosciuto")
    background.add_task(run, name)
    return {"started": name}
