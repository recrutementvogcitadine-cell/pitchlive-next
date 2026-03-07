"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

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
};

function formatStatus(status: SellerRegistration["status"]) {
  if (status === "validated") return "VALIDE";
  if (status === "refused") return "REFUSE";
  return "EN ATTENTE";
}

export default function VendeurStatutPage() {
  const [registration, setRegistration] = useState<SellerRegistration | null>(null);

  useEffect(() => {
    const raw = window.localStorage.getItem("pitchlive.seller.registration");
    if (!raw) return;

    try {
      setRegistration(JSON.parse(raw) as SellerRegistration);
    } catch {
      setRegistration(null);
    }
  }, []);

  const statusClass = useMemo(() => {
    if (!registration) return "text-slate-300";
    if (registration.status === "validated") return "text-emerald-300";
    if (registration.status === "refused") return "text-rose-300";
    return "text-amber-200";
  }, [registration]);

  const simulateValidation = (status: SellerRegistration["status"]) => {
    if (!registration) return;
    const next = { ...registration, status };
    setRegistration(next);
    window.localStorage.setItem("pitchlive.seller.registration", JSON.stringify(next));
  };

  if (!registration) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-100 p-6 grid place-items-center">
        <div className="rounded-2xl border border-slate-700 bg-slate-900/70 p-6 text-center grid gap-3">
          <p>Aucune inscription vendeur trouvee.</p>
          <Link href="/vendeur/inscription" className="rounded-full bg-blue-600 px-4 py-2 font-semibold">
            Commencer l'inscription vendeur
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 px-4 py-8 md:p-10">
      <section className="mx-auto max-w-2xl grid gap-5">
        <h1 className="text-3xl font-black">Statut de validation vendeur</h1>

        <article className="rounded-2xl border border-slate-700 bg-slate-900/70 p-4 md:p-6 grid gap-3">
          <p>
            Boutique: <strong>{registration.storeName}</strong>
          </p>
          <p>
            Vendeur: <strong>{registration.firstName} {registration.lastName}</strong>
          </p>
          <p>
            Telephone: <strong>{registration.phone}</strong>
          </p>
          <p>
            Forfait: <strong>{registration.plan.toUpperCase()}</strong>
          </p>
          <p className={statusClass}>
            Statut: <strong>{formatStatus(registration.status)}</strong>
          </p>

          {registration.status === "validated" ? (
            <Link href="/creator/studio" className="rounded-xl bg-emerald-600 px-4 py-3 font-bold text-center">
              Acceder au Studio Vendeur
            </Link>
          ) : (
            <p className="text-sm text-slate-300">Attends la validation admin. Une fois valide, le studio sera accessible.</p>
          )}

          <div className="mt-2 rounded-xl border border-slate-700 bg-slate-800/55 p-3 grid gap-2">
            <p className="text-xs text-slate-300">Simulation locale (admin) pour test:</p>
            <div className="flex gap-2 flex-wrap">
              <button type="button" onClick={() => simulateValidation("pending")} className="rounded-full bg-amber-700 px-3 py-2 text-xs font-semibold">
                Mettre EN ATTENTE
              </button>
              <button type="button" onClick={() => simulateValidation("validated")} className="rounded-full bg-emerald-700 px-3 py-2 text-xs font-semibold">
                Mettre VALIDE
              </button>
              <button type="button" onClick={() => simulateValidation("refused")} className="rounded-full bg-rose-700 px-3 py-2 text-xs font-semibold">
                Mettre REFUSE
              </button>
            </div>
          </div>
        </article>
      </section>
    </main>
  );
}
