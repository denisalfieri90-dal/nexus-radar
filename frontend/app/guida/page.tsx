import Link from "next/link";

export const metadata = { title: "Come si usa" };

const AREAS = [
  {
    id: "radar",
    name: "Radar",
    href: "/",
    what: "La mappa di tutti gli asset monitorati. In verticale la sostanza, in orizzontale l'attenzione dei media.",
    how: [
      "Guarda prima l'angolo in alto a sinistra, la zona Stealth: molta sostanza, poca attenzione. Le asimmetrie da studiare sono lì.",
      "Tocca un punto per vedere nome, punteggio e segnali, poi apri la scheda.",
      "Usa i filtri per tema in alto per vedere un settore alla volta.",
      "Sotto la mappa trovi la classifica delle asimmetrie, gli avvisi sui chokepoint marittimi, il cruscotto macro e il flusso di notizie.",
    ],
  },
  {
    id: "scheda",
    name: "Scheda asset",
    href: "/asset/?t=MP",
    what: "Tutto su un singolo titolo, ETF, materia prima o crypto.",
    how: [
      "Il numero grande è l'asimmetria: più è alto, più la sostanza supera l'attenzione.",
      "La scomposizione mostra i quattro assi; la tacca centrale è il valore neutro 50.",
      "«Da dove vengono i numeri» elenca ogni dato con la sua fonte: se un punteggio non ti convince, parti da qui.",
      "«Genera briefing» chiede a Claude l'analisi completa a sei sezioni. «Segui nella tua lista» fissa il prezzo di oggi per misurare come va.",
    ],
  },
  {
    id: "briefing",
    name: "Briefing",
    href: "/journal/",
    what: "L'analisi scritta da Claude con il tuo template: segnale, tesi a 12-36 mesi, geopolitica e macro, decoder della narrazione, parallelo storico, scenari avversi.",
    how: [
      "Leggi per prima la confidenza e i dati mancanti in fondo: dicono quanto fidarti.",
      "Nel decoder controlla lo stato: «supportata da dati», «parzialmente supportata» o «ipotesi non verificata». Leggi sempre la contro-lettura.",
      "I criteri di invalidazione hanno una metrica e una soglia: sono il segnale per cambiare idea.",
      "Ogni mattina la pipeline scrive da sola i briefing sui primi tre asset stealth; li trovi nel Journal.",
    ],
  },
  {
    id: "temi",
    name: "Temi",
    href: "/temi/",
    what: "I sedici filoni monitorati: semiconduttori, terre rare, difesa, spazio, nucleare, rete elettrica, metalli, oro, crypto, quantum, fotonica, biotech, cibo e acqua, più tre temi della Finestra di Overton.",
    how: [
      "La linea accanto a ogni tema mostra quanto se ne è parlato di recente.",
      "Nella pagina del tema trovi il paniere di asset, i contratti pubblici più grandi e i titoli recenti.",
      "Puoi chiedere un briefing sull'intero tema invece che sul singolo titolo.",
    ],
  },
  {
    id: "decoder",
    name: "Decoder",
    href: "/decoder/",
    what: "La lente sulla narrazione, ispirata alla psicologia delle masse e ai canali di contro-informazione.",
    how: [
      "Curiosità del giorno: un precedente storico o un concetto (Bernays, Le Bon, Weimar, la bolla dei tulipani…) collegato ai temi di oggi.",
      "Rumore e silenzio: i temi dove i media parlano molto ma i dati sono deboli, e quelli dove i dati crescono nel silenzio. Apri ogni voce per le domande da porsi.",
      "Due racconti: lo stesso tema nei media tradizionali e nella contro-narrazione, con le cinque domande di Herman e Chomsky.",
      "Finestra di Overton: CBDC, identità digitale e razionamento energetico, con la traiettoria dell'attenzione.",
      "Almanacco: tutti i precedenti storici e i modelli, filtrabili per categoria.",
    ],
  },
  {
    id: "journal",
    name: "Journal",
    href: "/journal/",
    what: "Il registro che dice se il radar funziona davvero.",
    how: [
      "In alto il rendimento medio rispetto al benchmark dopo 30, 90, 180 e 365 giorni dei segnali registrati in automatico.",
      "«La tua lista» mostra gli asset che segui, salvati solo sul tuo telefono.",
      "Dopo qualche mese confronta i segnali automatici con quelli scelti da te: è il test più onesto del metodo.",
    ],
  },
  {
    id: "altro",
    name: "Altro",
    href: "/altro/",
    what: "Impostazioni e stato del sistema.",
    how: [
      "Scegli il tema chiaro, scuro o automatico.",
      "Installa l'app sul telefono e salva il codice d'accesso per i briefing.",
      "«Stato delle fonti» mostra quali fonti hanno risposto all'ultima raccolta.",
    ],
  },
];

