"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Health, prefetchData, stamp, useData } from "@/lib/api";
import { InstallPrompt } from "./install";
import { ThemeToggle } from "./theme";

const NAV = [
  { href: "/", label: "Radar", icon: IconRadar },
  { href: "/temi/", label: "Temi", icon: IconLayers },
  { href: "/decoder/", label: "Decoder", icon: IconLens },
  { href: "/journal/", label: "Journal", icon: IconLog },
  { href: "/altro/", label: "Altro", icon: IconMore },
];

function isActive(path: string, href: string) {
  if (href === "/") return path === "/";
  const base = href.replace(/\/$/, "");
  if (base === "/temi") return path.startsWith("/temi") || path.startsWith("/tema");
  if (base === "/altro") return path.startsWith("/altro") || path.startsWith("/fonti") || path.startsWith("/guida");
  return path.startsWith(base);
}

export function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const { data } = useData<Health>("health.json");
  const online = useOnline();

  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
    // dati delle sezioni principali in anticipo: cambiare scheda è istantaneo
    const warm = () => ["radar.json", "decoder.json", "themes.json", "journal_stats.json", "journal.json", "geo.json"].forEach(prefetchData);
    const w = window as unknown as { requestIdleCallback?: (cb: () => void) => void };
    if (w.requestIdleCallback) w.requestIdleCallback(warm);
    else setTimeout(warm, 800);
  }, []);

  return (
    <>
      <a href="#contenuto" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 bg-ink text-paper px-4 py-2">
        Vai al contenuto
      </a>
      <header className="safe-top sticky top-0 z-30 bg-paper/90 backdrop-blur-md border-b border-rule">
        <div className="max-w-[1320px] mx-auto px-4 md:px-8 h-14 md:h-16 flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2.5" aria-label="Nexus, vai al radar">
            <RadarMark />
            <span className="display text-[1.6rem] md:text-[1.75rem]">Nexus</span>
          </Link>
          <nav className="hidden md:flex gap-1" aria-label="Sezioni principali">
            {NAV.map((l) => {
              const on = isActive(path, l.href);
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  aria-current={on ? "page" : undefined}
                  className={`px-3.5 py-2 rounded-full text-[0.95rem] transition-colors ${on ? "bg-ink text-paper" : "hover:bg-paper-2"}`}
                >
                  {l.label}
                </Link>
              );
            })}
          </nav>
          <div className="ml-auto flex items-center gap-3">
            {data?.exported_at && (
              <p className="hidden lg:block text-sm text-muted">
                Dati aggiornati {stamp(data.exported_at)}
              </p>
            )}
            <ThemeToggle />
          </div>
        </div>
        {!online && (
          <p className="bg-sand/20 border-t border-sand/40 text-sm text-center py-1.5" role="status">
            Sei offline: stai vedendo i dati salvati sul dispositivo.
          </p>
        )}
        {data?.demo && (
          <p className="bg-sand/20 border-t border-sand/40 text-sm px-4 py-1.5 text-center">
            Dati dimostrativi inventati: la prima raccolta reale non è ancora stata pubblicata.
          </p>
        )}
      </header>

      <main id="contenuto" className="flex-1 w-full max-w-[1320px] mx-auto px-4 md:px-8 pb-28 md:pb-16">
        <div key={path} className="page-in">
          {children}
        </div>
      </main>

      <footer className="hidden md:block border-t border-rule">
        <div className="max-w-[1320px] mx-auto px-8 py-6 flex flex-wrap gap-x-8 gap-y-2 text-sm text-muted">
          <p className="max-w-prose">Strumento di ricerca personale. I segnali sono ipotesi da verificare, non indicazioni di acquisto o vendita.</p>
          {data?.exported_at && <p className="lg:hidden">Dati aggiornati {stamp(data.exported_at)}</p>}
        </div>
      </footer>

      <InstallPrompt />
      <nav
        className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-paper/95 backdrop-blur-md border-t border-rule safe-bottom"
        aria-label="Sezioni principali"
      >
        <ul className="grid grid-cols-5">
          {NAV.map((l) => {
            const on = isActive(path, l.href);
            const Icon = l.icon;
            return (
              <li key={l.href}>
                <Link
                  href={l.href}
                  aria-current={on ? "page" : undefined}
                  className={`flex flex-col items-center justify-center gap-0.5 min-h-[58px] text-[0.7rem] ${on ? "text-ink" : "text-muted"}`}
                >
                  <span className={`grid place-items-center w-12 h-7 rounded-full transition-colors ${on ? "bg-seaglass-soft text-seaglass" : ""}`}>
                    <Icon />
                  </span>
                  <span className={on ? "font-semibold" : ""}>{l.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}

function useOnline() {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const up = () => setOnline(navigator.onLine);
    up();
    window.addEventListener("online", up);
    window.addEventListener("offline", up);
    return () => {
      window.removeEventListener("online", up);
      window.removeEventListener("offline", up);
    };
  }, []);
  return online;
}

export function RadarMark({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 30 30" aria-hidden>
      <circle cx="15" cy="15" r="13.5" fill="none" stroke="var(--ink)" strokeWidth="1.6" />
      <circle cx="15" cy="15" r="8.5" fill="none" stroke="var(--contour)" strokeWidth="1.2" />
      <circle cx="15" cy="15" r="3.5" fill="none" stroke="var(--contour)" strokeWidth="1.2" />
      <g style={{ transformOrigin: "15px 15px", animation: "sweep 6s linear infinite" }}>
        <path d="M15 15 L15 1.5 A13.5 13.5 0 0 1 24.5 5.4 Z" fill="var(--seaglass)" opacity="0.28" />
        <line x1="15" y1="15" x2="15" y2="1.5" stroke="var(--seaglass)" strokeWidth="2" strokeLinecap="round" />
      </g>
      <circle cx="20.5" cy="9" r="1.8" fill="var(--seaglass)" />
    </svg>
  );
}

function IconRadar() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="4.5" />
      <path d="M12 12 L18.4 5.6" strokeLinecap="round" />
    </svg>
  );
}
function IconLayers() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" aria-hidden>
      <path d="M12 3 3 8l9 5 9-5z" />
      <path d="m3 12.5 9 5 9-5" />
      <path d="m3 17 9 5 9-5" />
    </svg>
  );
}
function IconLog() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden>
      <path d="M4 19V5M4 19h16" />
      <path d="m7 15 4-4 3 3 5-6" />
    </svg>
  );
}
function IconLens() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" strokeLinejoin="round" />
      <circle cx="12" cy="12" r="3.2" />
    </svg>
  );
}
function IconMore() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <circle cx="5.5" cy="12" r="1.8" />
      <circle cx="12" cy="12" r="1.8" />
      <circle cx="18.5" cy="12" r="1.8" />
    </svg>
  );
}
