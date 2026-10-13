"use client";

import Link from "next/link";
import { useEffect } from "react";

/** Indirizzo sbagliato (link copiato male, vecchio segnalibro): si torna al radar da soli. */
export default function NotFound() {
  useEffect(() => {
    const t = setTimeout(() => window.location.replace("/"), 1200);
    return () => clearTimeout(t);
  }, []);
  return (
    <div className="py-20 max-w-[40ch]" role="status">
      <h1 className="display text-[2.6rem]">Questa pagina non esiste</h1>
      <p className="mt-3">Ti riporto al radar.</p>
      <Link href="/" className="inline-flex items-center min-h-12 mt-4 bg-ink text-paper px-5">
        Vai al radar
      </Link>
    </div>
  );
}
