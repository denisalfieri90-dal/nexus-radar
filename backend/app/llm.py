"""Pipeline di sintesi: pacchetto di contesto tracciabile → Claude → briefing strutturato.

Usiamo il tool use forzato (`emit_briefing`): l'output è sempre JSON valido con il
template a 6 sezioni, più i campi di disciplina epistemica (evidenze, contro-lettura,
criteri di invalidazione misurabili, confidenza, dati mancanti).
"""
import json
from datetime import date, datetime, timedelta
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.orm import Session

from .config import get_settings
from .models import Briefing, Contract, NewsItem, Score
from .scoring import latest, latest_run_id, series
from .themes import CHOKEPOINTS, FRED_SERIES, THEMES, asset_by_ticker, theme_by_slug, theme_of_ticker

SYSTEM_PROMPT = (Path(__file__).parent / "prompts" / "system_prompt.md").read_text()

_str = {"type": "string"}
_strs = {"type": "array", "items": {"type": "string"}}

BRIEFING_TOOL = {
    "name": "emit_briefing",
    "description": "Restituisce il briefing NEXUS strutturato nelle 6 sezioni del template.",
    "input_schema": {
        "type": "object",
        "required": ["radar_signal", "tesi_asimmetrica", "background_geomacro", "decoder_narrazione",
                     "parallelo_storico", "red_flags", "confidenza", "motivazione_confidenza", "dati_mancanti"],
        "properties": {
            "radar_signal": {
                "type": "object", "required": ["nome", "tema", "quadrante", "sintesi"],
                "properties": {"nome": _str, "ticker": _str, "tema": _str, "quadrante": _str, "sintesi": _str},
            },
            "tesi_asimmetrica": {
                "type": "object", "required": ["tesi", "catalizzatori", "orizzonte_mesi", "scenario_rialzista", "scenario_ribassista"],
                "properties": {
                    "tesi": _str,
                    "effetti_secondo_ordine": _str,
                    "catalizzatori": {"type": "array", "items": {
                        "type": "object", "required": ["evento", "finestra", "come_verificarlo"],
                        "properties": {"evento": _str, "finestra": _str, "come_verificarlo": _str}}},
                    "orizzonte_mesi": {"type": "integer", "minimum": 3, "maximum": 36},
                    "scenario_rialzista": _str,
                    "scenario_ribassista": _str,
                },
            },
            "background_geomacro": {
                "type": "object", "required": ["sintesi", "vettori"],
                "properties": {"sintesi": _str, "vettori": {"type": "array", "items": {
                    "type": "object", "required": ["vettore", "collegamento"],
                    "properties": {"vettore": _str, "collegamento": _str}}}},
            },
            "decoder_narrazione": {
                "type": "object",
                "required": ["narrativa_mainstream", "cui_prodest", "meccanismo_psicologico", "lettura_alternativa",
                             "evidenze_a_supporto", "contro_lettura", "stato"],
                "properties": {
                    "narrativa_mainstream": _str, "cui_prodest": _str, "meccanismo_psicologico": _str,
                    "lettura_alternativa": _str, "evidenze_a_supporto": _strs, "contro_lettura": _str,
                    "stato": {"type": "string", "enum": ["supportata da dati", "parzialmente supportata", "ipotesi non verificata"]},
                    "finestra_overton": _str,
                },
            },
            "parallelo_storico": {
                "type": "object", "required": ["precedente", "analogia", "dove_non_regge"],
                "properties": {"precedente": _str, "analogia": _str, "dove_non_regge": _str, "quadro_teorico": _str},
            },
            "red_flags": {
                "type": "object", "required": ["rischi", "criteri_invalidazione"],
                "properties": {
                    "rischi": _strs,
                    "criteri_invalidazione": {"type": "array", "items": {
                        "type": "object", "required": ["criterio", "metrica", "soglia"],
                        "properties": {"criterio": _str, "metrica": _str, "soglia": _str}}},
                },
            },
            "confidenza": {"type": "string", "enum": ["bassa", "media", "alta"]},
            "motivazione_confidenza": _str,
            "dati_mancanti": _strs,
        },
    },
}


# ------------------------------------------------------------------ contesto
def _score_row(db: Session, entity_id: str) -> dict | None:
    rid = latest_run_id(db)
    s = db.scalar(select(Score).where(Score.run_id == rid, Score.entity_id == entity_id)) if rid else None
    if not s:
        return None
    return {k: getattr(s, k) for k in ("adoption", "accumulation", "catalyst", "heat", "substance", "asymmetry",
                                        "quadrant", "flags", "evidence", "data_quality")}


def _headlines(db: Session, channels: list[str], days: int = 14, limit: int = 25) -> list[dict]:
    since = datetime.utcnow() - timedelta(days=days)
    rows = db.scalars(select(NewsItem).where(NewsItem.channel.in_(channels), NewsItem.published_at >= since)
                      .order_by(NewsItem.published_at.desc()).limit(limit))
    return [{"titolo": n.title, "fonte": n.domain or n.source, "data": n.published_at.date().isoformat(), "url": n.url} for n in rows]


def macro_snapshot(db: Session) -> list[dict]:
    out = []
    for sid, label in FRED_SERIES.items():
        pts = series(db, f"fred:{sid}", 120)
        if not pts:
            continue
        last = pts[-1][1]
        old = next((v for d, v in pts if d >= date.today() - timedelta(days=95)), pts[0][1])
        out.append({"serie": sid, "nome": label, "ultimo": round(last, 3), "var_3m": round(last - old, 3), "data": pts[-1][0].isoformat()})
    return out


