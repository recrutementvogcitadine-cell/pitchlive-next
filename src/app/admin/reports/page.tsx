"use client";

import { useEffect, useState } from "react";
import AdminShell from "@/components/admin/AdminShell";

type ReportRow = {
  id: string;
  report_type: string;
  target_type: string;
  target_id: string;
  details: string;
  status: string;
  created_at: string;
};

export default function AdminReportsPage() {
  const [rows, setRows] = useState<ReportRow[]>([]);

  useEffect(() => {
    const load = async () => {
      const res = await fetch("/api/admin/reports", { cache: "no-store" });
      const body = (await res.json().catch(() => ({}))) as { rows?: ReportRow[] };
      setRows(body.rows ?? []);
    };

    void load();
  }, []);

  return (
    <AdminShell title="Systeme de moderation / reports">
      <div className="rounded-2xl border border-slate-700 bg-slate-900/70 overflow-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-800/80">
            <tr>
              <th className="text-left p-3">Type</th>
              <th className="text-left p-3">Cible</th>
              <th className="text-left p-3">Details</th>
              <th className="text-left p-3">Statut</th>
              <th className="text-left p-3">Date</th>
            </tr>
          </thead>
          <tbody>
            {rows.length ? (
              rows.map((row) => (
                <tr key={row.id} className="border-t border-slate-700">
                  <td className="p-3">{row.report_type}</td>
                  <td className="p-3">{row.target_type}:{row.target_id}</td>
                  <td className="p-3">{row.details || "--"}</td>
                  <td className="p-3">{row.status}</td>
                  <td className="p-3">{new Date(row.created_at).toLocaleString("fr-FR")}</td>
                </tr>
              ))
            ) : (
              <tr><td colSpan={5} className="p-4">Aucun signalement.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </AdminShell>
  );
}
