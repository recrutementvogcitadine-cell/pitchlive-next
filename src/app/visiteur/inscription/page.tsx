"use client";

import { useState } from "react";

type FormState = {
  nom: string;
  prenom: string;
  telephone: string;
  motDePasse: string;
};

const INITIAL_FORM: FormState = {
  nom: "",
  prenom: "",
  telephone: "",
  motDePasse: "",
};

function normalizePhone(value: string) {
  return value.replace(/[^\d+]/g, "");
}

export default function InscriptionVisiteurPage() {
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onChange = (field: keyof FormState, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const submit = async () => {
    setError(null);

    const nom = form.nom.trim();
    const prenom = form.prenom.trim();
    const telephone = normalizePhone(form.telephone);
    const motDePasse = form.motDePasse;

    if (!nom || !prenom || !telephone || !motDePasse) {
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
      const viewerId = crypto.randomUUID();
      const username = `${prenom} ${nom}`.trim();

      window.localStorage.setItem(
        "pitchlive.viewer",
        JSON.stringify({
          id: viewerId,
          username,
          firstName: prenom,
          lastName: nom,
          phone: telephone,
          password: motDePasse,
          role: "visitor",
          status: "validated",
          validatedBy: "system",
        })
      );

      window.localStorage.setItem("pitchlive.access", JSON.stringify({ visitor: true, seller: false }));

      window.location.href = "/mur";
    } catch {
      setError("Inscription impossible pour le moment.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50 px-4 py-8 md:p-10">
      <section className="mx-auto max-w-xl grid gap-5">
        <h1 className="text-3xl font-black">Inscription visiteur</h1>
        <p className="text-sm text-slate-300">Inscription rapide. Verification SMS possible dans une prochaine version.</p>

        <article className="rounded-2xl border border-slate-700 bg-slate-900/70 p-4 md:p-6 grid gap-4">
          <label className="grid gap-1 text-sm">
            Nom
            <input
              value={form.nom}
              onChange={(event) => onChange("nom", event.target.value)}
              className="rounded-xl border border-slate-600 bg-slate-800 px-3 py-2 outline-none"
              placeholder="Nom"
            />
          </label>

          <label className="grid gap-1 text-sm">
            Prenom
            <input
              value={form.prenom}
              onChange={(event) => onChange("prenom", event.target.value)}
              className="rounded-xl border border-slate-600 bg-slate-800 px-3 py-2 outline-none"
              placeholder="Prenom"
            />
          </label>

          <label className="grid gap-1 text-sm">
            Numero de telephone
            <input
              value={form.telephone}
              onChange={(event) => onChange("telephone", event.target.value)}
              className="rounded-xl border border-slate-600 bg-slate-800 px-3 py-2 outline-none"
              placeholder="2250700000000"
            />
          </label>

          <label className="grid gap-1 text-sm">
            Mot de passe
            <input
              type="password"
              value={form.motDePasse}
              onChange={(event) => onChange("motDePasse", event.target.value)}
              className="rounded-xl border border-slate-600 bg-slate-800 px-3 py-2 outline-none"
              placeholder="******"
            />
          </label>

          <button
            type="button"
            onClick={() => void submit()}
            disabled={busy}
            className="rounded-xl bg-emerald-600 px-4 py-3 font-bold disabled:opacity-50"
          >
            {busy ? "Creation en cours..." : "Creer mon compte visiteur"}
          </button>

          {error ? <p className="text-sm text-red-300">Erreur: {error}</p> : null}
        </article>
      </section>
    </main>
  );
}
