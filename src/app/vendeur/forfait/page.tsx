"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type SellerPlan = "jour" | "semaine" | "mois";

type SellerRegistration = {
  id: string;
  firstName: string;
  lastName: string;
  storeName: string;
  phone: string;
  plan: SellerPlan;
  planStartAt: string;
  planEndAt: string;
  planPriceCfa?: number;
  status: "pending" | "validated" | "refused";
};

type SellerPlanPricing = {
  jour: number;
  semaine: number;
  mois: number;
};

const SELLER_PRICING_KEY = "pitchlive.seller.planPricing.v1";
const SELLER_REGISTRATION_KEY = "pitchlive.seller.registration";
const SELLER_REGISTRATIONS_KEY = "pitchlive.seller.registrations.v1";

const DEFAULT_SELLER_PRICING: SellerPlanPricing = {
  jour: 5000,
  semaine: 25000,
  mois: 80000,
};

function formatCfa(value: number) {
  return `${Math.max(0, Math.floor(value)).toLocaleString("fr-FR")} F CFA`;
}

function computeEndDate(forfait: SellerPlan) {
  const start = new Date();
  const end = new Date(start);
  if (forfait === "jour") end.setDate(end.getDate() + 1);
  if (forfait === "semaine") end.setDate(end.getDate() + 7);
  if (forfait === "mois") end.setMonth(end.getMonth() + 1);
  return { start, end };
}

