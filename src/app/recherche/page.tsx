"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getValidatedStores } from "@/lib/boutique-data";
import { createClient } from "@/lib/supabase/client";

type LiveSessionRow = {
  creator_id: string;
  status: "live" | "ended";
};

export default function RecherchePage() {
  const stores = useMemo(() => getValidatedStores(), []);
  const [query, setQuery] = useState("");
  const [liveBySeller, setLiveBySeller] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const supabase = createClient();
    let mounted = true;

    const loadLiveStatuses = async () => {
      const { data } = await supabase
        .from("live_sessions")
        .select("creator_id,status")
        .eq("status", "live")
        .returns<LiveSessionRow[]>();

      if (!mounted) return;

      const next: Record<string, boolean> = {};
      for (const row of data ?? []) {
        next[row.creator_id] = row.status === "live";
      }
      setLiveBySeller(next);
    };

    void loadLiveStatuses();

    const channel = supabase
      .channel("search-live-status")
      .on("postgres_changes", { event: "*", schema: "public", table: "live_sessions" }, () => void loadLiveStatuses())
      .subscribe();

    return () => {
      mounted = false;
      void supabase.removeChannel(channel);
    };
  }, []);

  const normalizedQuery = query.trim().toLowerCase();
  const results = stores.filter((seller) => {
    if (!normalizedQuery) return true;
    return (
      seller.displayName.toLowerCase().includes(normalizedQuery) ||
      seller.tagline.toLowerCase().includes(normalizedQuery) ||
      seller.id.toLowerCase().includes(normalizedQuery)
    );
  });

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8">
      <section className="mx-auto max-w-6xl grid gap-5">
        <header className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">Recherche boutiques et vendeurs</h1>
            <p className="text-sm text-slate-300">Trouve rapidement une boutique et accede directement au live ou a la boutique.</p>
          </div>
          <Link href="/boutique" className="rounded-full bg-slate-700 px-4 py-2 font-semibold">
            Toutes les boutiques
          </Link>
        </header>

        <div className="rounded-2xl border border-slate-700 bg-slate-900/70 p-4">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Rechercher vendeur, boutique, activite..."
            className="w-full rounded-xl border border-slate-600 bg-slate-800 px-4 py-3 text-sm outline-none"
          />
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {results.map((seller) => {
            const isLive = Boolean(liveBySeller[seller.id]);

            return (
              <article key={seller.id} className="rounded-2xl border border-slate-700 bg-slate-900/70 p-4 grid gap-3">
                <div className="flex items-center gap-3">
                  <img
                    src={`https://api.dicebear.com/7.x/thumbs/svg?seed=${encodeURIComponent(seller.displayName)}`}
                    alt={`Logo ${seller.displayName}`}
                    className="h-12 w-12 rounded-full border border-slate-500 bg-slate-800"
                  />
                  <div>
                    <h2 className="font-semibold">{seller.displayName}</h2>
                    <p className={`text-xs font-semibold ${isLive ? "text-emerald-300" : "text-slate-400"}`}>
                      {isLive ? "En live" : "Hors ligne"}
                    </p>
                  </div>
                </div>

                <p className="text-sm text-slate-300">{seller.tagline}</p>

                <div className="flex gap-2 flex-wrap">
                  <Link href={`/boutique/${encodeURIComponent(seller.id)}`} className="rounded-full bg-orange-500 px-3 py-2 text-xs font-semibold">
                    Ouvrir boutique
                  </Link>
                  <Link href="/watch" className={`rounded-full px-3 py-2 text-xs font-semibold ${isLive ? "bg-emerald-600" : "bg-slate-700"}`}>
                    {isLive ? "Rejoindre live" : "Voir lives"}
                  </Link>
                </div>
              </article>
            );
          })}
        </div>

        {!results.length ? (
          <article className="rounded-2xl border border-slate-700 bg-slate-900/70 p-5 text-sm text-slate-300">
            Aucun resultat. Essaie avec le nom du vendeur ou un mot-cle de la boutique.
          </article>
        ) : null}
      </section>
    </main>
  );
}
