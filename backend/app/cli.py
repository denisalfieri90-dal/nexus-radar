"""Riga di comando.

  python -m app.cli init                 crea le tabelle
  python -m app.cli run all|news|daily   esegue un gruppo di job (o un singolo job: gdelt, markets, …)
  python -m app.cli seed-demo            carica dati sintetici per provare la UI
  python -m app.cli clear-demo           rimuove i dati sintetici
  python -m app.cli brief TICKER         genera un briefing da terminale (richiede ANTHROPIC_API_KEY)
  python -m app.cli brief-top [N]        briefing automatici sui primi N asset stealth (default 3)
  python -m app.cli export DIR           esporta lo stato come JSON statici per il sito
"""
import json
import logging
import sys

from .db import SessionLocal, init_db

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(levelname)s %(message)s")


def main(argv: list[str]) -> None:
    if not argv:
        print(__doc__)
        return
    init_db()
    cmd = argv[0]
    if cmd == "init":
        print("Database pronto.")
    elif cmd == "run":
        from .jobs import run

        print(json.dumps(run(argv[1] if len(argv) > 1 else "all"), indent=2, default=str))
    elif cmd in ("seed-demo", "clear-demo"):
        from . import demo

        with SessionLocal() as db:
            if cmd == "seed-demo":
                demo.clear(db)
                print("Demo caricata, run:", demo.seed(db))
            else:
                demo.clear(db)
                print("Dati demo rimossi.")
    elif cmd == "brief":
        from .llm import generate

        with SessionLocal() as db:
            b = generate(db, ticker=argv[1])
            print(json.dumps(b.payload, indent=2, ensure_ascii=False))
    elif cmd == "brief-top":
        from .llm import brief_top

        with SessionLocal() as db:
            print("Briefing generati:", brief_top(db, int(argv[1]) if len(argv) > 1 else 3))
    elif cmd == "export":
        from .export import export

        with SessionLocal() as db:
            print("File esportati:", export(db, argv[1] if len(argv) > 1 else "export"))
    else:
        print(__doc__)


if __name__ == "__main__":
    main(sys.argv[1:])
