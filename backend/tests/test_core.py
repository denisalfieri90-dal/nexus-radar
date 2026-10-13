import os
from datetime import date, timedelta

os.environ["DATABASE_URL"] = "sqlite:///./test_nexus.db"

import numpy as np
import pandas as pd
import pytest

from app.connectors.edgar import count_filings
from app.connectors.markets import compute_snapshot
from app.llm import BRIEFING_TOOL, parse_tool_output
from app.scoring import AssetFeatures, ThemeFeatures, score_asset, theme_scores


def test_compute_snapshot_quiet_accumulation():
    idx = pd.date_range("2025-01-01", periods=300, freq="B")
    close = pd.Series(np.linspace(100, 80, 300), index=idx)
    vol = pd.Series([1_000.0] * 280 + [2_500.0] * 20, index=idx)
    s = compute_snapshot(pd.DataFrame({"Close": close, "Volume": vol}), bench_ret_3m=0.0)
    assert s["vol_ratio"] > 1.5
    assert -0.25 < s["dist_52w_high"] < 0
    assert s["rs_bench_3m"] == pytest.approx(s["ret_3m"])


def test_count_filings_windows():
    today = date(2026, 10, 13)
    forms = ["4", "4", "4", "SCHEDULE 13G", "8-K", "4"]
    dates = [(today - timedelta(days=d)).isoformat() for d in (1, 10, 25, 40, 5, 100)]
    c = count_filings(forms, dates, today)
    assert c["form4_30d"] == 3 and c["sched13_90d"] == 1 and c["8k_30d"] == 1
    assert c["form4_base30"] == pytest.approx(1 / 6)


def test_stealth_vs_hype():
    early = theme_scores(ThemeFeatures(attention_z=0.2, attention_accel=1.5, github_growth=1.4, contracts_ratio=1.6, contracts_90d=5e8))
    stealth = score_asset(AssetFeatures(ret_1m=0.02, ret_3m=0.05, vol_ratio=1.6, dist_52w_high=-0.25, rs_bench_3m=0.05, sched13_90d=1), early)
    assert stealth["quadrant"] == "stealth"
    assert "accumulo_silenzioso" in stealth["flags"] and "tipping_point" in stealth["flags"]

    peaked = theme_scores(ThemeFeatures(attention_z=3.5, attention_accel=0.9))
    hype = score_asset(AssetFeatures(ret_1m=0.4, ret_3m=1.2, vol_ratio=2.5, dist_52w_high=0.0, rs_bench_3m=-0.1), peaked)
    assert hype["heat"] > 70
    assert hype["asymmetry"] < stealth["asymmetry"]
    assert all({"label", "value", "source", "reading"} <= set(e) for e in hype["evidence"])


def test_missing_data_is_flagged():
    th = theme_scores(ThemeFeatures())
    s = score_asset(AssetFeatures(), th)
    assert "dati_insufficienti" in s["flags"]
    assert s["data_quality"] < 0.4


def test_parse_tool_output():
    content = [{"type": "text", "text": "x"}, {"type": "tool_use", "name": "emit_briefing", "input": {"confidenza": "media"}}]
    assert parse_tool_output(content)["confidenza"] == "media"
    assert "decoder_narrazione" in BRIEFING_TOOL["input_schema"]["required"]


def test_demo_end_to_end():
    from fastapi.testclient import TestClient

    from app.db import SessionLocal, init_db
    from app import demo
    from app.main import app

    init_db()
    with SessionLocal() as db:
        demo.clear(db)
        demo.seed(db)
    with TestClient(app) as c:
        assert c.get("/api/health").json()["demo"] is True
        radar = c.get("/api/radar").json()
        assert len(radar) > 40
        quads = {r["quadrant"] for r in radar}
        assert "stealth" in quads
        top = radar[0]["entity_id"]
        assert c.get(f"/api/assets/{top}").json()["score"]["entity_id"] == top
        assert len(c.get("/api/themes").json()) >= 16
        assert c.get("/api/geo").json()["chokepoints"]
        assert c.get("/api/macro").json()["indicators"]
        stats = c.get("/api/journal/stats").json()
        assert stats["totale"] >= 5
        assert c.post("/api/jobs/score").status_code == 401
        # contesto LLM costruibile senza chiave
        from app.llm import build_context
        with SessionLocal() as db:
            ctx = build_context(db, ticker=top)
        assert ctx["punteggi"]["evidence"]


def test_export_static(tmp_path):
    import json

    from app.db import SessionLocal
    from app.export import export, safe_name

    with SessionLocal() as db:
        n = export(db, tmp_path)
    assert n > 70
    radar = json.loads((tmp_path / "radar.json").read_text())
    t = radar[0]["entity_id"]
    asset = json.loads((tmp_path / "assets" / f"{safe_name(t)}.json").read_text())
    assert asset["ticker"] == t
    assert (tmp_path / "assets" / "GC_F.json").exists()
    assert json.loads((tmp_path / "health.json").read_text())["static"] is True


def test_access_code_required():
    from fastapi.testclient import TestClient

    from app.main import app, settings

    settings.access_code = "segreto"
    try:
        with TestClient(app) as c:
            r = c.post("/api/briefings", json={"ticker": "MP"}, headers={"X-Access-Code": "sbagliato"})
            assert r.status_code == 401
            r = c.post("/api/briefings", json={"ticker": "MP"}, headers={"X-Access-Code": "segreto"})
            assert r.status_code == 400 and "ANTHROPIC" in r.json()["detail"]
    finally:
        settings.access_code = ""


def test_news_daily_counts_saturation():
    import time as _t
    from datetime import date as _d, datetime as _dt, timedelta as _td

    from app.connectors.newsrss import daily_counts

    today = _d(2026, 10, 13)
    def entry(days_ago, hour=12):
        return {"published_parsed": (_dt(2026, 10, 13, hour) - _td(days=days_ago)).timetuple()}
    c = daily_counts([entry(0), entry(0), entry(2)], today)
    assert c[today] == 2 and c[today - _td(days=2)] == 1 and c[today - _td(days=1)] == 0 and len(c) == 7
    sat = daily_counts([entry(0, h % 24) for h in range(100)], today)
    assert list(sat) == [today] and sat[today] > 90


def test_decoder_build():
    from app.db import SessionLocal
    from app.decoder import build

    with SessionLocal() as db:
        d = build(db)
    assert d["themes"] and d["overton"]
    assert {t["bucket"] for t in d["themes"]} <= {"rumore", "silenzio", "allineato"}
    assert any(t["alternative"] for t in d["themes"] + d["overton"])
