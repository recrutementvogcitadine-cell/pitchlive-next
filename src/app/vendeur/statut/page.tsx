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
    const loadRegistration = () => {
      const raw = window.localStorage.getItem("pitchlive.seller.registration");
      if (!raw) {
        setRegistration(null);
        return;
      }

      try {
        const parsed = JSON.parse(raw) as SellerRegistration;
        setRegistration(parsed);

        if (parsed.status === "validated") {
          // Admin validation grants both seller and visitor access.
          window.localStorage.setItem(
            "pitchlive.access",
            JSON.stringify({ visitor: true, seller: true })
          );
          window.localStorage.setItem(
            "pitchlive.viewer",
            JSON.stringify({
              id: parsed.id,
              username: `${parsed.firstName} ${parsed.lastName}`.trim(),
              firstName: parsed.firstName,
              lastName: parsed.lastName,
              phone: parsed.phone,
              role: "seller+visitor",
              status: "validated",
              validatedBy: "admin",
            })
          );
        }
      } catch {
        setRegistration(null);
      }
    };

    loadRegistration();
    const poll = window.setInterval(loadRegistration, 2500);

    const onStorage = (event: StorageEvent) => {
      if (event.key === "pitchlive.seller.registration") {
        loadRegistration();
      }
    };
    window.addEventListener("storage", onStorage);

    return () => {
      window.clearInterval(poll);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const statusClass = useMemo(() => {
    if (!registration) return "text-slate-300";
    if (registration.status === "validated") return "text-emerald-300";
    if (registration.status === "refused") return "text-rose-300";
    return "text-amber-200";
  }, [registration]);

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
            <div className="grid gap-2 md:grid-cols-2">
              <Link href="/creator/studio" className="rounded-xl bg-emerald-600 px-4 py-3 font-bold text-center">
                Acceder au Studio Vendeur
              </Link>
              <Link href="/mur" className="rounded-xl bg-blue-600 px-4 py-3 font-bold text-center">
                Acceder au Mur Visiteur
              </Link>
            </div>
          ) : (
            <p className="text-sm text-slate-300">Attends la validation admin. Une fois valide, tu auras automatiquement les acces vendeur + visiteur.</p>
          )}

          <div className="mt-2 rounded-xl border border-slate-700 bg-slate-800/55 p-3 grid gap-2 text-xs text-slate-300">
            <p>Validation vendeur effectuee uniquement par admin.</p>
            <p>Espace admin local: <Link href="/admin/vendeurs" className="underline">/admin/vendeurs</Link></p>
          </div>
        </article>
      </section>
    </main>
  );
}
