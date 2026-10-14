"use client";

import Link from "next/link";
import { useState } from "react";
import { BRAIN, Health, KEYS, REPO_URL, stamp, useData, useLocal } from "@/lib/api";
import { Chevron } from "./dashboard";
import { RadarMark } from "./shell";
import { useInstall } from "./install";
import { ThemeToggle } from "./theme";

export function SettingsView() {
  const { data: health } = useData<Health>("health.json");
  const [code, setCode] = useLocal<string>(KEYS.accessCode, "");
  const [draft, setDraft] = useState("");
  const { event: install, standalone: installed, platform, install: doInstall } = useInstall();
  const ios = platform === "ios";

  return (
    <div className="pt-8 md:pt-12 max-w-[760px]">
      <h1 className="display text-[clamp(2.7rem,8vw,4.6rem)]">Altro</h1>

      <Section title="Aspetto">
        <p className="text-sm text-muted mb-3">Automatico segue l&apos;impostazione del telefono o del computer.</p>
        <ThemeToggle withLabels />
      </Section>

      <Section title="Installa come app">
        {installed ? (
          <p>Nexus è già installato su questo dispositivo.</p>
        ) : install ? (
          <>
            <p className="mb-3">Aggiungi Nexus alla schermata Home: si apre a schermo intero e funziona anche offline con gli ultimi dati.</p>
            <button
              onClick={doInstall}
              className="bg-ink text-paper px-5 min-h-12 rounded-full font-semibold inline-flex items-center gap-2"
            >
              <RadarMark size={22} />
              Installa Nexus
            </button>
          </>
        ) : ios ? (
          <ol className="list-decimal pl-5 space-y-1">
            <li>Apri questa pagina in Safari.</li>
            <li>Tocca il pulsante Condividi in basso.</li>
            <li>Scegli &ldquo;Aggiungi alla schermata Home&rdquo;.</li>
          </ol>
        ) : (
          <ol className="list-decimal pl-5 space-y-1">
            <li>Apri questa pagina in Chrome.</li>
            <li>Tocca il menu ⋮ in alto a destra.</li>
            <li>Scegli &ldquo;Installa app&rdquo; oppure &ldquo;Aggiungi a schermata Home&rdquo;.</li>
          </ol>
        )}
      </Section>

      {BRAIN && (
        <Section title="Briefing su richiesta">
          <p className="text-sm text-muted mb-3">
            Il codice d&apos;accesso protegge la generazione dei briefing con Claude. Resta salvato solo su questo dispositivo.
          </p>
          {code ? (
            <div className="flex flex-wrap items-center gap-3">
              <p>Codice salvato.</p>
              <button onClick={() => setCode("")} className="border border-ink px-4 min-h-11">
                Rimuovi il codice
              </button>
            </div>
          ) : (
            <form
              className="flex gap-2 max-w-md"
              onSubmit={(e) => {
                e.preventDefault();
                if (draft.trim()) setCode(draft.trim());
                setDraft("");
              }}
            >
              <label htmlFor="code" className="sr-only">
                Codice d&apos;accesso
              </label>
              <input
                id="code"
                type="password"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Codice d'accesso"
                className="flex-1 min-w-0 bg-paper-2 border border-rule px-3 min-h-11 text-base"
              />
              <button className="bg-ink text-paper px-4 min-h-11">Salva</button>
            </form>
          )}
        </Section>
      )}

      <Section title="Dati">
        <ul className="divide-y divide-rule border-y border-rule">
          <li>
            <Link href="/guida/" className="flex items-center min-h-14 gap-3">
              <span className="flex-1">
                Come si usa Nexus
                <span className="block text-sm text-muted">Le aree, la routine di cinque minuti, il glossario</span>
              </span>
              <Chevron />
            </Link>
          </li>
          <li>
            <Link href="/fonti/" className="flex items-center min-h-14 gap-3">
              <span className="flex-1">
                Stato delle fonti
                <span className="block text-sm text-muted">Quali fonti hanno risposto all&apos;ultima raccolta</span>
              </span>
              <Chevron />
            </Link>
          </li>
          {REPO_URL && (
            <li>
              <a href={REPO_URL} target="_blank" rel="noreferrer" className="flex items-center min-h-14 gap-3">
                <span className="flex-1">
                  Codice e pipeline su GitHub
                  <span className="block text-sm text-muted">Metodo, temi monitorati, esecuzioni della raccolta</span>
                </span>
                <Chevron />
              </a>
            </li>
          )}
        </ul>
        {health?.exported_at && <p className="text-sm text-muted mt-3">Ultimo aggiornamento: {stamp(health.exported_at)}. La raccolta gira ogni due ore.</p>}
      </Section>

      <Section title="Come leggere il radar">
        <div className="prose-brief text-base space-y-3">
          <p>
            Ogni asset riceve quattro misure da 0 a 100. <b>Adozione</b>: l&apos;interesse per il tema accelera prima del picco.{" "}
            <b>Accumulo</b>: volumi in crescita a prezzo fermo, soglie del 5% superate, forza relativa. <b>Catalizzatori</b>: contratti
            pubblici ed eventi societari. <b>Attenzione</b>: quanto ne parlano i media del mondo.
          </p>
          <p>
            La zona <b>stealth</b> raccoglie gli asset con molta sostanza e poca attenzione: le asimmetrie da studiare. La zona{" "}
            <b>hype</b> segnala il contrario, il terreno delle trappole per i piccoli investitori.
          </p>
          <p className="text-muted">
            Strumento di ricerca personale. I segnali sono ipotesi da verificare, non indicazioni di acquisto o vendita.
          </p>
        </div>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-rule pt-6 mt-8">
      <h2 className="display text-[1.8rem] mb-3">{title}</h2>
      {children}
    </section>
  );
}
