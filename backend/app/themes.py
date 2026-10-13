"""Universo monitorato dal radar.

Ogni tema definisce: query GDELT (attenzione mediatica globale), parole chiave per i
contratti pubblici, topic GitHub (proxy di adozione tecnologica), ticker rappresentativi.
I ticker sono un *paniere di osservazione*, non raccomandazioni.
Aggiungi/modifica temi qui: il resto del sistema si adatta da solo.
"""
from dataclasses import dataclass, field


@dataclass(frozen=True)
class Asset:
    ticker: str
    name: str
    kind: str = "equity"  # equity | etf | commodity | crypto


@dataclass(frozen=True)
class Theme:
    slug: str
    name: str
    thesis_hint: str
    gdelt_query: str
    contract_keywords: tuple[str, ...] = ()
    github_topics: tuple[str, ...] = ()
    assets: tuple[Asset, ...] = ()
    benchmark: str = "SPY"
    overton: bool = False  # tema "Finestra di Overton": monitorato come narrativa
    module: str = "radar"  # radar | geo | overton
    tags: tuple[str, ...] = field(default_factory=tuple)


THEMES: list[Theme] = [
    Theme(
        slug="semis_chokepoints",
        name="Semiconduttori & colli di bottiglia",
        thesis_hint="Litografia EUV, packaging avanzato, HBM: pochi fornitori, export controls USA-Cina.",
        gdelt_query='("export controls" OR "advanced packaging" OR "EUV lithography" OR "HBM memory") (chip OR semiconductor)',
        contract_keywords=("semiconductor", "microelectronics", "CHIPS Act"),
        github_topics=("chip-design", "risc-v"),
        assets=(
            Asset("ASML", "ASML Holding"), Asset("TSM", "TSMC"), Asset("AMAT", "Applied Materials"),
            Asset("LRCX", "Lam Research"), Asset("KLAC", "KLA Corp"), Asset("SOXX", "iShares Semiconductor", "etf"),
        ),
        tags=("tecnologia", "cina", "supply-chain"),
    ),
    Theme(
        slug="rare_earths",
        name="Terre rare & minerali critici",
        thesis_hint="Dominio cinese su raffinazione e magneti; restrizioni su gallio, germanio, antimonio.",
        gdelt_query='("rare earth" OR gallium OR germanium OR antimony OR "critical minerals") (export OR ban OR supply)',
        contract_keywords=("rare earth", "critical minerals", "antimony"),
        assets=(
            Asset("MP", "MP Materials"), Asset("LYC.AX", "Lynas Rare Earths"), Asset("ILU.AX", "Iluka Resources"),
            Asset("PPTA", "Perpetua Resources"), Asset("REMX", "VanEck Rare Earth/Strategic Metals", "etf"),
        ),
        tags=("cina", "commodity", "difesa"),
    ),
    Theme(
        slug="defense_cyber",
        name="Difesa, droni & cyber",
        thesis_hint="Riarmo europeo, guerra dei droni, software per il comando e controllo, cyber difesa.",
        gdelt_query='(drone OR "defense spending" OR "NATO spending" OR cyberattack OR DARPA OR hypersonic)',
        contract_keywords=("unmanned", "counter-UAS", "cybersecurity", "hypersonic"),
        github_topics=("cybersecurity", "drone"),
        assets=(
            Asset("PLTR", "Palantir"), Asset("KTOS", "Kratos Defense"), Asset("AVAV", "AeroVironment"),
            Asset("CRWD", "CrowdStrike"), Asset("RHM.DE", "Rheinmetall"), Asset("LDO.MI", "Leonardo"),
            Asset("ITA", "iShares US Aerospace & Defense", "etf"),
        ),
        tags=("difesa", "europa"),
    ),
    Theme(
        slug="space",
        name="Economia spaziale",
        thesis_hint="Lanci a costo decrescente, costellazioni, osservazione terrestre come infrastruttura.",
        gdelt_query='("satellite constellation" OR "launch vehicle" OR "space force" OR "direct-to-cell")',
        contract_keywords=("satellite", "launch services", "space"),
        assets=(
            Asset("RKLB", "Rocket Lab"), Asset("ASTS", "AST SpaceMobile"), Asset("PL", "Planet Labs"),
            Asset("IRDM", "Iridium"),
        ),
        tags=("difesa", "tecnologia"),
    ),
    Theme(
        slug="nuclear",
        name="Nucleare & uranio",
        thesis_hint="Domanda elettrica dei data center, SMR, arricchimento (HALEU) e dipendenza dalla Russia.",
        gdelt_query='(uranium OR "small modular reactor" OR HALEU OR "nuclear power plant") (deal OR supply OR approval)',
        contract_keywords=("uranium", "nuclear fuel", "HALEU", "reactor"),
        assets=(
            Asset("CCJ", "Cameco"), Asset("NXE", "NexGen Energy"), Asset("LEU", "Centrus Energy"),
            Asset("OKLO", "Oklo"), Asset("SMR", "NuScale Power"), Asset("URA", "Global X Uranium", "etf"),
        ),
        tags=("energia", "russia"),
    ),
    Theme(
        slug="grid_power",
        name="Rete elettrica & potenza per l'AI",
        thesis_hint="Trasformatori, turbine, raffreddamento: il collo di bottiglia dell'AI è fisico.",
        gdelt_query='("transformer shortage" OR "power grid" OR "data center power" OR "grid interconnection")',
        contract_keywords=("transmission", "transformer", "grid modernization"),
        assets=(
            Asset("GEV", "GE Vernova"), Asset("PWR", "Quanta Services"), Asset("ETN", "Eaton"),
            Asset("VRT", "Vertiv"),
        ),
        tags=("energia", "ai"),
    ),
    Theme(
        slug="metals",
        name="Rame, argento & metalli industriali",
        thesis_hint="Elettrificazione + sottoinvestimento minerario decennale = deficit strutturale.",
        gdelt_query='(copper OR silver) ("supply deficit" OR "mine output" OR smelter OR shortage)',
        assets=(
            Asset("HG=F", "Rame (future)", "commodity"), Asset("SI=F", "Argento (future)", "commodity"),
            Asset("FCX", "Freeport-McMoRan"), Asset("COPX", "Global X Copper Miners", "etf"),
        ),
        tags=("commodity",),
    ),
    Theme(
        slug="gold_dedollar",
        name="Oro & de-dollarizzazione",
        thesis_hint="Acquisti record delle banche centrali, sistemi di pagamento alternativi, sanzioni.",
        gdelt_query='("central bank gold" OR dedollarization OR "BRICS payment" OR mBridge OR "gold reserves")',
        assets=(
            Asset("GC=F", "Oro (future)", "commodity"), Asset("GLD", "SPDR Gold", "etf"),
            Asset("GDX", "VanEck Gold Miners", "etf"),
        ),
        tags=("monetario", "geopolitica"),
    ),
    Theme(
        slug="crypto",
        name="Bitcoin, stablecoin & infrastruttura crypto",
        thesis_hint="ETF spot, stablecoin come domanda di T-bill, tesorerie aziendali in BTC.",
        gdelt_query='(bitcoin OR stablecoin OR "crypto ETF" OR "bitcoin reserve")',
        github_topics=("bitcoin", "ethereum"),
        assets=(
            Asset("BTC-USD", "Bitcoin", "crypto"), Asset("ETH-USD", "Ether", "crypto"),
            Asset("COIN", "Coinbase"), Asset("IBIT", "iShares Bitcoin Trust", "etf"),
        ),
        tags=("monetario",),
    ),
    Theme(
        slug="quantum",
        name="Calcolo quantistico & crittografia post-quantum",
        thesis_hint="Correzione d'errore, roadmap governative, migrazione PQC obbligatoria.",
        gdelt_query='("quantum computing" OR "quantum computer" OR "post-quantum cryptography")',
        contract_keywords=("quantum",),
        github_topics=("quantum-computing", "post-quantum-cryptography"),
        assets=(Asset("IONQ", "IonQ"), Asset("RGTI", "Rigetti Computing"), Asset("QBTS", "D-Wave Quantum")),
        tags=("tecnologia",),
    ),
    Theme(
        slug="photonics",
        name="Fotonica & interconnessione AI",
        thesis_hint="La banda tra GPU è il nuovo limite: ottica co-packaged, transceiver 1.6T.",
        gdelt_query='("silicon photonics" OR "co-packaged optics" OR "optical transceiver" OR "AI networking")',
        github_topics=("photonics",),
        assets=(Asset("COHR", "Coherent"), Asset("LITE", "Lumentum")),
        tags=("tecnologia", "ai"),
    ),
    Theme(
        slug="synbio",
        name="Biologia sintetica & editing genetico",
        thesis_hint="Costo della sintesi DNA in calo, biomanifattura come priorità di sicurezza nazionale.",
        gdelt_query='("synthetic biology" OR biomanufacturing OR "gene editing" OR CRISPR)',
        contract_keywords=("biomanufacturing", "synthetic biology"),
        github_topics=("bioinformatics", "protein-design"),
        assets=(Asset("TWST", "Twist Bioscience"), Asset("CRSP", "CRISPR Therapeutics")),
        tags=("biotech",),
    ),
    Theme(
        slug="food_water",
        name="Sicurezza alimentare, fertilizzanti & acqua",
        thesis_hint="Clima, divieti di export e potassa/azoto come leve geopolitiche.",
        gdelt_query='("food export ban" OR "fertilizer prices" OR drought OR "wheat harvest" OR "water scarcity")',
        assets=(
            Asset("NTR", "Nutrien"), Asset("MOS", "Mosaic"), Asset("CF", "CF Industries"),
            Asset("ZW=F", "Grano (future)", "commodity"), Asset("XYL", "Xylem"),
        ),
        tags=("commodity", "clima"),
    ),
    # --- Finestra di Overton: temi monitorati come narrativa (attenzione + tono), senza paniere ---
    Theme(
        slug="overton_cbdc",
        name="CBDC & euro digitale",
        thesis_hint="Da ipotesi accademica a legislazione: chi costruisce l'infrastruttura?",
        gdelt_query='(CBDC OR "digital euro" OR "central bank digital currency" OR "e-CNY")',
        overton=True, module="overton", tags=("monetario", "sorveglianza"),
    ),
    Theme(
        slug="overton_digital_id",
        name="Identità digitale & age verification",
        thesis_hint="Wallet d'identità UE, verifica dell'età online: normalizzazione e fornitori.",
        gdelt_query='("digital identity" OR "digital ID" OR "age verification" OR "EUDI wallet")',
        overton=True, module="overton", tags=("sorveglianza",),
    ),
    Theme(
        slug="overton_energy_rationing",
        name="Razionamento energetico & demand response",
        thesis_hint="Dal 'risparmio volontario' alla gestione obbligatoria della domanda.",
        gdelt_query='("energy rationing" OR "power rationing" OR "load shedding" OR "demand response")',
        overton=True, module="overton", tags=("energia",),
    ),
]

