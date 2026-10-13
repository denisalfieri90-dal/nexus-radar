"use client";

import { useEffect, useState } from "react";
import { RadarMark } from "./shell";

export type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

declare global {
  interface Window {
    __nexusInstall?: InstallEvent | null;
  }
}

/** Script nel <head>: cattura l'invito all'installazione di Android anche se arriva prima di React. */
export const installBootScript = `window.addEventListener('beforeinstallprompt',function(e){e.preventDefault();window.__nexusInstall=e;window.dispatchEvent(new Event('nexus-install-ready'))});`;

const DISMISS_KEY = "nexus-install-dismissed";

export function useInstall() {
  const [event, setEvent] = useState<InstallEvent | null>(null);
  const [standalone, setStandalone] = useState(true);
  const [platform, setPlatform] = useState<"ios" | "android" | "other">("other");

  useEffect(() => {
    const ua = navigator.userAgent;
    setPlatform(/iphone|ipad|ipod/i.test(ua) ? "ios" : /android/i.test(ua) ? "android" : "other");
    setStandalone(matchMedia("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true);
    const sync = () => setEvent(window.__nexusInstall ?? null);
    sync();
    const done = () => {
      window.__nexusInstall = null;
      setStandalone(true);
    };
    window.addEventListener("nexus-install-ready", sync);
    window.addEventListener("appinstalled", done);
    return () => {
      window.removeEventListener("nexus-install-ready", sync);
      window.removeEventListener("appinstalled", done);
    };
  }, []);

  async function install() {
    if (!event) return false;
    await event.prompt();
    const r = await event.userChoice;
    window.__nexusInstall = null;
    setEvent(null);
    if (r.outcome === "accepted") setStandalone(true);
    return r.outcome === "accepted";
  }

  return { event, standalone, platform, install };
}

/** Invito a installare l'app, solo sul telefono e solo finché non è installata. */
export function InstallPrompt() {
  const { event, standalone, platform, install } = useInstall();
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    try {
      const t = Number(localStorage.getItem(DISMISS_KEY) ?? 0);
      setHidden(Date.now() - t < 7 * 864e5);
    } catch {
      setHidden(false);
    }
  }, []);

  const show = !standalone && !hidden && (platform === "ios" || (platform === "android" && !!event));
  if (!show) return null;

  function dismiss() {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {}
    setHidden(true);
  }

  return (
    <div className="md:hidden fixed inset-x-3 z-40 rise" style={{ bottom: "calc(env(safe-area-inset-bottom) + 70px)" }} role="dialog" aria-label="Installa Nexus">
      <div className="bg-ink text-paper rounded-2xl px-4 py-3.5 shadow-[0_10px_30px_rgba(0,0,0,0.35)] flex items-center gap-3">
        <span className="shrink-0 grid place-items-center w-11 h-11 rounded-xl bg-[#0b1d2b]">
          <RadarMark size={28} />
        </span>
        <div className="flex-1 min-w-0">
          <p className="font-semibold leading-tight">Installa Nexus sul telefono</p>
          {platform === "ios" ? (
            <p className="text-sm opacity-80 leading-snug mt-0.5">
              Tocca{" "}
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="inline -mt-1" aria-label="Condividi">
                <path d="M12 3v12M8 7l4-4 4 4M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>{" "}
              e poi &ldquo;Aggiungi alla schermata Home&rdquo;.
            </p>
          ) : (
            <p className="text-sm opacity-80 leading-snug mt-0.5">A schermo intero, anche offline.</p>
          )}
        </div>
        {platform === "android" && event && (
          <button onClick={install} className="shrink-0 bg-paper text-ink rounded-full px-4 min-h-10 font-semibold">
            Installa
          </button>
        )}
        <button onClick={dismiss} className="shrink-0 w-9 h-9 grid place-items-center opacity-70 hover:opacity-100" aria-label="Chiudi l'invito">
          <svg width="16" height="16" viewBox="0 0 20 20" stroke="currentColor" strokeWidth="2" aria-hidden>
            <path d="M5 5l10 10M15 5 5 15" strokeLinecap="round" />
          </svg>
        </button>
      </div>
    </div>
  );
}
