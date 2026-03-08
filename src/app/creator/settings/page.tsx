"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getDefaultSellerProfile, normalizeWhatsappNumber, type SellerStoreProfile } from "@/lib/boutique-data";

const CURRENT_SELLER_ID = "main-creator";

export default function CreatorSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [storeName, setStoreName] = useState("");
  const [tagline, setTagline] = useState("");
  const [whatsappNumber, setWhatsappNumber] = useState("");

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      setLoading(true);
      setError(null);

      const fallback = getDefaultSellerProfile(CURRENT_SELLER_ID);
      if (fallback && mounted) {
        setStoreName(fallback.storeName);
        setTagline(fallback.tagline);
        setWhatsappNumber(fallback.whatsappNumber);
      }

      try {
        const res = await fetch(`/api/seller/profile?sellerId=${encodeURIComponent(CURRENT_SELLER_ID)}`, { cache: "no-store" });
        const body = (await res.json()) as { profile?: SellerStoreProfile | null };
        if (!mounted || !body.profile) return;

        setStoreName(body.profile.storeName);
        setTagline(body.profile.tagline);
        setWhatsappNumber(body.profile.whatsappNumber);
      } catch {
        // Keep fallback profile silently.
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void load();

    return () => {
      mounted = false;
    };
  }, []);

  const onSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const payload = {
        sellerId: CURRENT_SELLER_ID,
        storeName: storeName.trim(),
        tagline: tagline.trim(),
        whatsappNumber: normalizeWhatsappNumber(whatsappNumber),
      };

      const res = await fetch("/api/seller/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const body = (await res.json()) as { error?: string };
      if (!res.ok) {
        throw new Error(body.error || "Sauvegarde impossible");
      }

      setWhatsappNumber(payload.whatsappNumber);
      setSuccess("Parametres vendeur sauvegardes.");
      window.setTimeout(() => setSuccess(null), 1800);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erreur inattendue";
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50 px-4 py-6 md:p-8">
      <section className="mx-auto max-w-3xl grid gap-4">
        <header className="flex items-center justify-between flex-wrap gap-3">
          <h1 className="text-2xl md:text-3xl font-bold">Parametres vendeur</h1>
          <div className="flex gap-2">
            <Link href="/profile" className="rounded-full bg-blue-600 px-4 py-2 font-semibold">
              Profil / Devenir vendeur
            </Link>
            <Link href="/creator/studio" className="rounded-full bg-orange-500 px-4 py-2 font-semibold">
              Studio vendeur
            </Link>
            <Link href="/boutique/main-creator" className="rounded-full bg-emerald-600 px-4 py-2 font-semibold">
              Voir ma boutique
            </Link>
          </div>
        </header>

        <article className="rounded-2xl border border-slate-700 bg-slate-900/70 p-4 md:p-5 grid gap-4">
          {loading ? <p className="text-sm text-slate-300">Chargement des parametres...</p> : null}

          <label className="grid gap-1 text-sm">
            Nom de la boutique
            <input
              value={storeName}
              onChange={(event) => setStoreName(event.target.value)}
              className="rounded-xl border border-slate-600 bg-slate-800 px-3 py-2 outline-none"
              placeholder="Ex: Awa Store"
            />
          </label>

          <label className="grid gap-1 text-sm">
            Slogan boutique
            <input
              value={tagline}
              onChange={(event) => setTagline(event.target.value)}
              className="rounded-xl border border-slate-600 bg-slate-800 px-3 py-2 outline-none"
              placeholder="Ex: Mode femme premium"
            />
          </label>

          <label className="grid gap-1 text-sm">
            Numero WhatsApp vendeur
            <input
              value={whatsappNumber}
              onChange={(event) => setWhatsappNumber(event.target.value)}
              className="rounded-xl border border-slate-600 bg-slate-800 px-3 py-2 outline-none"
              placeholder="Ex: 2250701234567"
            />
            <span className="text-xs text-slate-400">Ce numero sera utilise sur chaque produit de ta boutique.</span>
          </label>

          <button
            type="button"
            disabled={saving}
            onClick={() => void onSave()}
            className="rounded-xl bg-emerald-600 px-4 py-3 font-bold disabled:opacity-50"
          >
            {saving ? "Sauvegarde..." : "Sauvegarder mes parametres"}
          </button>

          {error ? <p className="text-sm text-red-300">Erreur: {error}</p> : null}
          {success ? <p className="text-sm text-emerald-300">{success}</p> : null}
        </article>
      </section>
    </main>
  );
}
