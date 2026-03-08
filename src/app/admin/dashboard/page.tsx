"use client";

import { useEffect, useState } from "react";

type SellerAdmin = {
  id: string;
  store_name: string;
  country: string;
  city: string;
  category: string;
  seller_status: string;
  subscription_status: string;
  subscription_plan: "jour" | "semaine" | "mois" | null;
  user: { id: string; username: string | null; role: string | null } | null;
};

type DocumentField = "identity_document_url" | "profile_photo_url" | "selfie_document_url";

export default function AdminDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [sellers, setSellers] = useState<SellerAdmin[]>([]);

  const loadSellers = async () => {
    setLoading(true);
    setError(null);

    const accessRes = await fetch("/api/dashboard/access", { cache: "no-store" });
    if (!accessRes.ok) {
      window.location.href = "/dashboard-login?redirect=/admin/dashboard";
      return;
    }

    const res = await fetch("/api/admin/sellers", { cache: "no-store" });
    const body = (await res.json().catch(() => ({}))) as { sellers?: SellerAdmin[]; error?: string };

    if (!res.ok) {
      setError(body.error || "Impossible de charger les vendeurs");
      setLoading(false);
      return;
    }

    setSellers(body.sellers ?? []);
    setLoading(false);
  };

  useEffect(() => {
    void loadSellers();
  }, []);

  const runAction = async (sellerId: string, action: "approve" | "reject" | "confirm_payment") => {
    setError(null);
    setInfo(null);

    const res = await fetch(`/api/admin/sellers/${encodeURIComponent(sellerId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });

    const body = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) {
      setError(body.error || "Action admin impossible");
      return;
    }

    if (action === "approve") {
      setInfo("Vendeur approuve. Statut abonnement: pending_payment.");
    } else if (action === "reject") {
      setInfo("Vendeur refuse.");
    } else {
      setInfo("Paiement confirme. Vendeur active pour 30 jours.");
    }

    await loadSellers();
  };

  const openDocument = async (sellerId: string, field: DocumentField) => {
    const res = await fetch("/api/admin/sellers/document-url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sellerId, field }),
    });

    const body = (await res.json().catch(() => ({}))) as { error?: string; url?: string };
    if (!res.ok || !body.url) {
      setError(body.error || "Document indisponible");
      return;
    }

    window.open(body.url, "_blank", "noopener,noreferrer");
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50 p-4 md:p-8">
      <section className="mx-auto max-w-6xl grid gap-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h1 className="text-3xl font-black">Dashboard Admin Vendeurs</h1>
          <button type="button" onClick={() => void loadSellers()} className="rounded-xl bg-slate-700 px-4 py-2 font-semibold">
            Rafraichir
          </button>
        </div>

        <p className="text-slate-300">Validation KYC, approbation vendeur et confirmation de paiement Wave.</p>
        {loading ? <p className="text-slate-300">Chargement...</p> : null}
        {error ? <p className="text-red-300">Erreur: {error}</p> : null}
        {info ? <p className="text-emerald-300">{info}</p> : null}

        <article className="rounded-2xl border border-slate-700 bg-slate-900/70 overflow-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-800/80 text-slate-200">
              <tr>
                <th className="text-left p-3">Nom utilisateur</th>
                <th className="text-left p-3">Nom boutique</th>
                <th className="text-left p-3">Pays</th>
                <th className="text-left p-3">Ville</th>
                <th className="text-left p-3">Statut vendeur</th>
                <th className="text-left p-3">Abonnement</th>
                <th className="text-left p-3">Documents</th>
                <th className="text-left p-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sellers.length ? (
                sellers.map((seller) => (
                  <tr key={seller.id} className="border-t border-slate-700">
                    <td className="p-3">{seller.user?.username || seller.user?.id || "-"}</td>
                    <td className="p-3">{seller.store_name}</td>
                    <td className="p-3">{seller.country}</td>
                    <td className="p-3">{seller.city}</td>
                    <td className="p-3">{seller.seller_status}</td>
                    <td className="p-3">{seller.subscription_status}</td>
                    <td className="p-3">
                      <div className="flex flex-wrap gap-1">
                        <button type="button" onClick={() => void openDocument(seller.id, "identity_document_url")} className="rounded bg-slate-700 px-2 py-1 text-xs">Identite</button>
                        <button type="button" onClick={() => void openDocument(seller.id, "profile_photo_url")} className="rounded bg-slate-700 px-2 py-1 text-xs">Profil</button>
                        <button type="button" onClick={() => void openDocument(seller.id, "selfie_document_url")} className="rounded bg-slate-700 px-2 py-1 text-xs">Selfie</button>
                      </div>
                    </td>
                    <td className="p-3">
                      <div className="flex flex-wrap gap-1">
                        <button type="button" onClick={() => void runAction(seller.id, "approve")} className="rounded bg-emerald-600 px-2 py-1 text-xs font-semibold">Approuver vendeur</button>
                        <button type="button" onClick={() => void runAction(seller.id, "reject")} className="rounded bg-rose-700 px-2 py-1 text-xs font-semibold">Refuser vendeur</button>
                        <button type="button" onClick={() => void runAction(seller.id, "confirm_payment")} className="rounded bg-blue-600 px-2 py-1 text-xs font-semibold">Confirmer paiement</button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="p-4 text-slate-300">Aucun vendeur enregistre pour le moment.</td>
                </tr>
              )}
            </tbody>
          </table>
        </article>
      </section>
    </main>
  );
}
