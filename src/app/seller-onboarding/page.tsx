"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type SellerPayload = {
  storeName: string;
  whatsappNumber: string;
  category: string;
  country: string;
  city: string;
};

const INITIAL_STATE: SellerPayload = {
  storeName: "",
  whatsappNumber: "",
  category: "",
  country: "",
  city: "",
};

export default function SellerOnboardingPage() {
  const [form, setForm] = useState<SellerPayload>(INITIAL_STATE);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      const res = await fetch("/api/seller/onboarding", { cache: "no-store" });
      if (res.status === 401) {
        window.location.href = "/dashboard-login?redirect=/seller-onboarding";
        return;
      }

      const body = (await res.json().catch(() => ({}))) as {
        seller?: {
          store_name?: string;
          whatsapp_number?: string;
          category?: string;
          country?: string;
          city?: string;
        } | null;
      };

      if (!mounted || !body.seller) return;
      setForm({
        storeName: body.seller.store_name ?? "",
        whatsappNumber: body.seller.whatsapp_number ?? "",
        category: body.seller.category ?? "",
        country: body.seller.country ?? "",
        city: body.seller.city ?? "",
      });
    };

    void load();
    return () => {
      mounted = false;
    };
  }, []);

  const onChange = (key: keyof SellerPayload, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const onSubmit = async () => {
    setError(null);
    setBusy(true);

    try {
      const res = await fetch("/api/seller/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        throw new Error(body.error || "Impossible de sauvegarder le profil vendeur");
      }

      window.location.href = "/seller-verification";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inattendue");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50 p-4 md:p-8">
      <section className="mx-auto max-w-2xl grid gap-4">
        <h1 className="text-3xl font-black">Seller Onboarding</h1>
        <p className="text-slate-300">Renseigne ton profil vendeur avant l'etape de verification KYC.</p>

        <article className="rounded-2xl border border-slate-700 bg-slate-900/70 p-5 grid gap-3">
          <label className="grid gap-1 text-sm">
            Nom de la boutique
            <input value={form.storeName} onChange={(event) => onChange("storeName", event.target.value)} className="rounded-xl border border-slate-600 bg-slate-800 px-3 py-2" />
          </label>

          <label className="grid gap-1 text-sm">
            Numero WhatsApp
            <input value={form.whatsappNumber} onChange={(event) => onChange("whatsappNumber", event.target.value)} className="rounded-xl border border-slate-600 bg-slate-800 px-3 py-2" />
          </label>

          <label className="grid gap-1 text-sm">
            Categorie de vente
            <input value={form.category} onChange={(event) => onChange("category", event.target.value)} className="rounded-xl border border-slate-600 bg-slate-800 px-3 py-2" />
          </label>

          <div className="grid sm:grid-cols-2 gap-3">
            <label className="grid gap-1 text-sm">
              Pays
              <input value={form.country} onChange={(event) => onChange("country", event.target.value)} className="rounded-xl border border-slate-600 bg-slate-800 px-3 py-2" />
            </label>
            <label className="grid gap-1 text-sm">
              Ville
              <input value={form.city} onChange={(event) => onChange("city", event.target.value)} className="rounded-xl border border-slate-600 bg-slate-800 px-3 py-2" />
            </label>
          </div>

          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => void onSubmit()} disabled={busy} className="rounded-xl bg-blue-600 px-4 py-3 font-bold disabled:opacity-50">
              {busy ? "Sauvegarde..." : "Continuer"}
            </button>
            <Link href="/profile" className="rounded-xl bg-slate-700 px-4 py-3 font-semibold">
              Retour profil
            </Link>
          </div>

          {error ? <p className="text-red-300 text-sm">Erreur: {error}</p> : null}
        </article>
      </section>
    </main>
  );
}
