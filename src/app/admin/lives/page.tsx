"use client";

import { useEffect, useState } from "react";
import AdminShell from "@/components/admin/AdminShell";

type LiveRow = {
  id: string;
  creator_id: string;
  title: string;
  viewers_count: number;
  status: string;
  started_at: string;
  ended_at: string | null;
};

export default function AdminLivesPage() {
  const [rows, setRows] = useState<LiveRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    const res = await fetch("/api/admin/lives", { cache: "no-store" });
    const body = (await res.json().catch(() => ({}))) as { rows?: LiveRow[]; error?: string };
    if (!res.ok) {
      setError(body.error || "Impossible de charger les lives");
      return;
    }

    setRows(body.rows ?? []);
    setError(null);
  };

  useEffect(() => {
    void load();
  }, []);

  const runAction = async (id: string, action: "end_live" | "ban_seller") => {
    const res = await fetch(`/api/admin/lives/${encodeURIComponent(id)}`, {
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
    <AdminShell title="Gestion des lives">
      {error ? <p className="text-red-300 text-sm">Erreur: {error}</p> : null}
      <div className="rounded-2xl border border-slate-700 bg-slate-900/70 overflow-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-800/80">
            <tr>
              <th className="text-left p-3">Vendeur</th>
              <th className="text-left p-3">Titre du live</th>
              <th className="text-left p-3">Spectateurs</th>
              <th className="text-left p-3">Duree live</th>
              <th className="text-left p-3">Statut</th>
              <th className="text-left p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.length ? rows.map((row) => {
              const end = row.ended_at ? new Date(row.ended_at).getTime() : Date.now();
              const start = new Date(row.started_at).getTime();
              const minutes = Math.max(0, Math.floor((end - start) / 60000));

              return (
                <tr key={row.id} className="border-t border-slate-700">
                  <td className="p-3">{row.creator_id}</td>
                  <td className="p-3">{row.title}</td>
                  <td className="p-3">{row.viewers_count}</td>
                  <td className="p-3">{minutes} min</td>
                  <td className="p-3">{row.status}</td>
                  <td className="p-3">
                    <div className="flex flex-wrap gap-1">
                      <a href="/watch" target="_blank" rel="noreferrer" className="rounded bg-slate-700 px-2 py-1 text-xs">Voir live</a>
                      <button onClick={() => void runAction(row.id, "end_live")} className="rounded bg-amber-700 px-2 py-1 text-xs font-semibold">Terminer live</button>
                      <button onClick={() => void runAction(row.id, "ban_seller")} className="rounded bg-rose-700 px-2 py-1 text-xs font-semibold">Bannir vendeur</button>
                    </div>
                  </td>
                </tr>
              );
            }) : <tr><td colSpan={6} className="p-4">Aucun live.</td></tr>}
          </tbody>
        </table>
      </div>
    </AdminShell>
  );
}
