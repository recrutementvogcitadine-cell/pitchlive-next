"use client";

import { useEffect, useMemo, useState } from "react";
import AdminShell from "@/components/admin/AdminShell";

type UserRow = {
  id: string;
  email: string | null;
  username: string | null;
  country: string | null;
  created_at: string | null;
  moderation_status: string | null;
};

export default function AdminUsersPage() {
  const [rows, setRows] = useState<UserRow[]>([]);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    const res = await fetch(`/api/admin/users?${params.toString()}`, { cache: "no-store" });
    const body = (await res.json().catch(() => ({}))) as { rows?: UserRow[]; error?: string };
    if (!res.ok) {
      setError(body.error || "Impossible de charger les utilisateurs");
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
    return rows.filter((row) => String(row.username ?? "").toLowerCase().includes(q) || String(row.email ?? "").toLowerCase().includes(q));
  }, [rows, query]);

  const runAction = async (userId: string, action: "suspend" | "ban") => {
    const res = await fetch(`/api/admin/users/${encodeURIComponent(userId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) {
      setError(body.error || "Action utilisateur impossible");
      return;
    }

    await load();
  };

  return (
    <AdminShell title="Gestion des utilisateurs">
      <div className="rounded-2xl border border-slate-700 bg-slate-900/70 p-4 grid md:grid-cols-[1fr_auto] gap-2">
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Recherche nom/email..." className="rounded-xl border border-slate-600 bg-slate-800 px-3 py-2" />
        <button onClick={() => void load()} className="rounded-xl bg-slate-700 px-4 py-2 font-semibold">Rechercher</button>
      </div>

      {error ? <p className="text-red-300 text-sm">Erreur: {error}</p> : null}

      <div className="rounded-2xl border border-slate-700 bg-slate-900/70 overflow-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-800/80">
            <tr>
              <th className="text-left p-3">Nom</th>
              <th className="text-left p-3">Email</th>
              <th className="text-left p-3">Pays</th>
              <th className="text-left p-3">Date inscription</th>
              <th className="text-left p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length ? filtered.map((row) => (
              <tr key={row.id} className="border-t border-slate-700">
                <td className="p-3">{row.username || row.id}</td>
                <td className="p-3">{row.email || "--"}</td>
                <td className="p-3">{row.country || "--"}</td>
                <td className="p-3">{row.created_at ? new Date(row.created_at).toLocaleString("fr-FR") : "--"}</td>
                <td className="p-3">
                  <div className="flex flex-wrap gap-1">
                    <button className="rounded bg-slate-700 px-2 py-1 text-xs">Voir profil</button>
                    <button onClick={() => void runAction(row.id, "suspend")} className="rounded bg-amber-700 px-2 py-1 text-xs font-semibold">Suspendre utilisateur</button>
                    <button onClick={() => void runAction(row.id, "ban")} className="rounded bg-rose-700 px-2 py-1 text-xs font-semibold">Bannir utilisateur</button>
                  </div>
                </td>
              </tr>
            )) : <tr><td colSpan={5} className="p-4">Aucun utilisateur.</td></tr>}
          </tbody>
        </table>
      </div>
    </AdminShell>
  );
}
