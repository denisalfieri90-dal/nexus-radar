"""Schema dati. Tutto ciò che il motore afferma deve poter risalire a una riga qui."""
from datetime import date, datetime

from sqlalchemy import JSON, Boolean, Date, DateTime, Float, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from .db import Base


def utcnow() -> datetime:
    return datetime.utcnow()


class NewsItem(Base):
    """Articoli/eventi da GDELT e RSS."""

    __tablename__ = "news_items"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    source: Mapped[str] = mapped_column(String(64))  # gdelt | rss:<nome> | demo
    channel: Mapped[str] = mapped_column(String(64), default="")  # theme slug, chokepoint key, macro…
    title: Mapped[str] = mapped_column(Text)
    url: Mapped[str] = mapped_column(String(1024), unique=True)
    domain: Mapped[str] = mapped_column(String(255), default="")
    country: Mapped[str] = mapped_column(String(64), default="")
    published_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, index=True)
    fetched_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class Metric(Base):
    """Serie storiche generiche. key es.: 'attention:rare_earths', 'fred:DGS10', 'github:quantum'."""

    __tablename__ = "metrics"
    __table_args__ = (UniqueConstraint("key", "day", name="uq_metric_key_day"),)
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    key: Mapped[str] = mapped_column(String(128), index=True)
    day: Mapped[date] = mapped_column(Date, index=True)
    value: Mapped[float] = mapped_column(Float)
    source: Mapped[str] = mapped_column(String(64), default="")


class AssetSnapshot(Base):
    __tablename__ = "asset_snapshots"
    __table_args__ = (UniqueConstraint("ticker", "day", name="uq_asset_day"),)
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    ticker: Mapped[str] = mapped_column(String(32), index=True)
    day: Mapped[date] = mapped_column(Date)
    price: Mapped[float] = mapped_column(Float)
    ret_1m: Mapped[float | None] = mapped_column(Float, nullable=True)
    ret_3m: Mapped[float | None] = mapped_column(Float, nullable=True)
    ret_12m: Mapped[float | None] = mapped_column(Float, nullable=True)
    vol_ratio: Mapped[float | None] = mapped_column(Float, nullable=True)  # volume medio 20g / 120g
    rvol_20: Mapped[float | None] = mapped_column(Float, nullable=True)  # volatilità realizzata annualizzata
    dist_52w_high: Mapped[float | None] = mapped_column(Float, nullable=True)  # % dal massimo 52 sett.
    rs_bench_3m: Mapped[float | None] = mapped_column(Float, nullable=True)  # forza relativa vs benchmark
    source: Mapped[str] = mapped_column(String(32), default="yfinance")


class Contract(Base):
    """Contratti pubblici USA (USAspending)."""

    __tablename__ = "contracts"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    award_id: Mapped[str] = mapped_column(String(128), unique=True)
    theme: Mapped[str] = mapped_column(String(64), index=True)
    recipient: Mapped[str] = mapped_column(String(255), default="")
    agency: Mapped[str] = mapped_column(String(255), default="")
    amount: Mapped[float] = mapped_column(Float, default=0)
    start_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    description: Mapped[str] = mapped_column(Text, default="")
    source: Mapped[str] = mapped_column(String(32), default="usaspending")


class Score(Base):
    __tablename__ = "scores"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    run_id: Mapped[str] = mapped_column(String(32), index=True)
    computed_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    entity_type: Mapped[str] = mapped_column(String(16))  # asset | theme
    entity_id: Mapped[str] = mapped_column(String(64), index=True)
    theme: Mapped[str] = mapped_column(String(64))
    adoption: Mapped[float] = mapped_column(Float)  # curva ad S / tipping point
    accumulation: Mapped[float] = mapped_column(Float)  # accumulo silenzioso
    catalyst: Mapped[float] = mapped_column(Float)  # catalizzatori
    heat: Mapped[float] = mapped_column(Float)  # temperatura mediatica
    substance: Mapped[float] = mapped_column(Float)
    asymmetry: Mapped[float] = mapped_column(Float)
    quadrant: Mapped[str] = mapped_column(String(16))
    flags: Mapped[list] = mapped_column(JSON, default=list)
    evidence: Mapped[list] = mapped_column(JSON, default=list)
    data_quality: Mapped[float] = mapped_column(Float, default=1.0)  # quota di input reali disponibili


class Briefing(Base):
    __tablename__ = "briefings"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    subject: Mapped[str] = mapped_column(String(128))
    ticker: Mapped[str] = mapped_column(String(32), default="")
    theme: Mapped[str] = mapped_column(String(64), default="")
    model: Mapped[str] = mapped_column(String(64))
    payload: Mapped[dict] = mapped_column(JSON)
    context: Mapped[dict] = mapped_column(JSON)


class JournalEntry(Base):
    """Registro dei segnali: è ciò che trasforma il radar in un sistema misurabile."""

    __tablename__ = "journal"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    briefing_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    ticker: Mapped[str] = mapped_column(String(32))
    theme: Mapped[str] = mapped_column(String(64))
    quadrant: Mapped[str] = mapped_column(String(16), default="")
    asymmetry: Mapped[float] = mapped_column(Float, default=0)
    thesis: Mapped[str] = mapped_column(Text, default="")
    invalidation: Mapped[list] = mapped_column(JSON, default=list)
    entry_day: Mapped[date] = mapped_column(Date)
    entry_price: Mapped[float] = mapped_column(Float)
    bench_ticker: Mapped[str] = mapped_column(String(32))
    bench_entry: Mapped[float] = mapped_column(Float)
    horizon_months: Mapped[int] = mapped_column(Integer, default=12)
    auto: Mapped[bool] = mapped_column(Boolean, default=False)
    status: Mapped[str] = mapped_column(String(16), default="aperto")  # aperto | chiuso | invalidato
    evaluations: Mapped[dict] = mapped_column(JSON, default=dict)  # {"30": {...}, "90": {...}}
    notes: Mapped[str] = mapped_column(Text, default="")


class SourceRun(Base):
    """Stato di salute di ogni fonte: ogni esecuzione viene registrata."""

    __tablename__ = "source_runs"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    source: Mapped[str] = mapped_column(String(64), index=True)
    ran_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    ok: Mapped[bool] = mapped_column(Boolean)
    items: Mapped[int] = mapped_column(Integer, default=0)
    message: Mapped[str] = mapped_column(Text, default="")
