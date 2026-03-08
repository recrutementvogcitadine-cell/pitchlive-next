"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { env } from "@/lib/env";

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

  const contactAdminWhatsapp = () => {
    const raw = env.sellerWhatsapp || "2250700000000";
    const normalized = raw.replace(/[^\d+]/g, "");
    if (!normalized || typeof window === "undefined") return;
    const sellerName = registration ? `${registration.firstName} ${registration.lastName}`.trim() : "Vendeur";
    const message = [
      "Bonjour equipe admin PITCH LIVE,",
      `je suis ${sellerName} et mon inscription vendeur est en attente.`,
      "Merci de me confirmer la validation.",
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
          {registration.certifiedBadge ? (
            <p className="text-sky-300">
              Badge vendeur: <strong>Certifie bleu</strong>
            </p>
          ) : null}
          <p className="text-sm text-slate-300">
            Avertissements admin: <strong>{registration.warningCount ?? 0}</strong>
          </p>
          {registration.bannedPermanently ? (
            <p className="text-sm text-rose-300">
              Compte vendeur banni definitivement.
            </p>
          ) : null}
          {isTempBanned(registration.bannedUntil) ? (
            <p className="text-sm text-rose-300">
              Compte vendeur suspendu temporairement jusqu'au {new Date(String(registration.bannedUntil)).toLocaleString("fr-FR")}.
            </p>
          ) : null}

          {registration.status === "validated" ? (
            <div className="grid gap-2 md:grid-cols-2">
              <Link href="/creator/studio" className="rounded-xl bg-emerald-600 px-4 py-3 font-bold text-center">
                Acceder au Studio Vendeur
              </Link>
              <Link href="/mur" className="rounded-xl bg-blue-600 px-4 py-3 font-bold text-center">
                Acceder au Mur Visiteur
              </Link>
            </div>
          ) : registration.status === "refused" ? (
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
          ) : (
            <div className="grid gap-2">
              <p className="text-sm text-slate-300">Attends la validation admin. Une fois valide, tu auras automatiquement les acces vendeur + visiteur.</p>
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
            <p>Espace admin local: <Link href="/admin/vendeurs" className="underline">/admin/vendeurs</Link></p>
          </div>
        </article>
      </section>
    </main>
  );
}
