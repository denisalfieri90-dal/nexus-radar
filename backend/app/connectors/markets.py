"""Prezzi e volumi via yfinance (Yahoo Finance, non ufficiale: va bene per la ricerca,
non per l'esecuzione). Calcola le metriche usate dall'asse 'accumulazione'."""
import math
from datetime import date

import numpy as np
import pandas as pd
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import AssetSnapshot
from ..themes import all_assets
from .base import record_run, upsert_metric


def _ret(close: pd.Series, n: int) -> float | None:
    if len(close) <= n:
        return None
    return float(close.iloc[-1] / close.iloc[-n - 1] - 1)


def compute_snapshot(hist: pd.DataFrame, bench_ret_3m: float | None = None) -> dict:
    """Funzione pura (testabile): da uno storico OHLCV a metriche sintetiche."""
    close = hist["Close"].dropna()
    vol = hist["Volume"].fillna(0) if "Volume" in hist else pd.Series(dtype=float)
    out: dict = {"price": float(close.iloc[-1])}
    out["ret_1m"], out["ret_3m"], out["ret_12m"] = _ret(close, 21), _ret(close, 63), _ret(close, 252)
    if len(vol) >= 120 and vol.iloc[-120:].mean() > 0:
        out["vol_ratio"] = float(vol.iloc[-20:].mean() / vol.iloc[-120:].mean())
    else:
        out["vol_ratio"] = None
    logret = np.log(close / close.shift(1)).dropna()
    out["rvol_20"] = float(logret.iloc[-20:].std() * math.sqrt(252)) if len(logret) >= 20 else None
    window = close.iloc[-252:]
    out["dist_52w_high"] = float(close.iloc[-1] / window.max() - 1)
    out["rs_bench_3m"] = (out["ret_3m"] - bench_ret_3m) if (out["ret_3m"] is not None and bench_ret_3m is not None) else None
    return out


def fetch_history(ticker: str, period: str = "14mo") -> pd.DataFrame:
    import yfinance as yf

    hist = yf.Ticker(ticker).history(period=period, auto_adjust=True, timeout=20)
    if hist is None or hist.empty:
        raise RuntimeError(f"nessun dato per {ticker}")
    hist.index = pd.to_datetime(hist.index).tz_localize(None)
    return hist


def _store_closes(db: Session, ticker: str, hist: pd.DataFrame) -> None:
    for ts, px in hist["Close"].dropna().iloc[-400:].items():
        upsert_metric(db, f"px:{ticker}", ts.date(), float(px), "yfinance")


def run(db: Session) -> None:
    pairs = all_assets()
    benchmarks = sorted({t.benchmark for t, _ in pairs} | {"SPY"})
    bench_ret: dict[str, float | None] = {}
    errors, ok = [], 0
    for b in benchmarks:
        try:
            h = fetch_history(b)
            bench_ret[b] = _ret(h["Close"].dropna(), 63)
            _store_closes(db, b, h)
        except Exception as e:
            errors.append(f"{b}: {e}")
    today = date.today()
    for theme, asset in pairs:
        try:
            h = fetch_history(asset.ticker)
            snap = compute_snapshot(h, bench_ret.get(theme.benchmark))
            row = db.scalar(select(AssetSnapshot).where(AssetSnapshot.ticker == asset.ticker, AssetSnapshot.day == today))
            if not row:
                row = AssetSnapshot(ticker=asset.ticker, day=today, price=snap["price"])
                db.add(row)
            for k, v in snap.items():
                setattr(row, k, v)
            row.source = "yfinance"
            _store_closes(db, asset.ticker, h)
            db.commit()
            ok += 1
        except Exception as e:
            db.rollback()
            errors.append(f"{asset.ticker}: {e}")
    record_run(db, "yfinance", ok=ok > 0, items=ok, message="; ".join(errors))