const GLOSSARY = [
  ["Sostanza", "Media di adozione, accumulo e catalizzatori: quanto c'è di concreto sotto il tema."],
  ["Attenzione", "Quanto ne parlano i media, rispetto agli altri temi e alla propria storia, più l'euforia di prezzo."],
  ["Asimmetria", "Sostanza meno una parte dell'attenzione in eccesso. Alta quando i fatti superano il rumore."],
  ["Stealth", "Sostanza alta e attenzione bassa: la zona più interessante."],
  ["Consenso", "Sostanza alta e attenzione alta: la tesi è probabilmente già nel prezzo."],
  ["Hype", "Attenzione alta e sostanza bassa: possibile trappola per i piccoli investitori."],
  ["Dormiente", "Né sostanza né attenzione: niente da segnalare per ora."],
  ["Accumulo silenzioso", "Volumi in forte aumento mentre il prezzo resta fermo: qualcuno compra o vende in quantità senza muoverlo."],
  ["Punto di flesso", "L'interesse per il tema accelera ma non ha ancora raggiunto il picco mediatico."],
  ["Qualità dati", "Quota delle fonti che hanno fornito dati per quel punteggio. Sotto il 40% il punto appare sbiadito."],
];

export default function GuidePage() {
  return (
    <div className="pt-8 md:pt-12 max-w-[820px]">
      <h1 className="display text-[clamp(2.7rem,8vw,4.6rem)]">Come si usa Nexus</h1>
      <p className="mt-4 text-lg max-w-[62ch]">
        Nexus cerca le scommesse asimmetriche: temi in cui i fatti crescono prima che i media se ne accorgano. Poi ti aiuta a capire
        il racconto che li circonda e a verificare nel tempo se il metodo funziona.
      </p>

      <section className="mt-10 rounded-2xl bg-paper-2 px-5 md:px-7 py-6" aria-labelledby="routine">
        <h2 id="routine" className="display text-[2rem]">Cinque minuti al giorno</h2>
        <ol className="list-decimal pl-5 mt-3 space-y-2">
          <li>Apri il <Link href="/" className="underline">Radar</Link> e guarda chi è entrato nella zona Stealth.</li>
          <li>Controlla gli Avvisi ai naviganti: un chokepoint in allerta cambia il contesto di molti temi.</li>
          <li>Leggi la curiosità del giorno nel <Link href="/decoder/" className="underline">Decoder</Link> e passa da Rumore e silenzio.</li>
          <li>Apri la scheda dell&apos;asset che ti incuriosisce, leggi da dove vengono i numeri e, se vale la pena, genera il briefing.</li>
          <li>Se vuoi seguirlo, aggiungilo alla tua lista. Una volta al mese guarda il <Link href="/journal/" className="underline">Journal</Link>.</li>
        </ol>
      </section>

      {AREAS.map((a) => (
        <section key={a.id} id={a.id} className="mt-10 border-t border-rule pt-6 scroll-mt-24" aria-labelledby={`${a.id}-t`}>
          <div className="flex items-baseline justify-between gap-4">
            <h2 id={`${a.id}-t`} className="display text-[2rem]">
              {a.name}
            </h2>
            <Link href={a.href} className="text-sm underline shrink-0">
              Apri
            </Link>
          </div>
          <p className="mt-2 max-w-[62ch]">{a.what}</p>
          <ul className="mt-3 space-y-2 list-disc pl-5 max-w-[66ch]">
            {a.how.map((h) => (
              <li key={h}>{h}</li>
            ))}
          </ul>
        </section>
      ))}

      <section className="mt-12 border-t border-ink pt-6" aria-labelledby="glossario">
        <h2 id="glossario" className="display text-[2rem]">Glossario</h2>
        <dl className="mt-4 divide-y divide-rule border-y border-rule">
          {GLOSSARY.map(([term, def]) => (
            <div key={term} className="py-3 grid sm:grid-cols-[180px_1fr] gap-x-6 gap-y-1">
              <dt className="font-semibold">{term}</dt>
              <dd>{def}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="mt-12" aria-labelledby="aggiornamenti">
        <h2 id="aggiornamenti" className="display text-[2rem]">Quando si aggiorna</h2>
        <p className="mt-3 max-w-[64ch]">
          Notizie, attenzione dei media e contro-narrazione ogni due ore. Prezzi, contratti pubblici, macro, journal e briefing
          automatici ogni mattina alle 7:40. L&apos;ora dell&apos;ultimo aggiornamento è in alto nella pagina.
        </p>
        <p className="mt-3 max-w-[64ch] text-muted">
          Strumento di ricerca personale. I segnali sono ipotesi da verificare, non indicazioni di acquisto o vendita.
        </p>
      </section>
    </div>
  );
}
