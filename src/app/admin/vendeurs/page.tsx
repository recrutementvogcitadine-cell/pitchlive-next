"use client";

import { useEffect, useState } from "react";
import { createClient as createSupabaseClient } from "@/lib/supabase/client";

const SELLER_STATUS_TAG_PREFIX = "SELLER_STATUS:";

type SellerProfileRow = {
  seller_id: string;
  store_name: string;
  tagline: string;
  whatsapp_number: string;
  updated_at: string;
};

type SellerRegistration = {
  id: string;
  firstName: string;
  lastName: string;
  storeName: string;
  phone: string;
  plan: "jour" | "semaine" | "mois";
  planStartAt: string;
  planEndAt: string;
  status: "pending" | "validated" | "refused";
  createdAt?: string;
  validatedBy?: string;
  certifiedBadge?: boolean;
  warningCount?: number;
  bannedUntil?: string | null;
  bannedPermanently?: boolean;
  lastModerationNote?: string;
};

type VisitorProfile = {
  id: string;
  username: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  status?: string;
  validatedBy?: string;
  warningCount?: number;
  bannedUntil?: string | null;
  bannedPermanently?: boolean;
  lastModerationNote?: string;
};

function isTempBanned(bannedUntil?: string | null) {
  if (!bannedUntil) return false;
  return new Date(bannedUntil).getTime() > Date.now();
}

function moderationLabel(input: { bannedPermanently?: boolean; bannedUntil?: string | null }) {
  if (input.bannedPermanently) return "BANNI DEFINITIF";
  if (isTempBanned(input.bannedUntil)) {
    return `BANNI TEMPORAIRE jusqu'au ${new Date(String(input.bannedUntil)).toLocaleString("fr-FR")}`;
  }
  return "AUCUN BAN";
}

function parseStatusFromTagline(tagline?: string | null): SellerRegistration["status"] {
  const value = String(tagline ?? "").trim();
  if (!value.startsWith(SELLER_STATUS_TAG_PREFIX)) return "pending";
  const status = value.slice(SELLER_STATUS_TAG_PREFIX.length).split("|")[0].trim();
  if (status === "validated") return "validated";
  if (status === "refused") return "refused";
  return "pending";
}

function buildStatusTagline(status: SellerRegistration["status"]) {
  return `${SELLER_STATUS_TAG_PREFIX}${status}`;
}

