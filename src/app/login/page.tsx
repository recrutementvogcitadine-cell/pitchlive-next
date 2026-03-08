"use client";

import Link from "next/link";
import { useState } from "react";

type SellerRegistration = {
  id: string;
  firstName: string;
  lastName: string;
  storeName: string;
  phone: string;
  password?: string;
  status: "pending" | "validated" | "refused";
  warningCount?: number;
  bannedUntil?: string | null;
  bannedPermanently?: boolean;
  certifiedBadge?: boolean;
};

type ViewerProfile = {
  id: string;
  username: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  password?: string;
  status?: string;
  warningCount?: number;
  bannedUntil?: string | null;
  bannedPermanently?: boolean;
};

function isTempBanned(bannedUntil?: string | null) {
  if (!bannedUntil) return false;
  return new Date(bannedUntil).getTime() > Date.now();
}

function normalizePhone(value: string) {
  return value.replace(/[^\d+]/g, "");
}

export default function LoginPage() {
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setError(null);

    const normalizedPhone = normalizePhone(phone);
    if (!normalizedPhone || !password) {
      setError("Numero de telephone et mot de passe obligatoires.");
      return;
    }

    setBusy(true);

    try {
      const rawSeller = window.localStorage.getItem("pitchlive.seller.registration");
      const rawViewer = window.localStorage.getItem("pitchlive.viewer");

      const seller = rawSeller ? (JSON.parse(rawSeller) as SellerRegistration) : null;
      const viewer = rawViewer ? (JSON.parse(rawViewer) as ViewerProfile) : null;

      const sellerMatch =
        seller && normalizePhone(seller.phone) === normalizedPhone && String(seller.password ?? "") === password;

      if (sellerMatch) {
        if (seller.bannedPermanently) {
          setError("Ce compte vendeur est banni definitivement.");
          return;
        }

        if (isTempBanned(seller.bannedUntil)) {
          setError(`Compte vendeur temporairement suspendu jusqu'au ${new Date(String(seller.bannedUntil)).toLocaleString("fr-FR")}.`);
          return;
        }

        if (seller.status === "validated") {
          window.localStorage.setItem("pitchlive.access", JSON.stringify({ visitor: true, seller: true }));
          window.localStorage.setItem(
            "pitchlive.viewer",
            JSON.stringify({
              id: seller.id,
              username: `${seller.firstName} ${seller.lastName}`.trim(),
              firstName: seller.firstName,
              lastName: seller.lastName,
              phone: seller.phone,
              role: "seller+visitor",
              status: "validated",
              validatedBy: "admin",
            })
          );
          window.location.href = "/choix-mode";
          return;
        }

        if (seller.status === "pending") {
          window.localStorage.setItem("pitchlive.access", JSON.stringify({ visitor: false, seller: true }));
          window.location.href = "/creator/studio";
          return;
        }

        // Refused sellers must submit a new registration.
        window.localStorage.setItem("pitchlive.access", JSON.stringify({ visitor: false, seller: false }));
        window.location.href = "/vendeur/inscription";
        return;
      }

      const viewerMatch =
        viewer && normalizePhone(viewer.phone ?? "") === normalizedPhone && String(viewer.password ?? "") === password;

      if (viewerMatch) {
        if (viewer.bannedPermanently) {
          setError("Ce compte visiteur est banni definitivement.");
          return;
        }

        if (isTempBanned(viewer.bannedUntil)) {
          setError(`Compte visiteur temporairement suspendu jusqu'au ${new Date(String(viewer.bannedUntil)).toLocaleString("fr-FR")}.`);
          return;
        }

        window.localStorage.setItem("pitchlive.access", JSON.stringify({ visitor: true, seller: false }));
        window.location.href = "/mur";
        return;
      }

      setError("Identifiants invalides.");
    } catch {
      setError("Connexion impossible pour le moment.");
    } finally {
      setBusy(false);
    }
  };

  const enterVisitorFreeMode = () => {
    const guestProfile = {
      id: `guest-${Date.now()}`,
      username: `visiteur_${Math.random().toString(36).slice(2, 7)}`,
      status: "free-entry",
      role: "visitor",
    };

    window.localStorage.setItem("pitchlive.viewer", JSON.stringify(guestProfile));
    window.localStorage.setItem("pitchlive.access", JSON.stringify({ visitor: true, seller: false }));
    window.location.href = "/watch";
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50 px-4 py-8 md:p-10">
      <section className="mx-auto max-w-xl grid gap-5">
        <h1 className="text-3xl font-black">Connexion</h1>
        <p className="text-sm text-slate-300">Connecte-toi avec ton numero de telephone et mot de passe.</p>

        <div className="flex items-center justify-between rounded-xl border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm">
          <span className="text-slate-300">Section connexion des personnes deja inscrites</span>
          <Link href="/" className="rounded-full bg-slate-700 px-3 py-1.5 font-semibold">
            ← Retour accueil
          </Link>
        </div>

        <article className="rounded-2xl border border-slate-700 bg-slate-900/70 p-4 md:p-6 grid gap-4">
          <label className="grid gap-1 text-sm">
            Numero de telephone
            <input
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              className="rounded-xl border border-slate-600 bg-slate-800 px-3 py-2 outline-none"
              placeholder="2250700000000"
            />
          </label>

          <label className="grid gap-1 text-sm">
            Mot de passe
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="rounded-xl border border-slate-600 bg-slate-800 px-3 py-2 outline-none"
              placeholder="******"
            />
          </label>

          <button
            type="button"
            onClick={() => void submit()}
            disabled={busy}
            className="rounded-xl bg-blue-600 px-4 py-3 font-bold disabled:opacity-50"
          >
            {busy ? "Connexion..." : "Se connecter"}
          </button>

          {error ? <p className="text-sm text-red-300">Erreur: {error}</p> : null}
        </article>

        <article className="rounded-2xl border border-emerald-500/50 bg-emerald-900/15 p-4 md:p-6 grid gap-3">
          <h2 className="text-base font-bold text-emerald-100">Entree libre visiteur</h2>
          <p className="text-sm text-emerald-100/90">
            Acces direct sans inscription pour voir uniquement les lives et les produits.
          </p>
          <button
            type="button"
            onClick={enterVisitorFreeMode}
            className="rounded-xl bg-emerald-600 px-4 py-3 font-bold"
          >
            Entrer librement (Live + Produits)
          </button>
        </article>
      </section>
    </main>
  );
}
