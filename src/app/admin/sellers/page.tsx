"use client";

import { useEffect, useMemo, useState } from "react";
import AdminShell from "@/components/admin/AdminShell";

type SellerRow = {
  id: string;
  user_id: string;
  store_name: string;
  country: string;
  city: string;
  seller_status: string;
  subscription_status: string;
  created_at: string;
  identity_document_url: string | null;
  selfie_document_url: string | null;
  profile_photo_url: string | null;
  user: { id: string; username: string | null; role: string | null } | null;
};

type DocField = "identity_document_url" | "selfie_document_url" | "profile_photo_url";

export default function AdminSellersPage() {
  const [rows, setRows] = useState<SellerRow[]>([]);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (statusFilter !== "all") params.set("status", statusFilter);

    const res = await fetch(`/api/admin/sellers?${params.toString()}`, { cache: "no-store" });
    const body = (await res.json().catch(() => ({}))) as { sellers?: SellerRow[]; error?: string };
    if (!res.ok) {
      setError(body.error || "Impossible de charger les vendeurs");
      return;
    }

    setRows(body.sellers ?? []);
    setError(null);
  };

  useEffect(() => {
    void load();
  }, []);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    return rows.filter((row) => {
      const matchesQ = !q || row.store_name.toLowerCase().includes(q) || String(row.user?.username ?? "").toLowerCase().includes(q);
      const matchesStatus = statusFilter === "all" || row.seller_status === statusFilter;
      return matchesQ && matchesStatus;
    });
  }, [rows, query, statusFilter]);

  const runAction = async (id: string, action: "approve" | "reject" | "suspend" | "activate") => {
    const res = await fetch(`/api/admin/sellers/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });

    const body = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) {
      setError(body.error || "Action vendeur impossible");
      return;
    }

    await load();
  };

  const openDoc = async (sellerId: string, field: DocField) => {
    const res = await fetch("/api/admin/sellers/document-url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sellerId, field }),
    });

    const body = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
    if (!res.ok || !body.url) {
      setError(body.error || "Document indisponible");
      return;
    }

    window.open(body.url, "_blank", "noopener,noreferrer");
  };

  return (
    <AdminShell title="Gestion des vendeurs">
      <div className="rounded-2xl border border-slate-700 bg-slate-900/70 p-4 grid md:grid-cols-[1fr_220px_auto] gap-2 items-center">
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Recherche vendeur..." className="rounded-xl border border-slate-600 bg-slate-800 px-3 py-2" />
        <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="rounded-xl border border-slate-600 bg-slate-800 px-3 py-2">
          <option value="all">Tous statuts</option>
          <option value="pending_verification">pending_verification</option>
          <option value="approved">approved</option>
          <option value="active">active</option>
          <option value="rejected">rejected</option>
        </select>
        <button type="button" onClick={() => void load()} className="rounded-xl bg-slate-700 px-4 py-2 font-semibold">Rechercher</button>
      </div>

      {error ? <p className="text-sm text-red-300">Erreur: {error}</p> : null}

      <div className="rounded-2xl border border-slate-700 bg-slate-900/70 overflow-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-800/80">
            <tr>
              <th className="text-left p-3">Nom utilisateur</th>
              <th className="text-left p-3">Nom boutique</th>
              <th className="text-left p-3">Pays</th>
              <th className="text-left p-3">Statut vendeur</th>
              <th className="text-left p-3">Abonnement</th>
              <th className="text-left p-3">Date inscription</th>
              <th className="text-left p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length ? (
              filtered.map((row) => (
                <tr key={row.id} className="border-t border-slate-700">
                  <td className="p-3">{row.user?.username || row.user_id}</td>
                  <td className="p-3">{row.store_name}</td>
                  <td className="p-3">{row.country}</td>
                  <td className="p-3">{row.seller_status}</td>
                  <td className="p-3">{row.subscription_status}</td>
                  <td className="p-3">{new Date(row.created_at).toLocaleString("fr-FR")}</td>
                  <td className="p-3">
                    <div className="flex flex-wrap gap-1">
                      <button onClick={() => void openDoc(row.id, "profile_photo_url")} className="rounded bg-slate-700 px-2 py-1 text-xs">Voir profil vendeur</button>
                      <button onClick={() => void openDoc(row.id, "identity_document_url")} className="rounded bg-slate-700 px-2 py-1 text-xs">Voir KYC</button>
                      <button onClick={() => void runAction(row.id, "approve")} className="rounded bg-emerald-600 px-2 py-1 text-xs font-semibold">Approuver</button>
                      <button onClick={() => void runAction(row.id, "reject")} className="rounded bg-rose-700 px-2 py-1 text-xs font-semibold">Refuser</button>
                      <button onClick={() => void runAction(row.id, "suspend")} className="rounded bg-amber-700 px-2 py-1 text-xs font-semibold">Suspendre</button>
                      <button onClick={() => void runAction(row.id, "activate")} className="rounded bg-blue-600 px-2 py-1 text-xs font-semibold">Activer</button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr><td colSpan={7} className="p-4">Aucun vendeur.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </AdminShell>
  );
}