export default function VendeurForfaitPage() {
  const [registration, setRegistration] = useState<SellerRegistration | null>(null);
  const [pricing, setPricing] = useState<SellerPlanPricing>(DEFAULT_SELLER_PRICING);
  const [selectedPlan, setSelectedPlan] = useState<SellerPlan>("jour");
  const [busy, setBusy] = useState(false);
  const [info, setInfo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const rawRegistration = window.localStorage.getItem(SELLER_REGISTRATION_KEY);
    if (rawRegistration) {
      try {
        const parsed = JSON.parse(rawRegistration) as SellerRegistration;
        setRegistration(parsed);
        setSelectedPlan(parsed.plan || "jour");
      } catch {
        setRegistration(null);
      }
    }

    const rawPricing = window.localStorage.getItem(SELLER_PRICING_KEY);
    if (rawPricing) {
      try {
        const parsed = JSON.parse(rawPricing) as Partial<SellerPlanPricing>;
        setPricing({
          jour: Number.isFinite(parsed.jour) ? Math.max(0, Number(parsed.jour)) : DEFAULT_SELLER_PRICING.jour,
          semaine: Number.isFinite(parsed.semaine) ? Math.max(0, Number(parsed.semaine)) : DEFAULT_SELLER_PRICING.semaine,
          mois: Number.isFinite(parsed.mois) ? Math.max(0, Number(parsed.mois)) : DEFAULT_SELLER_PRICING.mois,
        });
      } catch {
        setPricing(DEFAULT_SELLER_PRICING);
      }
    }
  }, []);

  const planPrice = useMemo(() => {
    if (selectedPlan === "jour") return pricing.jour;
    if (selectedPlan === "semaine") return pricing.semaine;
    return pricing.mois;
  }, [selectedPlan, pricing]);

  const renewForfait = () => {
    if (!registration) {
      setError("Aucun compte vendeur detecte. Inscris-toi d'abord.");
      return;
    }

    setBusy(true);
    setError(null);

    try {
      const { start, end } = computeEndDate(selectedPlan);
      const next: SellerRegistration = {
        ...registration,
        plan: selectedPlan,
        planStartAt: start.toISOString(),
        planEndAt: end.toISOString(),
        planPriceCfa: planPrice,
      };

      window.localStorage.setItem(SELLER_REGISTRATION_KEY, JSON.stringify(next));

      const rawList = window.localStorage.getItem(SELLER_REGISTRATIONS_KEY);
      if (rawList) {
        try {
          const parsed = JSON.parse(rawList) as SellerRegistration[];
          const nextList = Array.isArray(parsed)
            ? [next, ...parsed.filter((item) => item.id !== next.id)]
            : [next];
          window.localStorage.setItem(SELLER_REGISTRATIONS_KEY, JSON.stringify(nextList));
        } catch {
          window.localStorage.setItem(SELLER_REGISTRATIONS_KEY, JSON.stringify([next]));
        }
      } else {
        window.localStorage.setItem(SELLER_REGISTRATIONS_KEY, JSON.stringify([next]));
      }

      if (next.status === "validated") {
        window.localStorage.setItem("pitchlive.access", JSON.stringify({ visitor: true, seller: true }));
      } else {
        window.localStorage.setItem("pitchlive.access", JSON.stringify({ visitor: false, seller: true }));
      }

      setInfo("Forfait renouvelle avec succes.");
      window.setTimeout(() => {
        window.location.href = "/creator/studio";
      }, 800);
    } catch {
      setError("Renouvellement impossible pour le moment.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50 px-4 py-8 md:p-10">
      <section className="mx-auto max-w-xl grid gap-5">
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-3xl font-black">Renouveler mon forfait</h1>
          <Link href="/" className="rounded-full bg-slate-700 px-3 py-2 text-sm font-semibold">
            Retour accueil
          </Link>
        </div>

        {!registration ? (
          <article className="rounded-2xl border border-slate-700 bg-slate-900/70 p-5 grid gap-3">
            <p>Aucun compte vendeur detecte.</p>
            <Link href="/vendeur/inscription" className="rounded-xl bg-emerald-600 px-4 py-3 font-bold text-center">
              Aller au formulaire vendeur
            </Link>
          </article>
        ) : (
          <article className="rounded-2xl border border-slate-700 bg-slate-900/70 p-5 grid gap-4">
            <p>
              Vendeur: <strong>{registration.firstName} {registration.lastName}</strong>
            </p>
            <p>
              Boutique: <strong>{registration.storeName}</strong>
            </p>
            <p className="text-sm text-slate-300">
              Debut actuel: <strong>{registration.planStartAt ? new Date(registration.planStartAt).toLocaleString("fr-FR") : "--"}</strong>
              {" "}• Fin actuelle: <strong>{registration.planEndAt ? new Date(registration.planEndAt).toLocaleString("fr-FR") : "--"}</strong>
            </p>

            <fieldset className="grid gap-2">
              <legend className="text-sm">Choisir un nouveau forfait</legend>
              <div className="grid gap-2 sm:grid-cols-3">
                <button
                  type="button"
                  onClick={() => setSelectedPlan("jour")}
                  className={`rounded-xl px-3 py-3 font-semibold border ${selectedPlan === "jour" ? "bg-emerald-600 border-emerald-400" : "bg-slate-800 border-slate-600"}`}
                >
                  JOUR {formatCfa(pricing.jour)}
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedPlan("semaine")}
                  className={`rounded-xl px-3 py-3 font-semibold border ${selectedPlan === "semaine" ? "bg-emerald-600 border-emerald-400" : "bg-slate-800 border-slate-600"}`}
                >
                  SEMAINE {formatCfa(pricing.semaine)}
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedPlan("mois")}
                  className={`rounded-xl px-3 py-3 font-semibold border ${selectedPlan === "mois" ? "bg-emerald-600 border-emerald-400" : "bg-slate-800 border-slate-600"}`}
                >
                  MOIS {formatCfa(pricing.mois)}
                </button>
              </div>
            </fieldset>

            <button
              type="button"
              onClick={renewForfait}
              disabled={busy}
              className="rounded-xl bg-blue-600 px-4 py-3 font-bold disabled:opacity-50"
            >
              {busy ? "Renouvellement..." : `Souscrire a nouveau (${formatCfa(planPrice)})`}
            </button>

            {info ? <p className="text-sm text-emerald-300">{info}</p> : null}
            {error ? <p className="text-sm text-red-300">Erreur: {error}</p> : null}
          </article>
        )}
      </section>
    </main>
  );
}
