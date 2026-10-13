/** Almanacco: concetti di psicologia delle masse, precedenti storici e teorie economiche,
 *  ciascuno collegato ai temi del radar in cui oggi si può osservare. Contenuto curato a mano. */

export type AlmanacCategory = "Psicologia delle masse" | "Bolle e manie" | "Moneta e debito" | "Risorse e geopolitica" | "Idee e modelli";

export type AlmanacEntry = {
  id: string;
  category: AlmanacCategory;
  title: string;
  when: string;
  story: string;
  today: string;
  question: string;
  themes: string[];
  reference?: string;
};

export const CATEGORIES: AlmanacCategory[] = ["Psicologia delle masse", "Bolle e manie", "Moneta e debito", "Risorse e geopolitica", "Idee e modelli"];

export const ALMANAC: AlmanacEntry[] = [
  {
    id: "bernays",
    category: "Psicologia delle masse",
    title: "Bernays e le «fiaccole della libertà»",
    when: "New York, 1929",
    story:
      "Edward Bernays, nipote di Freud e padre delle pubbliche relazioni, fece sfilare giovani donne che fumavano durante la parata di Pasqua, presentando le sigarette come simbolo di emancipazione. Il cliente era l'industria del tabacco, che voleva raddoppiare il mercato.",
    today:
      "Quando un prodotto finanziario viene venduto come scelta di libertà, identità o modernità, la domanda giusta è chi ha pagato la cornice del racconto.",
    question: "Il messaggio mi vende un'emozione o un fatto misurabile?",
    themes: ["crypto", "overton_cbdc"],
    reference: "E. Bernays, Propaganda (1928)",
  },
  {
    id: "lebon",
    category: "Psicologia delle masse",
    title: "La folla di Le Bon",
    when: "Francia, 1895",
    story:
      "Gustave Le Bon descrisse la folla come un'entità che pensa per immagini, si lascia contagiare dalle emozioni e segue l'affermazione ripetuta più che il ragionamento. Chi la guida non argomenta: afferma, ripete, contagia.",
    today:
      "Le manie di mercato seguono lo stesso schema: slogan semplici, ripetizione sui social, la sensazione di restare indietro. Nel radar compaiono come attenzione alta con sostanza bassa.",
    question: "Sto reagendo a un dato o alla ripetizione di uno slogan?",
    themes: ["crypto", "quantum"],
    reference: "G. Le Bon, Psicologia delle folle (1895)",
  },
  {
    id: "chomsky",
    category: "Psicologia delle masse",
    title: "I cinque filtri del consenso",
    when: "Stati Uniti, 1988",
    story:
      "Herman e Chomsky proposero che le notizie passino da cinque filtri: chi possiede i media, chi paga la pubblicità, da quali fonti ufficiali dipendono i giornalisti, chi può punire una copertura sgradita, e la presenza di un nemico comune che compatta il pubblico.",
    today:
      "Utile per leggere i temi di sicurezza e difesa: le fonti sono spesso le stesse istituzioni che allocano i budget, e la notizia arriva già incorniciata.",
    question: "Da quale fonte primaria viene questa notizia e chi la finanzia?",
    themes: ["defense_cyber", "semis_chokepoints"],
    reference: "E. Herman, N. Chomsky, La fabbrica del consenso (1988)",
  },
  {
    id: "overton",
    category: "Psicologia delle masse",
    title: "La Finestra di Overton",
    when: "Mackinac Center, anni '90",
    story:
      "Joseph Overton osservò che i politici possono sostenere solo idee comprese in una «finestra» di ciò che il pubblico considera accettabile. La finestra si sposta: un'idea passa da impensabile a radicale, poi accettabile, ragionevole, popolare e infine legge.",
    today:
      "Valute digitali delle banche centrali, identità digitale, gestione obbligatoria dei consumi: il Decoder ne misura la traiettoria dell'attenzione nel tempo.",
    question: "Cosa era impensabile cinque anni fa e oggi viene presentato come inevitabile?",
    themes: ["overton_cbdc", "overton_digital_id", "overton_energy_rationing"],
    reference: "Mackinac Center for Public Policy",
  },
  {
    id: "tulipani",
    category: "Bolle e manie",
    title: "La mania dei tulipani",
    when: "Olanda, 1636-1637",
    story:
      "I bulbi rari venivano scambiati con contratti a termine nelle taverne, spesso senza che nessuno li avesse mai visti. Nel febbraio 1637 un'asta andò deserta e il mercato si fermò in pochi giorni. Gli storici moderni ridimensionano i danni raccontati da Mackay, ma lo schema resta.",
    today:
      "Quando si compra un contratto su un bene che nessuno usa, sperando di rivenderlo a qualcuno più ottimista, il prezzo dipende dal prossimo compratore, non dal bene.",
    question: "Chi sarebbe il compratore finale, e perché?",
    themes: ["crypto", "quantum"],
    reference: "C. Mackay (1841); A. Goldgar, Tulipmania (2007)",
  },
  {
    id: "southsea",
    category: "Bolle e manie",
    title: "South Sea Bubble e la sconfitta di Newton",
    when: "Londra, 1720",
    story:
      "La Compagnia dei Mari del Sud scambiò il debito pubblico britannico con le proprie azioni, promettendo profitti dai commerci con il Sud America. Il titolo si moltiplicò per otto in pochi mesi e poi crollò. Isaac Newton, rientrato vicino al picco, perse una fortuna.",
    today:
      "Un'innovazione vera (allora il commercio globale, oggi l'intelligenza artificiale) può convivere con prezzi che scontano decenni di perfezione.",
    question: "Il prezzo sconta lo scenario migliore o quello probabile?",
    themes: ["photonics", "grid_power"],
  },
  {
    id: "mississippi",
    category: "Bolle e manie",
    title: "John Law e la carta moneta",
    when: "Parigi, 1716-1720",
    story:
      "John Law convinse la Francia a stampare carta moneta garantita dalle terre della Louisiana e dalle azioni della Compagnia del Mississippi. Per sostenere il prezzo delle azioni si stampava altra moneta: quando la fiducia cedette, crollarono entrambe.",
    today:
      "Quando moneta e attività finanziarie si sostengono a vicenda, la fiducia diventa l'unico collaterale.",
    question: "Cosa garantisce davvero questa moneta o questo titolo?",
    themes: ["gold_dedollar", "overton_cbdc"],
  },
  {
    id: "ferrovie",
    category: "Bolle e manie",
    title: "La febbre delle ferrovie",
    when: "Regno Unito, anni 1840",
    story:
      "Il Parlamento autorizzò migliaia di chilometri di nuove linee e i risparmiatori si indebitarono per comprare azioni ferroviarie. Molte società fallirono, ma la rete costruita cambiò il paese per un secolo.",
    today:
      "La tecnologia può vincere anche se i primi investitori perdono. Le infrastrutture di rete elettrica e spazio sono la versione moderna di quella storia.",
    question: "Sto puntando sull'infrastruttura o su chi la costruisce a debito?",
    themes: ["grid_power", "space"],
  },
  {
    id: "denario",
    category: "Moneta e debito",
    title: "Il denario che si svuotava",
    when: "Roma, I-III secolo",
    story:
      "Sotto Augusto il denario era quasi argento puro. Per pagare legioni e burocrazia gli imperatori ridussero gradualmente il metallo: sotto Gallieno, attorno al 260, la moneta conteneva pochi punti percentuali d'argento e i prezzi esplosero.",
    today:
      "Il debasement moderno non toglie metallo ma aggiunge moneta. Gli acquisti d'oro delle banche centrali sono il modo in cui gli stati si coprono dal rischio.",
    question: "Il potere d'acquisto dei miei risparmi è protetto da cosa?",
    themes: ["gold_dedollar", "metals"],
  },
  {
    id: "weimar",
    category: "Moneta e debito",
    title: "Weimar, 1923",
    when: "Germania, 1921-1923",
    story:
      "Tra debiti di guerra, occupazione della Ruhr e stampa di moneta, a novembre 1923 servivano oltre quattromila miliardi di marchi per un dollaro. I risparmi della classe media sparirono; chi possedeva beni reali e debiti in marchi si arricchì.",
    today:
      "Nelle fasi di inflazione alta la ricchezza si sposta da chi presta a chi deve e da chi ha liquidità a chi ha beni reali.",
    question: "In questo scenario sto dalla parte del debitore o del creditore?",
    themes: ["gold_dedollar", "metals"],
  },
  {
    id: "nixon",
    category: "Moneta e debito",
    title: "Lo shock di Nixon",
    when: "15 agosto 1971",
    story:
      "In un discorso televisivo di domenica sera, Nixon sospese la convertibilità del dollaro in oro: fine del sistema di Bretton Woods. Fu presentato come una misura temporanea. Non tornò mai.",
    today:
      "La de-dollarizzazione è la domanda opposta: cosa succede quando parte del mondo cerca di uscire dal sistema nato quel giorno.",
    question: "Quale decisione «temporanea» di oggi potrebbe diventare permanente?",
    themes: ["gold_dedollar", "crypto"],
  },
  {
    id: "eo6102",
    category: "Moneta e debito",
    title: "Quando l'oro divenne illegale",
    when: "Stati Uniti, 1933",
    story:
      "Con l'Executive Order 6102 Roosevelt obbligò i privati a consegnare quasi tutto l'oro alla Federal Reserve a 20,67 dollari l'oncia. L'anno dopo il prezzo ufficiale fu portato a 35 dollari.",
    today:
      "Gli stati possono cambiare le regole sugli asset rifugio: vale per l'oro di ieri e potrebbe valere per le crypto o il contante di domani.",
    question: "Questo asset resta mio anche se cambia la legge?",
    themes: ["gold_dedollar", "crypto", "overton_cbdc"],
  },
  {
    id: "cantillon",
    category: "Moneta e debito",
    title: "L'effetto Cantillon",
    when: "Richard Cantillon, circa 1730",
    story:
      "La nuova moneta non arriva a tutti nello stesso momento. Chi la riceve per primo, come banche, stato e fornitori pubblici, spende ai prezzi vecchi; chi la riceve per ultimo paga prezzi già saliti.",
    today:
      "I contratti pubblici sono un'immagine di dove arriva per prima la spesa: è per questo che il radar li considera un catalizzatore.",
    question: "Dove arriva per prima la nuova spesa pubblica?",
    themes: ["defense_cyber", "semis_chokepoints", "nuclear"],
  },
  {
    id: "triffin",
    category: "Moneta e debito",
    title: "Il dilemma di Triffin",
    when: "Robert Triffin, 1960",
    story:
      "Un paese che emette la valuta di riserva mondiale deve fornire al mondo la propria moneta, quindi accumulare deficit con l'estero. Ma più deficit accumula, più la fiducia in quella moneta si erode.",
    today:
      "È la tensione strutturale dietro la de-dollarizzazione e gli acquisti d'oro delle banche centrali.",
    question: "Chi finanzia il deficit, e fino a quando vorrà farlo?",
    themes: ["gold_dedollar"],
  },
  {
    id: "terrerare2010",
    category: "Risorse e geopolitica",
    title: "Lo stop delle terre rare al Giappone",
    when: "Settembre 2010",
    story:
      "Dopo un incidente navale vicino alle isole Senkaku, le spedizioni cinesi di terre rare verso il Giappone si bloccarono per settimane. I prezzi salirono di molte volte e il mondo scoprì quanto dipendeva da un solo fornitore.",
    today:
      "Le restrizioni su gallio, germanio e antimonio sono la stessa leva usata in modo più sistematico. Il radar le segue nel tema terre rare.",
    question: "Quale materiale critico ha un solo grande fornitore?",
    themes: ["rare_earths", "semis_chokepoints"],
  },
  {
    id: "suez1967",
    category: "Risorse e geopolitica",
    title: "Il canale di Suez chiuso per otto anni",
    when: "1967-1975",
    story:
      "Dopo la Guerra dei sei giorni il canale rimase chiuso: quindici navi mercantili restarono intrappolate nei Laghi Amari per otto anni. Il commercio si adattò circumnavigando l'Africa e spinse la costruzione di superpetroliere.",
    today:
      "Gli attacchi nel Mar Rosso hanno riaperto la stessa domanda. Gli Avvisi ai naviganti del radar misurano la tensione sui chokepoint.",
    question: "Quale rotta alternativa esiste, e quanto costa in tempo e noli?",
    themes: ["food_water", "metals"],
  },
  {
    id: "embargo1973",
    category: "Risorse e geopolitica",
    title: "L'embargo petrolifero",
    when: "Ottobre 1973",
    story:
      "I paesi arabi dell'OPEC bloccarono le esportazioni verso gli Stati Uniti e altri alleati di Israele. In pochi mesi il prezzo del greggio quadruplicò: code ai distributori, domeniche a piedi anche in Italia e una spinta decisiva al nucleare in Francia.",
    today:
      "La sicurezza energetica torna a guidare le scelte: nucleare, rete elettrica e uranio sono la risposta di oggi alla domanda del 1973.",
    question: "Chi controlla l'energia di cui avrà bisogno l'intelligenza artificiale?",
    themes: ["nuclear", "grid_power"],
  },
  {
    id: "hunt",
    category: "Risorse e geopolitica",
    title: "I fratelli Hunt e l'argento",
    when: "1979-1980",
    story:
      "I fratelli Hunt accumularono una quota enorme dell'argento mondiale, spingendone il prezzo da circa 6 a quasi 50 dollari l'oncia. Le borse cambiarono le regole sulla leva e il 27 marzo 1980, il «Silver Thursday», il prezzo crollò.",
    today:
      "Nei mercati piccoli di metalli fisici chi controlla le scorte può muovere il prezzo, e chi scrive le regole può fermarlo.",
    question: "Quanto è grande questo mercato rispetto a chi ci sta entrando?",
    themes: ["metals"],
  },
  {
    id: "arpanet",
    category: "Risorse e geopolitica",
    title: "Dalla DARPA a internet",
    when: "ARPANET, 1969",
    story:
      "Internet, il GPS e gran parte dei semiconduttori moderni nascono da spesa militare e agenzie come la DARPA. I mercati privati sono arrivati dopo, quando la tecnologia era già stata pagata.",
    today:
      "Seguire i contratti pubblici, oggi su quantum, droni e microelettronica, significa vedere i mercati di domani prima che arrivino in Borsa.",
    question: "Quale tecnologia sta finanziando oggi lo Stato senza fare notizia?",
    themes: ["quantum", "defense_cyber", "space"],
  },
  {
    id: "dalio",
    category: "Idee e modelli",
    title: "Il ciclo dei grandi imperi",
    when: "Ray Dalio, 2021",
    story:
      "Dalio descrive le potenze dominanti come cicli: ascesa grazie a istruzione, innovazione e commercio; picco con la valuta di riserva; declino tra debito eccessivo, conflitti interni e un rivale in crescita. Olanda, Regno Unito, Stati Uniti e Cina sono i suoi casi.",
    today:
      "Il modello è discusso ma offre una mappa: semiconduttori, valuta e materie prime sono i fronti della competizione tra potenze.",
    question: "In quale fase del ciclo leggo questo dato?",
    themes: ["gold_dedollar", "semis_chokepoints", "rare_earths"],
    reference: "R. Dalio, Principles for Dealing with the Changing World Order (2021)",
  },
  {
    id: "minsky",
    category: "Idee e modelli",
    title: "Il momento Minsky",
    when: "Hyman Minsky, anni '70-'80",
    story:
      "La stabilità genera instabilità: dopo un periodo tranquillo gli operatori si indebitano di più, finché il debito si regge solo sul rialzo dei prezzi. Quando il rialzo si ferma, tutti vendono insieme.",
    today:
      "Leva, prodotti a margine e volatilità compressa sono i segnali da osservare nei temi più caldi.",
    question: "Quanta leva c'è dietro questo rialzo?",
    themes: ["crypto", "photonics"],
  },
  {
    id: "soros",
    category: "Idee e modelli",
    title: "La riflessività di Soros",
    when: "George Soros, 1987",
    story:
      "I prezzi non riflettono solo i fondamentali: li cambiano. Un'azione che sale permette all'azienda di raccogliere capitale e assumere, rendendo vera la storia che il mercato raccontava.",
    today:
      "Nei temi spaziali e di frontiera la narrativa può autoavverarsi, finché il capitale continua ad arrivare.",
    question: "La storia funziona anche se il prezzo smette di salire?",
    themes: ["space", "quantum"],
    reference: "G. Soros, L'alchimia della finanza (1987)",
  },
  {
    id: "taleb",
    category: "Idee e modelli",
    title: "Antifragilità",
    when: "Nassim Taleb, 2012",
    story:
      "Alcune cose si rompono con gli shock, altre li sopportano, altre ancora ne traggono vantaggio. Una posizione è antifragile quando ha perdita limitata e guadagno potenziale molto grande.",
    today:
      "È la definizione stessa di scommessa asimmetrica, il cuore del radar: piccola puntata, scenario negativo noto, scenario positivo ampio.",
    question: "Quanto perdo se ho torto, e quanto guadagno se ho ragione?",
    themes: ["rare_earths", "nuclear", "quantum"],
    reference: "N. N. Taleb, Antifragile (2012)",
  },
  {
    id: "austriaci-mmt",
    category: "Idee e modelli",
    title: "Scuola austriaca contro MMT",
    when: "Dibattito contemporaneo",
    story:
      "Per la Scuola austriaca la moneta creata dal nulla distorce i prezzi e prepara le crisi. Per la Teoria monetaria moderna uno stato che emette la propria valuta non può fallire nella sua moneta: il limite vero è l'inflazione.",
    today:
      "Chi crede alla prima compra oro e beni scarsi; chi crede alla seconda guarda a dove va la spesa pubblica. Il radar osserva entrambi i segnali.",
    question: "Quale delle due visioni sta confermando il dato di oggi?",
    themes: ["gold_dedollar", "defense_cyber"],
  },
  {
    id: "goodhart",
    category: "Idee e modelli",
    title: "La legge di Goodhart",
    when: "Charles Goodhart, 1975",
    story:
      "Quando una misura diventa un obiettivo, smette di essere una buona misura. Chi viene valutato su un numero impara a muovere il numero, non la realtà.",
    today:
      "Vale anche per questo radar: se un segnale diventa famoso, chi vuole attrarre compratori imparerà a produrlo. Per questo il journal misura i risultati nel tempo.",
    question: "Questo indicatore può essere manipolato da chi ne beneficia?",
    themes: ["crypto", "overton_digital_id"],
  },
];

/** Curiosità del giorno: cambia ogni giorno, uguale per tutti nella stessa data. */
export function entryOfTheDay(date = new Date()): AlmanacEntry {
  const day = Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 864e5);
  return ALMANAC[day % ALMANAC.length];
}
