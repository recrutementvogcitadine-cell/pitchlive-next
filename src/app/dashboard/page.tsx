"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { DashboardStats } from "@/lib/types";

export default function DashboardPage() {
  const supabase = useMemo(() => createClient(), []);
  const [stats, setStats] = useState<DashboardStats>({
    activeLives: 0,
    totalMessages: 0,
    totalLikes: 0,
    totalGifts: 0,
    totalFollowers: 0,
  });

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      const [lives, messages, likes, gifts, followers] = await Promise.all([
        supabase.from("live_sessions").select("id", { count: "exact", head: true }).eq("status", "live"),
        supabase.from("messages").select("id", { count: "exact", head: true }),
        supabase.from("likes").select("id", { count: "exact", head: true }),
        supabase.from("gifts").select("id", { count: "exact", head: true }),
        supabase.from("followers").select("creator_id", { count: "exact", head: true }),
      ]);

      if (!mounted) return;

      setStats({
        activeLives: lives.count ?? 0,
        totalMessages: messages.count ?? 0,
        totalLikes: likes.count ?? 0,
        totalGifts: gifts.count ?? 0,
        totalFollowers: followers.count ?? 0,
      });
    };

    void load();

    const channel = supabase
      .channel("dashboard-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "live_sessions" }, () => void load())
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, () => void load())
      .on("postgres_changes", { event: "*", schema: "public", table: "likes" }, () => void load())
      .on("postgres_changes", { event: "*", schema: "public", table: "gifts" }, () => void load())
      .on("postgres_changes", { event: "*", schema: "public", table: "followers" }, () => void load())
      .subscribe();

    return () => {
      mounted = false;
      void supabase.removeChannel(channel);
    };
  }, [supabase]);

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50 p-4 md:p-8">
      <section className="mx-auto max-w-5xl grid gap-4">
        <header className="flex justify-between items-center flex-wrap gap-3">
          <h1 className="text-2xl md:text-3xl font-bold">Dashboard Administrateur</h1>
          <div className="flex gap-2">
            <Link href="/dashboard-login?redirect=/dashboard" className="rounded-full bg-slate-700 px-4 py-2 font-semibold">Login Dashboard</Link>
            <Link href="/watch" className="rounded-full bg-emerald-600 px-4 py-2 font-semibold">Watch</Link>
            <Link href="/creator/studio" className="rounded-full bg-orange-500 px-4 py-2 font-semibold">Studio vendeur</Link>
            <Link href="/creator/settings" className="rounded-full bg-violet-600 px-4 py-2 font-semibold">Parametres vendeur</Link>
          </div>
        </header>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <StatCard label="Lives actifs" value={stats.activeLives} />
          <StatCard label="Messages" value={stats.totalMessages} />
          <StatCard label="Likes" value={stats.totalLikes} />
          <StatCard label="Cadeaux" value={stats.totalGifts} />
          <StatCard label="Abonnes vendeur" value={stats.totalFollowers} />
        </div>

        <article className="rounded-2xl border border-slate-700 bg-slate-900/70 p-4 md:p-5 grid gap-2 text-sm text-slate-300">
          <h2 className="font-semibold text-slate-100">Gestion contenu</h2>
          <p>Ce dashboard centralise les interactions live en temps reel pour moderation et pilotage.</p>
          <p>Moderation mots interdits activee via variable serveur `MODERATION_BANNED_WORDS`.</p>
          <p>Ajoute ensuite tes workflows custom: blacklist users, alerts et scoring risque.</p>
          <a
            href="/api/dashboard/export"
            className="inline-flex w-fit rounded-full bg-sky-600 px-4 py-2 text-white font-semibold"
          >
            Export CSV analytics
          </a>
        </article>
      </section>
    </main>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <article className="rounded-2xl border border-slate-700 bg-slate-900/70 p-4">
      <p className="text-xs uppercase tracking-wide text-slate-400">{label}</p>
      <p className="text-2xl font-extrabold mt-1">{value.toLocaleString("fr-FR")}</p>
    </article>
  );
}
