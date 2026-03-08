"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type SellerSnapshot = {
  id: string;
  seller_status: string;
  subscription_status: string;
  store_name: string;
};

export default function ProfilePage() {
  const [loading, setLoading] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [seller, setSeller] = useState<SellerSnapshot | null>(null);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!mounted) return;
      if (!user?.id) {
        setIsLoggedIn(false);
        setLoading(false);
        return;
      }

      setIsLoggedIn(true);
      const res = await fetch("/api/seller/onboarding", { cache: "no-store" });
      const body = (await res.json().catch(() => ({}))) as { seller?: SellerSnapshot | null };
      if (!mounted) return;

      setSeller(body.seller ?? null);
      setLoading(false);
    };

    void load();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50 p-4 md:p-8">
      <section className="mx-auto max-w-2xl grid gap-4">
        <h1 className="text-3xl font-black">Profil utilisateur</h1>

        {loading ? <p className="text-slate-300">Chargement du profil...</p> : null}

        {!loading && !isLoggedIn ? (
          <article className="rounded-2xl border border-slate-700 bg-slate-900/70 p-5 grid gap-3">
            <p>Connecte-toi pour gerer ton profil vendeur.</p>
            <Link href="/dashboard-login?redirect=/profile" className="rounded-xl bg-emerald-600 px-4 py-3 font-semibold text-center">
              Se connecter
            </Link>
          </article>
        ) : null}

        {!loading && isLoggedIn ? (
          <article className="rounded-2xl border border-slate-700 bg-slate-900/70 p-5 grid gap-3">
            {seller ? (
              <>
                <p>
                  Boutique: <strong>{seller.store_name}</strong>
                </p>
                <p>
                  Statut vendeur: <strong>{seller.seller_status}</strong>
                </p>
                <p>
                  Statut abonnement: <strong>{seller.subscription_status}</strong>
                </p>
                <div className="flex flex-wrap gap-2">
                  <Link href="/seller-verification" className="rounded-xl bg-sky-600 px-4 py-2 font-semibold">
                    Mes documents KYC
                  </Link>
                  <Link href="/vendeur/statut" className="rounded-xl bg-emerald-600 px-4 py-2 font-semibold">
                    Voir mon statut vendeur
                  </Link>
                </div>
              </>
            ) : (
              <>
                <p className="text-slate-300">Tu n'es pas encore vendeur.</p>
                <Link href="/seller-onboarding" className="rounded-xl bg-blue-600 px-4 py-3 font-bold text-center">
                  Devenir vendeur
                </Link>
              </>
            )}
          </article>
        ) : null}
      </section>
    </main>
  );
}
