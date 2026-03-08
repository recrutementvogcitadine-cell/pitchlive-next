"use client";

import { useEffect, useState } from "react";
import AdminShell from "@/components/admin/AdminShell";

type Stats = {
  totalUsers: number;
  totalSellers: number;
  activeSellers: number;
  liveNow: number;
  totalViewers: number;
};

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        const res = await fetch("/api/admin/stats", { cache: "no-store" });
        const body = (await res.json().catch(() => ({}))) as { totals?: Stats; error?: string };
        if (!res.ok) throw new Error(body.error || "Erreur chargement statistiques");

        if (!mounted) return;
        setStats(body.totals ?? null);
      } catch (err) {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : "Erreur inconnue");
      }
    };

    void load();
    const timer = window.setInterval(() => void load(), 7000);
    return () => {
      mounted = false;
      window.clearInterval(timer);
    };
  }, []);

  return (
    <AdminShell title="Dashboard principal">
      {error ? <p className="text-red-300">Erreur: {error}</p> : null}
      <section className="grid sm:grid-cols-2 xl:grid-cols-5 gap-3">
        {[
          ["Nombre total d'utilisateurs", stats?.totalUsers ?? 0],
          ["Nombre total de vendeurs", stats?.totalSellers ?? 0],
          ["Vendeurs actifs", stats?.activeSellers ?? 0],
          ["Lives en cours", stats?.liveNow ?? 0],
          ["Nombre total de spectateurs", stats?.totalViewers ?? 0],
        ].map(([label, value]) => (
          <article key={String(label)} className="rounded-2xl border border-slate-700 bg-slate-900/70 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-400">{label}</p>
            <p className="text-3xl font-black mt-2">{Number(value).toLocaleString("fr-FR")}</p>
          </article>
        ))}
      </section>
    </AdminShell>
  );
}
