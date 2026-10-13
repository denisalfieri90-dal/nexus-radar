"use client";

import { useEffect, useState } from "react";

export type ThemeChoice = "light" | "system" | "dark";
const KEY = "nexus-theme";
const COLORS = { light: "#e9ede7", dark: "#0b1d2b" };

/** Script eseguito prima del primo disegno: niente lampo di tema sbagliato. */
export const themeBootScript = `(function(){try{var t=localStorage.getItem('${KEY}');if(t==='"light"'||t==='"dark"'){document.documentElement.dataset.theme=JSON.parse(t)}}catch(e){}})();`;

function apply(choice: ThemeChoice) {
  const root = document.documentElement;
  if (choice === "system") delete root.dataset.theme;
  else root.dataset.theme = choice;
  const dark = choice === "dark" || (choice === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute("content", dark ? COLORS.dark : COLORS.light));
}

export function useTheme(): [ThemeChoice, (c: ThemeChoice) => void] {
  const [choice, setChoice] = useState<ThemeChoice>("system");
  useEffect(() => {
    let saved: ThemeChoice = "system";
    try {
      saved = (JSON.parse(localStorage.getItem(KEY) ?? '"system"') as ThemeChoice) || "system";
    } catch {}
    setChoice(saved);
    apply(saved);
    const mq = matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => apply((JSON.parse(localStorage.getItem(KEY) ?? '"system"') as ThemeChoice) || "system");
    mq.addEventListener("change", onChange);
    const sync = () => {
      const c = (JSON.parse(localStorage.getItem(KEY) ?? '"system"') as ThemeChoice) || "system";
      setChoice(c);
    };
    window.addEventListener("nexus-theme", sync);
    return () => {
      mq.removeEventListener("change", onChange);
      window.removeEventListener("nexus-theme", sync);
    };
  }, []);
  return [
    choice,
    (c) => {
      try {
        localStorage.setItem(KEY, JSON.stringify(c));
      } catch {}
      setChoice(c);
      apply(c);
      window.dispatchEvent(new Event("nexus-theme"));
    },
  ];
}

const OPTIONS: { value: ThemeChoice; label: string; icon: React.ReactNode }[] = [
  {
    value: "light",
    label: "Chiaro",
    icon: (
      <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
        <circle cx="10" cy="10" r="3.6" />
        <path d="M10 1.8v2.1M10 16.1v2.1M1.8 10h2.1M16.1 10h2.1M4.2 4.2l1.5 1.5M14.3 14.3l1.5 1.5M4.2 15.8l1.5-1.5M14.3 5.7l1.5-1.5" />
      </svg>
    ),
  },
  {
    value: "system",
    label: "Automatico",
    icon: (
      <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.6">
        <circle cx="10" cy="10" r="7" />
        <path d="M10 3a7 7 0 0 1 0 14z" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
  {
    value: "dark",
    label: "Scuro",
    icon: (
      <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round">
        <path d="M16.5 12.3A7 7 0 0 1 7.7 3.5a7 7 0 1 0 8.8 8.8z" />
      </svg>
    ),
  },
];

export function ThemeToggle({ withLabels = false }: { withLabels?: boolean }) {
  const [choice, setChoice] = useTheme();
  return (
    <div role="radiogroup" aria-label="Tema" className="inline-flex border border-rule rounded-full p-0.5 bg-paper-2">
      {OPTIONS.map((o) => {
        const on = choice === o.value;
        return (
          <button
            key={o.value}
            role="radio"
            aria-checked={on}
            aria-label={withLabels ? undefined : o.label}
            title={o.label}
            onClick={() => setChoice(o.value)}
            className={`inline-flex items-center gap-1.5 rounded-full transition-colors ${withLabels ? "px-3.5 min-h-11" : "w-9 h-9 justify-center"} ${
              on ? "bg-ink text-paper" : "text-muted hover:text-ink"
            }`}
          >
            {o.icon}
            {withLabels && <span className="text-sm">{o.label}</span>}
          </button>
        );
      })}
    </div>
  );
}
