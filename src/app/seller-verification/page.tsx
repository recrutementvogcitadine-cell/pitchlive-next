"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type KycType = "identity_document" | "profile_photo" | "selfie_document";

type UploadState = {
  identity_document: string | null;
  profile_photo: string | null;
  selfie_document: string | null;
};

const INITIAL_UPLOADS: UploadState = {
  identity_document: null,
  profile_photo: null,
  selfie_document: null,
};

export default function SellerVerificationPage() {
  const [uploads, setUploads] = useState<UploadState>(INITIAL_UPLOADS);
  const [busyType, setBusyType] = useState<KycType | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => {
    const check = async () => {
      const res = await fetch("/api/seller/onboarding", { cache: "no-store" });
      if (res.status === 401) {
        window.location.href = "/dashboard-login?redirect=/seller-verification";
      }
    };

    void check();
  }, []);

  const uploadFile = async (documentType: KycType, file: File | null) => {
    if (!file) return;

    setBusyType(documentType);
    setError(null);
    setInfo(null);

    try {
      const formData = new FormData();
      formData.append("documentType", documentType);
      formData.append("file", file);

      const res = await fetch("/api/seller/kyc/upload", {
        method: "POST",
        body: formData,
      });

      const body = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
      if (!res.ok) {
        throw new Error(body.error || "Upload impossible");
      }

      setUploads((prev) => ({ ...prev, [documentType]: file.name }));
      setInfo(body.message || "Document charge avec succes.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inattendue");
    } finally {
      setBusyType(null);
    }
  };

  const requiredDone = Boolean(uploads.identity_document && uploads.profile_photo);

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50 p-4 md:p-8">
      <section className="mx-auto max-w-2xl grid gap-4">
        <h1 className="text-3xl font-black">Verification vendeur (KYC)</h1>
        <p className="text-slate-300">Documents obligatoires: piece d'identite/passeport + photo de profil vendeur.</p>

        <article className="rounded-2xl border border-slate-700 bg-slate-900/70 p-5 grid gap-3">
          <label className="grid gap-1 text-sm">
            Carte d'identite ou passeport
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={(event) => void uploadFile("identity_document", event.target.files?.[0] ?? null)}
              className="rounded-xl border border-slate-600 bg-slate-800 px-3 py-2"
            />
            <span className="text-xs text-slate-400">Image uniquement, max 5MB.</span>
            {uploads.identity_document ? <span className="text-xs text-emerald-300">Charge: {uploads.identity_document}</span> : null}
          </label>

          <label className="grid gap-1 text-sm">
            Photo de profil vendeur
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={(event) => void uploadFile("profile_photo", event.target.files?.[0] ?? null)}
              className="rounded-xl border border-slate-600 bg-slate-800 px-3 py-2"
            />
            <span className="text-xs text-slate-400">Image uniquement, max 5MB.</span>
            {uploads.profile_photo ? <span className="text-xs text-emerald-300">Charge: {uploads.profile_photo}</span> : null}
          </label>

          <label className="grid gap-1 text-sm">
            Selfie document (optionnel)
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={(event) => void uploadFile("selfie_document", event.target.files?.[0] ?? null)}
              className="rounded-xl border border-slate-600 bg-slate-800 px-3 py-2"
            />
            {uploads.selfie_document ? <span className="text-xs text-emerald-300">Charge: {uploads.selfie_document}</span> : null}
          </label>

          <div className="rounded-xl border border-amber-500/60 bg-amber-900/20 p-3 text-sm text-amber-100">
            {busyType
              ? "Upload en cours..."
              : requiredDone
                ? "Votre demande vendeur est en cours de verification."
                : "Charge les 2 documents obligatoires pour soumettre la verification."}
          </div>

          <div className="flex flex-wrap gap-2">
            <Link href="/profile" className="rounded-xl bg-slate-700 px-4 py-3 font-semibold">
              Retour profil
            </Link>
            <Link href="/vendeur/statut" className="rounded-xl bg-emerald-600 px-4 py-3 font-semibold">
              Voir mon statut vendeur
            </Link>
          </div>

          {info ? <p className="text-sm text-emerald-300">{info}</p> : null}
          {error ? <p className="text-sm text-red-300">Erreur: {error}</p> : null}
        </article>
      </section>
    </main>
  );
}
