"use client";

import { useEffect, useMemo, useState } from "react";
import AdminShell from "@/components/admin/AdminShell";

type SubscriptionRow = {
  id: string;
  store_name: string;
  subscription_status: string;
  subscription_plan: "jour" | "semaine" | "mois" | null;
  subscription_expiry_date: string | null;
  seller_status: string;
};

export default function AdminSubscriptionsPage() {
  const [rows, setRows] = useState<SubscriptionRow[]>([]);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    const res = await fetch("/api/admin/subscriptions", { cache: "no-store" });
    const body = (await res.json().catch(() => ({}))) as { rows?: SubscriptionRow[]; error?: string };
    if (!res.ok) {
      setError(body.error || "Impossible de charger les abonnements");
      return;
    }

    setRows(body.rows ?? []);
    setError(null);
  };

  useEffect(() => {
    void load();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) => row.store_name.toLowerCase().includes(q));
  }, [rows, query]);

  const runAction = async (id: string, action: "confirm_payment" | "extend" | "suspend") => {
    const res = await fetch(`/api/admin/subscriptions/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) {
      setError(body.error || "Action impossible");
      return;
    }

    await load();
  };

  return (
    <AdminShell title="Gestion des abonnements vendeurs">
      <div className="rounded-2xl border border-slate-700 bg-slate-900/70 p-4 grid gap-3">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Recherche vendeur..."
          className="rounded-xl border border-slate-600 bg-slate-800 px-3 py-2"
        />
        {error ? <p className="text-red-300 text-sm">{error}</p> : null}
      </div>

      <div className="rounded-2xl border border-slate-700 bg-slate-900/70 overflow-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-800/80">
            <tr>
              <th className="text-left p-3">Nom vendeur</th>
              <th className="text-left p-3">Statut paiement</th>
              <th className="text-left p-3">Plan</th>
              <th className="text-left p-3">Expiration</th>
              <th className="text-left p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((row) => (
              <tr key={row.id} className="border-t border-slate-700">
                <td className="p-3">{row.store_name}</td>
                <td className="p-3">{row.subscription_status}</td>
                <td className="p-3">{row.subscription_plan || "--"}</td>
                <td className="p-3">{row.subscription_expiry_date ? new Date(row.subscription_expiry_date).toLocaleString("fr-FR") : "--"}</td>
                <td className="p-3">
                  <div className="flex flex-wrap gap-1">
                    <button onClick={() => void runAction(row.id, "confirm_payment")} className="rounded bg-emerald-600 px-2 py-1 text-xs font-semibold">Confirmer paiement</button>
                    <button onClick={() => void runAction(row.id, "extend")} className="rounded bg-blue-600 px-2 py-1 text-xs font-semibold">Prolonger abonnement</button>
                    <button onClick={() => void runAction(row.id, "suspend")} className="rounded bg-rose-700 px-2 py-1 text-xs font-semibold">Suspendre abonnement</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AdminShell>
  );
}