export default function AdminVendeursPage() {
  const [isAuthed, setIsAuthed] = useState(false);
  const [pin, setPin] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [registration, setRegistration] = useState<SellerRegistration | null>(null);
  const [visitor, setVisitor] = useState<VisitorProfile | null>(null);

  const ADMIN_AUTH_KEY = "pitchlive.admin.auth";

  const loadRegistration = async () => {
    const raw = window.localStorage.getItem("pitchlive.seller.registration");
    let localRegistration: SellerRegistration | null = null;
    if (raw) {
      try {
        localRegistration = JSON.parse(raw) as SellerRegistration;
        setRegistration(localRegistration);
      } catch {
        localRegistration = null;
        setRegistration(null);
      }
    }

    try {
      const supabase = createSupabaseClient();
      const { data, error } = await supabase
        .from("seller_store_profiles")
        .select("seller_id,store_name,tagline,whatsapp_number,updated_at")
        .ilike("tagline", `${SELLER_STATUS_TAG_PREFIX}%`)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle<SellerProfileRow>();

      if (!error && data) {
        const fallbackIso = new Date().toISOString();
        const sharedRegistration: SellerRegistration = {
          id: data.seller_id || "main-creator",
          firstName: "Vendeur",
          lastName: "",
          storeName: data.store_name || "Boutique",
          phone: data.whatsapp_number || "",
          plan: "jour",
          planStartAt: data.updated_at || fallbackIso,
          planEndAt: data.updated_at || fallbackIso,
          status: parseStatusFromTagline(data.tagline),
          createdAt: data.updated_at || fallbackIso,
          lastModerationNote: data.tagline || "Demande recue",
        };
        setRegistration(sharedRegistration);
        window.localStorage.setItem("pitchlive.seller.registration", JSON.stringify(sharedRegistration));
        return;
      }
    } catch {
      // Keep fallback paths below.
    }

    try {
      const res = await fetch(`/api/seller/profile?sellerId=${encodeURIComponent("main-creator")}`, { cache: "no-store" });
      const body = (await res.json()) as {
        source?: string;
        profile?: {
          sellerId?: string;
          storeName?: string;
          tagline?: string;
          whatsappNumber?: string;
        } | null;
      };

      if (!body?.profile) {
        setRegistration(localRegistration);
        return;
      }

      const nowIso = new Date().toISOString();
      const next: SellerRegistration = {
        id: body.profile.sellerId || "main-creator",
        firstName: "Vendeur",
        lastName: "",
        storeName: body.profile.storeName || "Boutique",
        phone: body.profile.whatsappNumber || "",
        plan: "jour",
        planStartAt: nowIso,
        planEndAt: nowIso,
        status: parseStatusFromTagline(body.profile.tagline),
        createdAt: nowIso,
        lastModerationNote: body.profile.tagline || "Demande recue",
      };
      setRegistration(next);
      window.localStorage.setItem("pitchlive.seller.registration", JSON.stringify(next));
    } catch {
      setRegistration(localRegistration);
    }
  };

  const loadVisitor = () => {
    const raw = window.localStorage.getItem("pitchlive.viewer");
    if (!raw) {
      setVisitor(null);
      return;
    }

    try {
      setVisitor(JSON.parse(raw) as VisitorProfile);
    } catch {
      setVisitor(null);
    }
  };

  useEffect(() => {
    const existing = window.sessionStorage.getItem(ADMIN_AUTH_KEY);
    if (existing === "1") {
      setIsAuthed(true);
    }
  }, []);

  useEffect(() => {
    if (!isAuthed) return;
    void loadRegistration();
    loadVisitor();
  }, [isAuthed]);

  const verifyPin = async () => {
    setAuthError(null);
    if (!pin.trim()) {
      setAuthError("Entre le code PIN admin.");
      return;
    }

    setAuthBusy(true);
    try {
      const res = await fetch("/api/admin/verify-pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: pin.trim() }),
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error || "PIN invalide");
      }

      window.sessionStorage.setItem(ADMIN_AUTH_KEY, "1");
      setIsAuthed(true);
      setPin("");
    } catch (err) {
      const message = err instanceof Error ? err.message : "PIN invalide";
      setAuthError(message);
    } finally {
      setAuthBusy(false);
    }
  };

  const logoutAdmin = () => {
    window.sessionStorage.removeItem(ADMIN_AUTH_KEY);
    setIsAuthed(false);
  };

  const saveSeller = (next: SellerRegistration) => {
    setRegistration(next);
    window.localStorage.setItem("pitchlive.seller.registration", JSON.stringify(next));

    const supabase = createSupabaseClient();
    void supabase
      .from("seller_store_profiles")
      .upsert(
        {
          seller_id: next.id,
          store_name: next.storeName,
          tagline: buildStatusTagline(next.status),
          whatsapp_number: next.phone || "22500000000",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "seller_id" }
      )
      .catch(() => undefined);

    void fetch("/api/seller/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sellerId: next.id,
        storeName: next.storeName,
        tagline: buildStatusTagline(next.status),
        whatsappNumber: next.phone || "22500000000",
      }),
    }).catch(() => undefined);
  };

  const saveVisitor = (next: VisitorProfile) => {
    setVisitor(next);
    window.localStorage.setItem("pitchlive.viewer", JSON.stringify(next));
  };

  if (!isAuthed) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-100 px-4 py-8 md:p-10">
        <section className="mx-auto max-w-md grid gap-5">
          <h1 className="text-3xl font-black">Admin Validation Vendeurs</h1>
          <article className="rounded-2xl border border-slate-700 bg-slate-900/70 p-5 grid gap-3">
            <p className="text-sm text-slate-300">Entrez le PIN admin pour acceder aux validations vendeurs.</p>
            <input
              type="password"
              value={pin}
              onChange={(event) => setPin(event.target.value)}
              className="rounded-xl border border-slate-600 bg-slate-800 px-3 py-2 outline-none"
              placeholder="PIN admin"
            />
            <button
              type="button"
              onClick={() => void verifyPin()}
              disabled={authBusy}
              className="rounded-xl bg-blue-600 px-4 py-3 font-bold disabled:opacity-50"
            >
              {authBusy ? "Verification..." : "Acceder"}
            </button>
            {authError ? <p className="text-sm text-rose-300">Erreur: {authError}</p> : null}
          </article>
        </section>
      </main>
    );
  }

  const setStatus = (status: SellerRegistration["status"]) => {
    if (!registration) return;
    const next: SellerRegistration = {
      ...registration,
      status,
      certifiedBadge: status === "validated" ? true : registration.certifiedBadge,
      validatedBy: status === "validated" ? "admin" : registration.validatedBy,
      lastModerationNote: `Statut modifie en ${status}`,
    };
    saveSeller(next);
  };

  const warnSeller = () => {
    if (!registration) return;
    const next = {
      ...registration,
      warningCount: (registration.warningCount ?? 0) + 1,
      lastModerationNote: "Avertissement admin envoye",
    };
    saveSeller(next);
  };

  const banSellerTemporary = () => {
    if (!registration) return;
    const until = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const next = {
      ...registration,
      bannedUntil: until,
      bannedPermanently: false,
      lastModerationNote: "Ban temporaire 24h",
    };
    saveSeller(next);
  };

  const banSellerPermanent = () => {
    if (!registration) return;
    const next = {
      ...registration,
      status: "refused" as const,
      bannedPermanently: true,
      bannedUntil: null,
      lastModerationNote: "Ban definitif",
    };
    saveSeller(next);
  };

  const clearSellerBan = () => {
    if (!registration) return;
    const next = {
      ...registration,
      bannedPermanently: false,
      bannedUntil: null,
      lastModerationNote: "Ban leve",
    };
    saveSeller(next);
  };

  const validateVisitorInfos = () => {
    if (!visitor) return;
    const next = {
      ...visitor,
      status: "validated",
      validatedBy: "admin",
      lastModerationNote: "Informations visiteur validees",
    };
    saveVisitor(next);
  };

  const warnVisitor = () => {
    if (!visitor) return;
    const next = {
      ...visitor,
      warningCount: (visitor.warningCount ?? 0) + 1,
      lastModerationNote: "Avertissement visiteur envoye",
    };
    saveVisitor(next);
  };

  const banVisitorTemporary = () => {
    if (!visitor) return;
    const until = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const next = {
      ...visitor,
      bannedUntil: until,
      bannedPermanently: false,
      lastModerationNote: "Ban visiteur temporaire 24h",
    };
    saveVisitor(next);
  };

  const banVisitorPermanent = () => {
    if (!visitor) return;
    const next = {
      ...visitor,
      bannedPermanently: true,
      bannedUntil: null,
      lastModerationNote: "Ban visiteur definitif",
    };
    saveVisitor(next);
  };

  const clearVisitorBan = () => {
    if (!visitor) return;
    const next = {
      ...visitor,
      bannedPermanently: false,
      bannedUntil: null,
      lastModerationNote: "Ban visiteur leve",
    };
    saveVisitor(next);
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 px-4 py-8 md:p-10">
      <section className="mx-auto max-w-3xl grid gap-5">
        <h1 className="text-3xl font-black">Admin Validation Vendeurs</h1>
        <p className="text-sm text-slate-300">Page admin locale pour valider/refuser les demandes vendeurs.</p>

        <div>
          <a href="/dashboard" className="rounded-full bg-sky-700 px-3 py-2 text-sm font-semibold inline-flex">
            Ouvrir dashboard realtime
          </a>
        </div>

        <div>
          <button type="button" onClick={logoutAdmin} className="rounded-full bg-slate-700 px-3 py-2 text-sm font-semibold">
            Deconnexion admin
          </button>
        </div>

        {!registration ? (
          <article className="rounded-2xl border border-slate-700 bg-slate-900/70 p-5">
            <p>Aucune demande vendeur en attente.</p>
          </article>
        ) : (
          <article className="rounded-2xl border border-slate-700 bg-slate-900/70 p-5 grid gap-3">
            <p>
              Vendeur: <strong>{registration.firstName} {registration.lastName}</strong>
            </p>
            <p>
              Boutique: <strong>{registration.storeName}</strong>
            </p>
            <p>
              Telephone: <strong>{registration.phone}</strong>
            </p>
            <p>
              Forfait: <strong>{registration.plan.toUpperCase()}</strong>
            </p>
            <p>
              Statut actuel: <strong>{registration.status.toUpperCase()}</strong>
            </p>
            <p>
              Badge certifie: <strong className={registration.certifiedBadge ? "text-sky-300" : "text-slate-300"}>{registration.certifiedBadge ? "BLEU ACTIF" : "NON"}</strong>
            </p>
            <p>
              Avertissements: <strong>{registration.warningCount ?? 0}</strong>
            </p>
            <p>
              Ban: <strong>{moderationLabel(registration)}</strong>
            </p>
            {registration.lastModerationNote ? (
              <p className="text-xs text-slate-300">Derniere action: {registration.lastModerationNote}</p>
            ) : null}

            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => setStatus("pending")} className="rounded-full bg-amber-700 px-3 py-2 text-sm font-semibold">
                Mettre en attente
              </button>
              <button type="button" onClick={() => setStatus("validated")} className="rounded-full bg-emerald-700 px-3 py-2 text-sm font-semibold">
                Valider
              </button>
              <button type="button" onClick={warnSeller} className="rounded-full bg-orange-600 px-3 py-2 text-sm font-semibold">
                Avertissement
              </button>
              <button type="button" onClick={banSellerTemporary} className="rounded-full bg-rose-700 px-3 py-2 text-sm font-semibold">
                Ban temporaire
              </button>
              <button type="button" onClick={banSellerPermanent} className="rounded-full bg-red-700 px-3 py-2 text-sm font-semibold">
                Ban definitif
              </button>
              <button type="button" onClick={clearSellerBan} className="rounded-full bg-cyan-700 px-3 py-2 text-sm font-semibold">
                Lever ban
              </button>
              <button type="button" onClick={() => setStatus("refused")} className="rounded-full bg-rose-700 px-3 py-2 text-sm font-semibold">
                Refuser
              </button>
              <button type="button" onClick={() => void loadRegistration()} className="rounded-full bg-slate-700 px-3 py-2 text-sm font-semibold">
                Recharger
              </button>
            </div>
          </article>
        )}

        <article className="rounded-2xl border border-slate-700 bg-slate-900/70 p-5 grid gap-3">
          <h2 className="text-xl font-bold">Moderation Visiteur</h2>
          {!visitor ? (
            <p className="text-sm text-slate-300">Aucun visiteur local enregistre pour le moment.</p>
          ) : (
            <>
              <p>Visiteur: <strong>{visitor.username}</strong></p>
              <p>Telephone: <strong>{visitor.phone || "--"}</strong></p>
              <p>Statut infos: <strong>{(visitor.status || "pending").toUpperCase()}</strong></p>
              <p>Avertissements: <strong>{visitor.warningCount ?? 0}</strong></p>
              <p>Ban: <strong>{moderationLabel(visitor)}</strong></p>
              {visitor.lastModerationNote ? (
                <p className="text-xs text-slate-300">Derniere action: {visitor.lastModerationNote}</p>
              ) : null}

              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={validateVisitorInfos} className="rounded-full bg-emerald-700 px-3 py-2 text-sm font-semibold">
                  Valider infos visiteur
                </button>
                <button type="button" onClick={warnVisitor} className="rounded-full bg-orange-600 px-3 py-2 text-sm font-semibold">
                  Avertissement
                </button>
                <button type="button" onClick={banVisitorTemporary} className="rounded-full bg-rose-700 px-3 py-2 text-sm font-semibold">
                  Ban temporaire
                </button>
                <button type="button" onClick={banVisitorPermanent} className="rounded-full bg-red-700 px-3 py-2 text-sm font-semibold">
                  Ban definitif
                </button>
                <button type="button" onClick={clearVisitorBan} className="rounded-full bg-cyan-700 px-3 py-2 text-sm font-semibold">
                  Lever ban
                </button>
                <button type="button" onClick={loadVisitor} className="rounded-full bg-slate-700 px-3 py-2 text-sm font-semibold">
                  Recharger visiteur
                </button>
              </div>
            </>
          )}
        </article>
      </section>
    </main>
  );
}
