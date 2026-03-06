"use client";

import Link from "next/link";
import { useMemo, useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";

function resolveRedirectTarget() {
  if (typeof window === "undefined") return "/dashboard";
  const params = new URLSearchParams(window.location.search);
  const redirect = (params.get("redirect") ?? "/dashboard").trim();
  if (!redirect.startsWith("/")) return "/dashboard";
  if (redirect.startsWith("//")) return "/dashboard";
  return redirect;
}

export default function DashboardLoginPage() {
  const supabase = useMemo(() => createClient(), []);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError(null);

    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (signInError) throw signInError;

      const accessResponse = await fetch("/api/dashboard/access", { cache: "no-store" });
      if (!accessResponse.ok) {
        throw new Error("forbidden");
      }

      window.location.href = resolveRedirectTarget();
    } catch (err: unknown) {
      const text = String((err as { message?: string })?.message ?? err ?? "").toLowerCase();
      if (text.includes("invalid login credentials")) {
        setError("Email ou mot de passe incorrect.");
      } else if (text.includes("forbidden")) {
        setError("Acces refuse: role admin/agent/proprietaire requis.");
      } else {
        setError("Connexion impossible.");
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50 grid place-items-center p-4">
      <section className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900/70 p-5 grid gap-4">
        <Link href="/watch" className="text-sm text-emerald-300 hover:text-emerald-200">← Retour watch</Link>
        <h1 className="text-2xl font-bold">Connexion Dashboard</h1>
        <p className="text-sm text-slate-300">Reserve au proprietaire, admins et agents.</p>

        <form onSubmit={onSubmit} className="grid gap-3">
          <input
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="vous@domaine.com"
            className="rounded-xl border border-slate-600 bg-slate-800 px-3 py-2"
          />

          <input
            type="password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Mot de passe"
            className="rounded-xl border border-slate-600 bg-slate-800 px-3 py-2"
          />

          <button type="submit" disabled={busy} className="rounded-xl bg-emerald-600 py-2.5 font-semibold disabled:opacity-60">
            {busy ? "Connexion..." : "Se connecter"}
          </button>
        </form>

        {error ? <p className="text-sm text-red-300">{error}</p> : null}
      </section>
    </main>
  );
}
