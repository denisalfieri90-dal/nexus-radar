"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AuthError, BRAIN, KEYS, readLocal, requestBriefing, writeLocal } from "@/lib/api";

const STAGES = [
  { at: 0, text: "Sveglio il servizio di analisi" },
  { at: 12, text: "Scarico l'ultimo stato del radar" },
  { at: 25, text: "Preparo il pacchetto di contesto" },
  { at: 35, text: "Claude sta scrivendo il briefing" },
  { at: 75, text: "Quasi pronto" },
];

/** Genera un briefing su richiesta tramite il servizio protetto da codice d'accesso. */
export function BriefButton({ target, label }: { target: { ticker?: string; theme?: string }; label: string }) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "ask" | "busy" | "error">("idle");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const timer = useRef<number | null>(null);

  useEffect(() => () => {
    if (timer.current) clearInterval(timer.current);
  }, []);

  if (!BRAIN) {
    return <p className="text-sm text-muted">I briefing su richiesta non sono attivi su questo sito. Quelli automatici sono nel Journal.</p>;
  }

  async function run(withCode: string) {
    setState("busy");
    setError("");
    setElapsed(0);
    const t0 = Date.now();
    timer.current = window.setInterval(() => setElapsed(Math.round((Date.now() - t0) / 1000)), 500);
    try {
      const doc = await requestBriefing(target, withCode);
      writeLocal(KEYS.accessCode, withCode);
      router.push(`/briefing/?id=${encodeURIComponent(String(doc.id))}`);
    } catch (e) {
      if (e instanceof AuthError) {
        writeLocal(KEYS.accessCode, "");
        setState("ask");
        setError("Codice non valido. Riprova.");
      } else {
        setState("error");
        setError(e instanceof TypeError ? "Il servizio non risponde. Controlla la connessione e riprova tra un minuto." : (e as Error).message);
      }
    } finally {
      if (timer.current) clearInterval(timer.current);
    }
  }

  function start() {
    const saved = readLocal<string>(KEYS.accessCode, "");
    if (saved) run(saved);
    else setState("ask");
  }

  const stage = [...STAGES].reverse().find((s) => elapsed >= s.at) ?? STAGES[0];

  return (
    <div className="w-full sm:w-auto">
      {state === "busy" ? (
        <div className="border border-ink px-4 py-3 min-w-[18rem]" role="status" aria-live="polite">
          <div className="flex items-center gap-3">
            <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden>
              <circle cx="12" cy="12" r="10" fill="none" stroke="var(--contour)" strokeWidth="2" />
              <path d="M12 12 L12 2 A10 10 0 0 1 21 7.5 Z" fill="var(--seaglass)" opacity="0.6" style={{ transformOrigin: "12px 12px", animation: "sweep 1.4s linear infinite" }} />
            </svg>
            <span className="font-semibold">{stage.text}</span>
          </div>
          <div className="h-1 bg-paper-2 mt-3 overflow-hidden">
            <div className="h-full bg-seaglass transition-[width] duration-500" style={{ width: `${Math.min(95, (elapsed / 90) * 100)}%` }} />
          </div>
          <p className="text-xs text-muted mt-1.5">{elapsed} s. Di solito ci vogliono 40-90 secondi: puoi lasciare la pagina aperta.</p>
        </div>
      ) : state === "ask" ? (
        <form
          className="border border-ink px-4 py-3 max-w-md"
          onSubmit={(e) => {
            e.preventDefault();
            if (code.trim()) run(code.trim());
          }}
        >
          <label htmlFor="access-code" className="font-semibold block">
            Codice d&apos;accesso
          </label>
          <p className="text-sm text-muted">Serve una volta sola: resta salvato su questo dispositivo.</p>
          <div className="flex gap-2 mt-2">
            <input
              id="access-code"
              type="password"
              autoComplete="current-password"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="flex-1 min-w-0 bg-paper-2 border border-rule px-3 min-h-11 text-base"
              aria-describedby={error ? "code-error" : undefined}
              autoFocus
            />
            <button type="submit" className="bg-ink text-paper px-4 min-h-11">
              Genera
            </button>
          </div>
          {error && (
            <p id="code-error" className="text-buoy text-sm mt-2">
              {error}
            </p>
          )}
        </form>
      ) : (
        <>
          <button onClick={start} className="w-full sm:w-auto bg-ink text-paper px-5 min-h-12 inline-flex items-center justify-center gap-2 hover:opacity-90">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
              <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" strokeLinecap="round" />
            </svg>
            {label}
          </button>
          {state === "error" && <p className="text-buoy text-sm mt-2" role="alert">{error}</p>}
        </>
      )}
    </div>
  );
}
