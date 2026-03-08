"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";

type Props = {
  title: string;
  children: ReactNode;
};

const NAV_ITEMS = [
  { href: "/admin/dashboard", label: "Dashboard" },
  { href: "/admin/sellers", label: "Vendeurs" },
  { href: "/admin/subscriptions", label: "Abonnements" },
  { href: "/admin/lives", label: "Lives" },
  { href: "/admin/users", label: "Utilisateurs" },
  { href: "/admin/reports", label: "Signalements" },
];

export default function AdminShell({ title, children }: Props) {
  const pathname = usePathname();
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const check = async () => {
      try {
        const res = await fetch("/api/admin/access", { cache: "no-store" });
        if (!res.ok) {
          window.location.href = "/dashboard-login?redirect=/admin/dashboard";
          return;
        }

        if (!mounted) return;
        setReady(true);
      } catch {
        if (!mounted) return;
        setError("Verification admin impossible.");
      }
    };

    void check();
    return () => {
      mounted = false;
    };
  }, []);

  if (error) {
    return <main className="min-h-screen bg-slate-950 text-slate-50 p-6">{error}</main>;
  }

  if (!ready) {
    return <main className="min-h-screen bg-slate-950 text-slate-50 p-6">Verification acces admin...</main>;
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50">
      <div className="mx-auto max-w-7xl px-3 py-4 md:px-6 md:py-6 grid lg:grid-cols-[240px_1fr] gap-4">
        <aside className="rounded-2xl border border-slate-700 bg-slate-900/70 p-4 h-fit lg:sticky lg:top-4">
          <p className="text-xs uppercase tracking-wide text-slate-400">Pitch Live</p>
          <h1 className="text-lg font-black mb-3">Admin Panel</h1>

          <nav className="grid gap-2">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-xl px-3 py-2 text-sm font-semibold ${
                  pathname === item.href ? "bg-emerald-600 text-white" : "bg-slate-800 text-slate-200"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </aside>

        <section className="grid gap-4">
          <header className="rounded-2xl border border-slate-700 bg-slate-900/70 px-4 py-3 flex items-center justify-between gap-2">
            <h2 className="text-xl md:text-2xl font-black">{title}</h2>
            <Link href="/dashboard" className="rounded-xl bg-slate-800 px-3 py-2 text-sm font-semibold">
              Retour dashboard
            </Link>
          </header>

          {children}
        </section>
      </div>
    </main>
  );
}
