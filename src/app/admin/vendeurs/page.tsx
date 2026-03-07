"use client";

import { useEffect, useState } from "react";

type SellerRegistration = {
  id: string;
  firstName: string;
  lastName: string;
  storeName: string;
  phone: string;
  plan: "jour" | "semaine" | "mois";
  planStartAt: string;
  planEndAt: string;
  status: "pending" | "validated" | "refused";
  createdAt?: string;
};

export default function AdminVendeursPage() {
  const [registration, setRegistration] = useState<SellerRegistration | null>(null);

  const loadRegistration = () => {
    const raw = window.localStorage.getItem("pitchlive.seller.registration");
    if (!raw) {
      setRegistration(null);
      return;
    }

    try {
      setRegistration(JSON.parse(raw) as SellerRegistration);
    } catch {
      setRegistration(null);
    }
  };

  useEffect(() => {
    loadRegistration();
  }, []);

  const setStatus = (status: SellerRegistration["status"]) => {
    if (!registration) return;
    const next = { ...registration, status };
    setRegistration(next);
    window.localStorage.setItem("pitchlive.seller.registration", JSON.stringify(next));
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 px-4 py-8 md:p-10">
      <section className="mx-auto max-w-3xl grid gap-5">
        <h1 className="text-3xl font-black">Admin Validation Vendeurs</h1>
        <p className="text-sm text-slate-300">Page admin locale pour valider/refuser les demandes vendeurs.</p>

        {!registration ? (
          <article className="rounded-2xl border border-slate-700 bg-slate-900/70 p-5">
            <p>Aucune demande vendeur en attente.</p>
          </article>
        ) : (
          <article className="rounded-2xl border border-slate-700 bg-slate-900/70 p-5 grid gap-3">
            <p>
              Vendeur: <strong>{registration.firstName} {registration.lastName}</strong>
            </p>
            <p>
              Boutique: <strong>{registration.storeName}</strong>
            </p>
            <p>
              Telephone: <strong>{registration.phone}</strong>
            </p>
            <p>
              Forfait: <strong>{registration.plan.toUpperCase()}</strong>
            </p>
            <p>
              Statut actuel: <strong>{registration.status.toUpperCase()}</strong>
            </p>

            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => setStatus("pending")} className="rounded-full bg-amber-700 px-3 py-2 text-sm font-semibold">
                Mettre en attente
              </button>
              <button type="button" onClick={() => setStatus("validated")} className="rounded-full bg-emerald-700 px-3 py-2 text-sm font-semibold">
                Valider
              </button>
              <button type="button" onClick={() => setStatus("refused")} className="rounded-full bg-rose-700 px-3 py-2 text-sm font-semibold">
                Refuser
              </button>
              <button type="button" onClick={loadRegistration} className="rounded-full bg-slate-700 px-3 py-2 text-sm font-semibold">
                Recharger
              </button>
            </div>
          </article>
        )}
      </section>
    </main>
  );
}
