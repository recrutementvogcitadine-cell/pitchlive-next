"use client";

import { useState } from "react";
import { env } from "@/lib/env";

type SellerFormState = {
  nom: string;
  prenom: string;
  activite: string;
  telephone: string;
  motDePasse: string;
  forfait: "jour" | "semaine" | "mois" | "";
};

const INITIAL_FORM: SellerFormState = {
  nom: "",
  prenom: "",
  activite: "",
  telephone: "",
  motDePasse: "",
  forfait: "",
};

function normalizePhone(value: string) {
  return value.replace(/[^\d+]/g, "");
}

function computeEndDate(forfait: "jour" | "semaine" | "mois") {
  const start = new Date();
  const end = new Date(start);
  if (forfait === "jour") {
    end.setDate(end.getDate() + 1);
  } else if (forfait === "semaine") {
    end.setDate(end.getDate() + 7);
  } else {
    end.setMonth(end.getMonth() + 1);
  }
  return { start, end };
}

export default function InscriptionVendeurPage() {
  const [form, setForm] = useState<SellerFormState>(INITIAL_FORM);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onChange = (field: keyof SellerFormState, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value as SellerFormState[keyof SellerFormState] }));
  };

  const sendToPitchLiveWhatsApp = (summary: string) => {
    const pitchWhatsapp = env.sellerWhatsapp || "2250700000000";
    const normalized = normalizePhone(pitchWhatsapp);
    if (!normalized) return;
    const waUrl = `https://wa.me/${normalized}?text=${encodeURIComponent(summary)}`;
    window.open(waUrl, "_blank", "noopener,noreferrer");
  };

  const submit = async () => {
    setError(null);

    const nom = form.nom.trim();
    const prenom = form.prenom.trim();
    const activite = form.activite.trim();
    const telephone = normalizePhone(form.telephone);
    const motDePasse = form.motDePasse;

    if (!nom || !prenom || !activite || !telephone || !motDePasse || !form.forfait) {
      setError("Tous les champs sont obligatoires.");
      return;
    }

    if (motDePasse.length < 6) {
      setError("Le mot de passe doit contenir au moins 6 caracteres.");
      return;
    }

    if (telephone.length < 8) {
      setError("Numero de telephone invalide.");
      return;
    }

    setBusy(true);

    try {
      const { start, end } = computeEndDate(form.forfait as "jour" | "semaine" | "mois");
      const sellerRegistration = {
        id: "main-creator",
        firstName: prenom,
        lastName: nom,
        storeName: activite,
        phone: telephone,
        plan: form.forfait,
        planStartAt: start.toISOString(),
        planEndAt: end.toISOString(),
        status: "pending",
        createdAt: new Date().toISOString(),
      };

      window.localStorage.setItem("pitchlive.seller.registration", JSON.stringify(sellerRegistration));

      const summary = [
        "Nouvelle demande vendeur PITCH LIVE",
        `Nom: ${prenom} ${nom}`,
        `Activite: ${activite}`,
        `Telephone: ${telephone}`,
        `Forfait: ${form.forfait.toUpperCase()}`,
        "Statut: EN ATTENTE",
      ].join("\n");
      sendToPitchLiveWhatsApp(summary);

      window.location.href = "/vendeur/statut";
    } catch {
      setError("Inscription vendeur impossible pour le moment.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50 px-4 py-8 md:p-10">
      <section className="mx-auto max-w-xl grid gap-5">
        <h1 className="text-3xl font-black">Inscription vendeur</h1>
        <p className="text-sm text-slate-300">Choisis ton forfait, puis attends la validation admin (en attente / valide / refuse).</p>

        <article className="rounded-2xl border border-slate-700 bg-slate-900/70 p-4 md:p-6 grid gap-4">
          <label className="grid gap-1 text-sm">
            Nom
            <input value={form.nom} onChange={(event) => onChange("nom", event.target.value)} className="rounded-xl border border-slate-600 bg-slate-800 px-3 py-2 outline-none" />
          </label>

          <label className="grid gap-1 text-sm">
            Prenom
            <input value={form.prenom} onChange={(event) => onChange("prenom", event.target.value)} className="rounded-xl border border-slate-600 bg-slate-800 px-3 py-2 outline-none" />
          </label>

          <label className="grid gap-1 text-sm">
            Nom de l'activite / boutique
            <input value={form.activite} onChange={(event) => onChange("activite", event.target.value)} className="rounded-xl border border-slate-600 bg-slate-800 px-3 py-2 outline-none" />
          </label>

          <label className="grid gap-1 text-sm">
            Numero de telephone
            <input value={form.telephone} onChange={(event) => onChange("telephone", event.target.value)} className="rounded-xl border border-slate-600 bg-slate-800 px-3 py-2 outline-none" />
          </label>

          <label className="grid gap-1 text-sm">
            Mot de passe
            <input type="password" value={form.motDePasse} onChange={(event) => onChange("motDePasse", event.target.value)} className="rounded-xl border border-slate-600 bg-slate-800 px-3 py-2 outline-none" />
          </label>

          <fieldset className="grid gap-2">
            <legend className="text-sm">Choisir un forfait</legend>
            <div className="grid gap-2 sm:grid-cols-3">
              <button type="button" onClick={() => onChange("forfait", "jour")} className={`rounded-xl px-3 py-3 font-semibold border ${form.forfait === "jour" ? "bg-emerald-600 border-emerald-400" : "bg-slate-800 border-slate-600"}`}>
                Forfait JOUR
              </button>
              <button type="button" onClick={() => onChange("forfait", "semaine")} className={`rounded-xl px-3 py-3 font-semibold border ${form.forfait === "semaine" ? "bg-emerald-600 border-emerald-400" : "bg-slate-800 border-slate-600"}`}>
                Forfait SEMAINE
              </button>
              <button type="button" onClick={() => onChange("forfait", "mois")} className={`rounded-xl px-3 py-3 font-semibold border ${form.forfait === "mois" ? "bg-emerald-600 border-emerald-400" : "bg-slate-800 border-slate-600"}`}>
                Forfait MOIS
              </button>
            </div>
          </fieldset>

          <button type="button" onClick={() => void submit()} disabled={busy} className="rounded-xl bg-blue-600 px-4 py-3 font-bold disabled:opacity-50">
            {busy ? "Creation en cours..." : "Valider mon inscription vendeur"}
          </button>

          {error ? <p className="text-sm text-red-300">Erreur: {error}</p> : null}
        </article>
      </section>
    </main>
  );
}