def chokepoint_snapshot(db: Session) -> list[dict]:
    from statistics import mean, pstdev

    out = []
    for k, cp in CHOKEPOINTS.items():
        att = [v for _, v in series(db, f"attention:choke:{k}", 95)]
        tone = [v for _, v in series(db, f"tone:choke:{k}", 95)]
        z = None
        if len(att) >= 30:
            base = att[:-7]
            z = (mean(att[-7:]) - mean(base)) / (pstdev(base) or 1e-9)
        head = _headlines(db, [f"choke:{k}"], days=3, limit=3)
        out.append({
            "chiave": k, "nome": cp["name"], "rilevanza": cp["why"],
            "attenzione_z": None if z is None else round(z, 2),
            "tono_7g": round(mean(tone[-7:]), 2) if len(tone) >= 7 else None,
            "allerta": "alta" if (z or 0) > 2 else "media" if (z or 0) > 1 else "bassa",
            "titoli": head,
        })
    return out


def build_context(db: Session, ticker: str | None = None, theme_slug: str | None = None) -> dict:
    theme = theme_of_ticker(ticker) if ticker else theme_by_slug(theme_slug or "")
    if not theme:
        raise ValueError("Ticker o tema non presente nell'universo monitorato (themes.py)")
    asset = asset_by_ticker(ticker) if ticker else None
    contracts = db.scalars(select(Contract).where(Contract.theme == theme.slug).order_by(Contract.amount.desc()).limit(8))
    ctx = {
        "data_odierna": date.today().isoformat(),
        "soggetto": {
            "tipo": "asset" if asset else "tema", "ticker": asset.ticker if asset else None,
            "nome": asset.name if asset else theme.name, "categoria": asset.kind if asset else None,
            "tema": theme.name, "ipotesi_di_lavoro_del_tema": theme.thesis_hint,
            "altri_asset_del_tema": [a.ticker for a in theme.assets if not asset or a.ticker != asset.ticker],
        },
        "punteggi": _score_row(db, asset.ticker if asset else theme.slug),
        "punteggi_tema": _score_row(db, theme.slug) if asset else None,
        "titoli_recenti_tema": _headlines(db, [theme.slug]),
        "contratti_pubblici_principali": [
            {"beneficiario": c.recipient, "ente": c.agency, "importo_usd": round(c.amount), "inizio": c.start_date.isoformat() if c.start_date else None,
             "descrizione": c.description[:300]} for c in contracts
        ],
        "macro": macro_snapshot(db),
        "chokepoint": chokepoint_snapshot(db),
        "finestra_overton": [
            {"tema": t.name, **(_score_row(db, t.slug) or {})} for t in THEMES if t.overton
        ],
        "contro_narrazione_recente": _headlines(db, ["contrarian"], days=7, limit=10),
        "regolatori_e_banche_centrali": _headlines(db, ["macro", "regulatory"], days=14, limit=10),
    }
    for row in ctx["finestra_overton"]:
        row.pop("evidence", None)
    if asset:
        ctx["prezzo"] = {"ultimo": latest(db, f"px:{asset.ticker}")}
    return ctx


# ------------------------------------------------------------------ chiamata a Claude
def generate(db: Session, ticker: str | None = None, theme_slug: str | None = None) -> Briefing:
    s = get_settings()
    if not s.anthropic_api_key:
        raise RuntimeError("ANTHROPIC_API_KEY mancante: impostala nel file .env")
    import anthropic

    ctx = build_context(db, ticker, theme_slug)
    client = anthropic.Anthropic(api_key=s.anthropic_api_key)
    msg = client.messages.create(
        model=s.claude_model,
        max_tokens=s.claude_max_tokens,
        system=SYSTEM_PROMPT,
        tools=[BRIEFING_TOOL],
        tool_choice={"type": "tool", "name": "emit_briefing"},
        messages=[{
            "role": "user",
            "content": "PACCHETTO DI CONTESTO (unica fonte per i fatti):\n```json\n"
                       + json.dumps(ctx, ensure_ascii=False, default=str) + "\n```\n"
                       "Produci il briefing NEXUS chiamando emit_briefing.",
        }],
    )
    payload = parse_tool_output(msg.content)
    b = Briefing(
        subject=ctx["soggetto"]["nome"], ticker=ticker or "", theme=(theme_of_ticker(ticker).slug if ticker else theme_slug) or "",
        model=s.claude_model, payload=payload, context=ctx,
    )
    db.add(b)
    db.commit()
    return b


def parse_tool_output(content) -> dict:
    for block in content:
        btype = getattr(block, "type", None) or (block.get("type") if isinstance(block, dict) else None)
        if btype == "tool_use":
            return dict(getattr(block, "input", None) or block["input"])
    raise RuntimeError("Il modello non ha restituito il briefing strutturato")


def brief_top(db: Session, n: int = 3, cooldown_days: int = 7) -> list[str]:
    """Briefing automatici per i primi N asset in zona stealth (saltando quelli già
    analizzati negli ultimi `cooldown_days` giorni). Usato dalla pipeline quotidiana."""
    if not get_settings().anthropic_api_key:
        return []
    rid = latest_run_id(db)
    if not rid:
        return []
    since = datetime.utcnow() - timedelta(days=cooldown_days)
    done = []
    rows = db.scalars(select(Score).where(Score.run_id == rid, Score.entity_type == "asset", Score.quadrant == "stealth",
                                          Score.data_quality >= 0.4).order_by(Score.asymmetry.desc()).limit(n * 3))
    for s in rows:
        if len(done) >= n:
            break
        if db.scalar(select(Briefing.id).where(Briefing.ticker == s.entity_id, Briefing.created_at >= since)):
            continue
        try:
            generate(db, ticker=s.entity_id)
            done.append(s.entity_id)
        except Exception as e:  # un errore su un ticker non blocca gli altri
            import logging

            logging.getLogger("nexus.llm").warning("briefing %s fallito: %s", s.entity_id, e)
    return done
