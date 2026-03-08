"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { env } from "@/lib/env";
import { canLaunchSellerLive } from "@/lib/seller-workflow";

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
  certifiedBadge?: boolean;
  warningCount?: number;
  bannedUntil?: string | null;
  bannedPermanently?: boolean;
};

type SellerWorkflowStatus = {
  seller_status: "pending_verification" | "rejected" | "approved" | "active";
  subscription_status: "unpaid" | "pending_payment" | "paid" | "expired";
  subscription_plan: "jour" | "semaine" | "mois" | null;
  subscription_expiry_date: string | null;
  store_name?: string;
};

type SellerPlanPricing = {
  jour: number;
  semaine: number;
  mois: number;
};

const SELLER_PRICING_KEY = "pitchlive.seller.planPricing.v1";
const DEFAULT_SELLER_PRICING: SellerPlanPricing = {
  jour: 5000,
  semaine: 25000,
  mois: 80000,
};

function isTempBanned(bannedUntil?: string | null) {
  if (!bannedUntil) return false;
  return new Date(bannedUntil).getTime() > Date.now();
}

function formatStatus(status: SellerRegistration["status"]) {
  if (status === "validated") return "VALIDE";
  if (status === "refused") return "REFUSE";
  return "EN ATTENTE";
}

export default function VendeurStatutPage() {
  const [registration, setRegistration] = useState<SellerRegistration | null>(null);
  const [sellerWorkflowStatus, setSellerWorkflowStatus] = useState<SellerWorkflowStatus | null>(null);
  const [pricing, setPricing] = useState<SellerPlanPricing>(DEFAULT_SELLER_PRICING);

  const contactAdminWhatsapp = () => {
    const raw = env.sellerWhatsapp;
    const normalized = raw.replace(/[^\d+]/g, "");
    if (!normalized || typeof window === "undefined") return;
    const sellerName = registration ? `${registration.firstName} ${registration.lastName}`.trim() : "Vendeur";
    const message = [
      "Bonjour equipe admin PITCH LIVE,",
      `je suis ${sellerName}.`,
      `Statut vendeur: ${sellerWorkflowStatus?.seller_status || "pending_verification"}`,
      `Statut abonnement: ${sellerWorkflowStatus?.subscription_status || "unpaid"}`,
      "Merci de m'accompagner pour activer mon compte vendeur.",
    ].join("\n");
    window.open(`https://wa.me/${normalized}?text=${encodeURIComponent(message)}`, "_blank", "noopener,noreferrer");
  };

  const restartSellerRegistration = () => {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem("pitchlive.seller.registration");
    window.localStorage.setItem("pitchlive.access", JSON.stringify({ visitor: false, seller: false }));
    window.location.href = "/vendeur/inscription";
  };

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

  useEffect(() => {
    const raw = window.localStorage.getItem(SELLER_PRICING_KEY);
    if (!raw) {
      setPricing(DEFAULT_SELLER_PRICING);
      return;
    }

    try {
      const parsed = JSON.parse(raw) as Partial<SellerPlanPricing>;
      setPricing({
        jour: Number.isFinite(parsed.jour) ? Math.max(0, Number(parsed.jour)) : DEFAULT_SELLER_PRICING.jour,
        semaine: Number.isFinite(parsed.semaine) ? Math.max(0, Number(parsed.semaine)) : DEFAULT_SELLER_PRICING.semaine,
        mois: Number.isFinite(parsed.mois) ? Math.max(0, Number(parsed.mois)) : DEFAULT_SELLER_PRICING.mois,
      });
    } catch {
      setPricing(DEFAULT_SELLER_PRICING);
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    const loadSellerWorkflowStatus = async () => {
      try {
        const res = await fetch("/api/seller/status", { cache: "no-store" });
        if (!res.ok) {
          if (mounted) setSellerWorkflowStatus(null);
          return;
        }

        const body = (await res.json()) as { seller?: SellerWorkflowStatus | null };
        if (!mounted) return;
        setSellerWorkflowStatus(body.seller ?? null);
      } catch {
        if (!mounted) return;
        setSellerWorkflowStatus(null);
      }
    };

    void loadSellerWorkflowStatus();
    const timer = window.setInterval(() => void loadSellerWorkflowStatus(), 4000);

    return () => {
      mounted = false;
      window.clearInterval(timer);
    };
  }, []);

  const statusClass = useMemo(() => {
    if (sellerWorkflowStatus?.seller_status === "active") return "text-emerald-300";
    if (sellerWorkflowStatus?.seller_status === "approved") return "text-sky-300";
    if (sellerWorkflowStatus?.seller_status === "rejected") return "text-rose-300";
    if (!registration) return "text-slate-300";
    if (registration.status === "validated") return "text-emerald-300";
    if (registration.status === "refused") return "text-rose-300";
    return "text-amber-200";
  }, [registration, sellerWorkflowStatus]);

  const planForPayment = sellerWorkflowStatus?.subscription_plan || registration?.plan || "mois";
  const amountForPayment = planForPayment === "jour" ? pricing.jour : planForPayment === "semaine" ? pricing.semaine : pricing.mois;
  const sellerLiveActive = canLaunchSellerLive({
    sellerStatus: sellerWorkflowStatus?.seller_status,
    subscriptionStatus: sellerWorkflowStatus?.subscription_status,
    expiryDate: sellerWorkflowStatus?.subscription_expiry_date,
  });

  if (!registration && !sellerWorkflowStatus) {
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
            Boutique: <strong>{sellerWorkflowStatus?.store_name || registration?.storeName || "--"}</strong>
          </p>
          <p>
            Vendeur: <strong>{registration ? `${registration.firstName} ${registration.lastName}` : "Vendeur"}</strong>
          </p>
          <p>
            Telephone: <strong>{registration?.phone || "--"}</strong>
          </p>
          <p>
            Forfait: <strong>{String(registration?.plan || sellerWorkflowStatus?.subscription_plan || "--").toUpperCase()}</strong>
          </p>
          <p className={statusClass}>
            Statut: <strong>{sellerWorkflowStatus?.seller_status?.toUpperCase() || (registration ? formatStatus(registration.status) : "EN ATTENTE")}</strong>
          </p>
          <p>
            Abonnement: <strong>{sellerWorkflowStatus?.subscription_status?.toUpperCase() || "UNPAID"}</strong>
          </p>
          {registration?.certifiedBadge ? (
            <p className="text-sky-300">
              Badge vendeur: <strong>Certifie bleu</strong>
            </p>
          ) : null}
          <p className="text-sm text-slate-300">
            Avertissements admin: <strong>{registration.warningCount ?? 0}</strong>
          </p>
          {registration?.bannedPermanently ? (
            <p className="text-sm text-rose-300">
              Compte vendeur banni definitivement.
            </p>
          ) : null}
          {isTempBanned(registration?.bannedUntil) ? (
            <p className="text-sm text-rose-300">
              Compte vendeur suspendu temporairement jusqu'au {new Date(String(registration?.bannedUntil)).toLocaleString("fr-FR")}.
            </p>
          ) : null}

          {sellerLiveActive ? (
            <div className="grid gap-2 md:grid-cols-2">
              <Link href="/creator/studio" className="rounded-xl bg-emerald-600 px-4 py-3 font-bold text-center">
                Acceder au Studio Vendeur
              </Link>
              <Link href="/mur" className="rounded-xl bg-blue-600 px-4 py-3 font-bold text-center">
                Acceder au Mur Visiteur
              </Link>
            </div>
          ) : sellerWorkflowStatus?.seller_status === "rejected" || registration?.status === "refused" ? (
            <div className="grid gap-2">
              <p className="text-sm text-rose-200">Inscription refusee. Tu dois faire une nouvelle inscription vendeur.</p>
              <button
                type="button"
                onClick={restartSellerRegistration}
                className="rounded-xl bg-rose-600 px-4 py-3 font-bold"
              >
                Refaire mon inscription vendeur
              </button>
            </div>
          ) : sellerWorkflowStatus?.seller_status === "approved" && sellerWorkflowStatus?.subscription_status === "pending_payment" ? (
            <div className="grid gap-2">
              <p className="text-sm text-slate-300">
                Votre compte vendeur est valide. Pour activer votre acces au live merci de payer la souscription vendeur.
              </p>
              <p className="text-sm text-amber-200">
                Montant a payer ({planForPayment.toUpperCase()}): <strong>{Math.max(0, Math.floor(amountForPayment)).toLocaleString("fr-FR")} F CFA</strong>
              </p>
              <button
                type="button"
                onClick={contactAdminWhatsapp}
                className="w-full sm:w-auto rounded-xl bg-emerald-600 px-4 py-3 font-bold"
              >
                Contacter nous pour devenir vendeur
              </button>
            </div>
          ) : (
            <div className="grid gap-2">
              <p className="text-sm text-slate-300">Votre abonnement vendeur doit etre active.</p>
              <button
                type="button"
                onClick={contactAdminWhatsapp}
                className="w-full sm:w-auto rounded-xl bg-emerald-600 px-4 py-3 font-bold"
              >
                Contacter nous par WhatsApp
              </button>
            </div>
          )}

          <div className="mt-2 rounded-xl border border-slate-700 bg-slate-800/55 p-3 grid gap-2 text-xs text-slate-300">
            <p>Validation vendeur effectuee uniquement par admin.</p>
            <p>Espace admin local: <Link href="/dashboard/validation-vendeurs" className="underline">/dashboard/validation-vendeurs</Link></p>
          </div>
        </article>
      </section>
    </main>
  );
}
