"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type AccessState = {
  visitor?: boolean;
  seller?: boolean;
};

export default function ChoixModePage() {
  const [authorized, setAuthorized] = useState<boolean | null>(null);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem("pitchlive.access");
      const access = raw ? (JSON.parse(raw) as AccessState) : null;

      if (access?.seller) {
        setAuthorized(true);
        return;
      }

      setAuthorized(false);
      window.location.href = "/mur";
    } catch {
      setAuthorized(false);
      window.location.href = "/login";
    }
  }, []);

  if (authorized === null) {
    return <main className="min-h-screen bg-slate-950 text-slate-100 grid place-items-center">Chargement...</main>;
  }

  if (!authorized) {
    return <main className="min-h-screen bg-slate-950 text-slate-100 grid place-items-center">Redirection...</main>;
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 px-4 py-8 md:p-10">
      <section className="mx-auto max-w-2xl grid gap-5">
        <h1 className="text-3xl font-black text-center">Choisir le mode</h1>
        <p className="text-center text-slate-300">Compte vendeur valide: tu peux utiliser le mode vendeur et le mode visiteur.</p>

        <article className="rounded-2xl border border-slate-700 bg-slate-900/70 p-5 grid gap-3">
          <Link href="/creator/studio" className="rounded-xl bg-emerald-600 px-4 py-4 font-bold text-center text-lg">
            Mode Vendeur (Studio)
          </Link>
          <Link href="/mur" className="rounded-xl bg-blue-600 px-4 py-4 font-bold text-center text-lg">
            Mode Visiteur (Mur)
          </Link>
        </article>
      </section>
    </main>
  );
}
