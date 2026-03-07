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
  const [isAuthed, setIsAuthed] = useState(false);
  const [pin, setPin] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [registration, setRegistration] = useState<SellerRegistration | null>(null);

  const ADMIN_AUTH_KEY = "pitchlive.admin.auth";

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
    const existing = window.sessionStorage.getItem(ADMIN_AUTH_KEY);
    if (existing === "1") {
      setIsAuthed(true);
    }
  }, []);

  useEffect(() => {
    if (!isAuthed) return;
    loadRegistration();
  }, [isAuthed]);

  const verifyPin = async () => {
    setAuthError(null);
    if (!pin.trim()) {
      setAuthError("Entre le code PIN admin.");
      return;
    }

    setAuthBusy(true);
    try {
      const res = await fetch("/api/admin/verify-pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: pin.trim() }),
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error || "PIN invalide");
      }

      window.sessionStorage.setItem(ADMIN_AUTH_KEY, "1");
      setIsAuthed(true);
      setPin("");
    } catch (err) {
      const message = err instanceof Error ? err.message : "PIN invalide";
      setAuthError(message);
    } finally {
      setAuthBusy(false);
    }
  };

  const logoutAdmin = () => {
    window.sessionStorage.removeItem(ADMIN_AUTH_KEY);
    setIsAuthed(false);
  };

  if (!isAuthed) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-100 px-4 py-8 md:p-10">
        <section className="mx-auto max-w-md grid gap-5">
          <h1 className="text-3xl font-black">Admin Validation Vendeurs</h1>
          <article className="rounded-2xl border border-slate-700 bg-slate-900/70 p-5 grid gap-3">
            <p className="text-sm text-slate-300">Entrez le PIN admin pour acceder aux validations vendeurs.</p>
            <input
              type="password"
              value={pin}
              onChange={(event) => setPin(event.target.value)}
              className="rounded-xl border border-slate-600 bg-slate-800 px-3 py-2 outline-none"
              placeholder="PIN admin"
            />
            <button
              type="button"
              onClick={() => void verifyPin()}
              disabled={authBusy}
              className="rounded-xl bg-blue-600 px-4 py-3 font-bold disabled:opacity-50"
            >
              {authBusy ? "Verification..." : "Acceder"}
            </button>
            {authError ? <p className="text-sm text-rose-300">Erreur: {authError}</p> : null}
          </article>
        </section>
      </main>
    );
  }

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

        <div>
          <a href="/dashboard" className="rounded-full bg-sky-700 px-3 py-2 text-sm font-semibold inline-flex">
            Ouvrir dashboard realtime
          </a>
        </div>

        <div>
          <button type="button" onClick={logoutAdmin} className="rounded-full bg-slate-700 px-3 py-2 text-sm font-semibold">
            Deconnexion admin
          </button>
        </div>

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