CHOKEPOINTS: dict[str, dict] = {
    "hormuz": {"name": "Stretto di Hormuz", "query": '"Strait of Hormuz"', "why": "~20% del petrolio mondiale"},
    "malacca": {"name": "Stretto di Malacca", "query": '"Strait of Malacca"', "why": "Rotta energetica Cina-Golfo"},
    "bab_el_mandeb": {"name": "Bab el-Mandeb / Mar Rosso", "query": '("Bab el-Mandeb" OR "Red Sea shipping")', "why": "Accesso a Suez"},
    "taiwan": {"name": "Stretto di Taiwan", "query": '"Taiwan Strait"', "why": "Semiconduttori avanzati"},
    "suez": {"name": "Canale di Suez", "query": '"Suez Canal"', "why": "~12% del commercio globale"},
    "panama": {"name": "Canale di Panama", "query": '"Panama Canal"', "why": "Siccità e capacità"},
    "bosphorus": {"name": "Bosforo / Mar Nero", "query": '(Bosphorus OR "Black Sea") shipping', "why": "Grano e petrolio"},
}

# Indicatori macro da FRED (serie gratuite)
FRED_SERIES: dict[str, str] = {
    "DGS10": "Treasury 10 anni (%)",
    "T10Y2Y": "Curva 10a-2a (pp)",
    "DTWEXBGS": "Dollaro (indice ampio)",
    "BAMLH0A0HYM2": "Spread high yield (pp)",
    "VIXCLS": "VIX",
    "DCOILBRENTEU": "Brent ($)",
    "WALCL": "Bilancio Fed (mln $)",
}


def theme_by_slug(slug: str) -> Theme | None:
    return next((t for t in THEMES if t.slug == slug), None)


def theme_of_ticker(ticker: str) -> Theme | None:
    return next((t for t in THEMES for a in t.assets if a.ticker == ticker), None)


def asset_by_ticker(ticker: str) -> Asset | None:
    return next((a for t in THEMES for a in t.assets if a.ticker == ticker), None)


def all_assets() -> list[tuple[Theme, Asset]]:
    return [(t, a) for t in THEMES for a in t.assets]
