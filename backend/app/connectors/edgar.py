"""SEC EDGAR — tracce lasciate dal 'capitale intelligente' nei documenti obbligatori.

- Form 4: operazioni degli insider (entro 2 giorni lavorativi). Qui contiamo l'attività;
  la distinzione acquisto/vendita richiede il parsing dell'XML (vedi TODO nel README).
- Schedule 13D/13G: superamento del 5% del capitale da parte di un investitore.
- 8-K: eventi societari rilevanti.
Solo emittenti USA; gli emittenti esteri (20-F/6-K) non depositano Form 4.
Richiede un User-Agent con nome ed email (SEC_USER_AGENT).
"""
import time
from datetime import date

from sqlalchemy.orm import Session

from ..config import get_settings
from ..themes import all_assets
from .base import client, get_json, record_run, upsert_metric

TICKERS_URL = "https://www.sec.gov/files/company_tickers.json"
SUBMISSIONS_URL = "https://data.sec.gov/submissions/CIK{cik:010d}.json"


def count_filings(forms: list[str], dates: list[str], today: date) -> dict:
    """Funzione pura: conteggi per finestra temporale."""
    f4_30 = f4_base = s13 = k8 = 0
    for form, ds in zip(forms, dates):
        d = date.fromisoformat(ds)
        age = (today - d).days
        if form == "4":
            if age <= 30:
                f4_30 += 1
            elif age <= 210:
                f4_base += 1
        if ("13D" in form or "13G" in form) and age <= 90:
            s13 += 1
        if form.startswith("8-K") and age <= 30:
            k8 += 1
    return {"form4_30d": f4_30, "form4_base30": f4_base / 6.0, "sched13_90d": s13, "8k_30d": k8}


def run(db: Session) -> None:
    ua = get_settings().sec_user_agent
    us_equities = [a for _, a in all_assets() if a.kind == "equity" and "." not in a.ticker]
    errors, ok, today = [], 0, date.today()
    with client({"User-Agent": ua, "Accept-Encoding": "gzip, deflate"}) as c:
        try:
            mapping = {v["ticker"].upper(): int(v["cik_str"]) for v in get_json(c, TICKERS_URL).values()}
        except Exception as e:
            record_run(db, "sec_edgar", ok=False, message=f"mappa ticker→CIK: {e}")
            return
        for a in us_equities:
            cik = mapping.get(a.ticker.upper())
            if not cik:
                continue  # emittente estero o non trovato
            try:
                recent = get_json(c, SUBMISSIONS_URL.format(cik=cik))["filings"]["recent"]
                counts = count_filings(recent["form"], recent["filingDate"], today)
                for k, v in counts.items():
                    upsert_metric(db, f"edgar:{a.ticker}:{k}", today, float(v), "sec_edgar")
                db.commit()
                ok += 1
            except Exception as e:
                db.rollback()
                errors.append(f"{a.ticker}: {e}")
            time.sleep(0.15)  # la SEC consente max 10 richieste/secondo
    record_run(db, "sec_edgar", ok=ok > 0, items=ok, message="; ".join(errors))

