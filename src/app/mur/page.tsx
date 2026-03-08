"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getValidatedStores } from "@/lib/boutique-data";

type ViewerProfile = {
  id: string;
  username: string;
  profileImage?: string;
  status?: string;
  validatedBy?: string;
  warningCount?: number;
  bannedUntil?: string | null;
  bannedPermanently?: boolean;
  lastModerationNote?: string;
};

type SellerWallProfile = {
  sellerId: string;
  storeName: string;
  tagline: string;
  whatsappNumber: string;
};

const FOLLOWING_KEY_PREFIX = "pitchlive.following.";
const ADMIN_AUTH_KEY = "pitchlive.admin.auth";

function isTempBanned(bannedUntil?: string | null) {
  if (!bannedUntil) return false;
  return new Date(bannedUntil).getTime() > Date.now();
}

function getViewerProfile(): ViewerProfile {
  if (typeof window === "undefined") {
    return { id: "guest", username: "guest" };
  }

  const raw = window.localStorage.getItem("pitchlive.viewer");
  if (!raw) {
    return { id: "guest", username: "guest" };
  }

  try {
    return JSON.parse(raw) as ViewerProfile;
  } catch {
    return { id: "guest", username: "guest" };
  }
}

export default function MurPage() {
  const [viewer, setViewer] = useState<ViewerProfile>({ id: "guest", username: "guest" });
  const [followedSellers, setFollowedSellers] = useState<SellerWallProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingPhoto, setSavingPhoto] = useState(false);
  const [adminMode, setAdminMode] = useState(false);

  const validatedStores = useMemo(() => getValidatedStores(), []);

  useEffect(() => {
    let mounted = true;

    const loadWall = async () => {
      const profile = getViewerProfile();
      if (mounted) {
        setViewer(profile);
        setAdminMode(window.sessionStorage.getItem(ADMIN_AUTH_KEY) === "1");
      }

      if ((profile.bannedPermanently || isTempBanned(profile.bannedUntil)) && window.sessionStorage.getItem(ADMIN_AUTH_KEY) !== "1") {
        window.localStorage.setItem("pitchlive.access", JSON.stringify({ visitor: false, seller: false }));
        window.location.href = "/login";
        return;
      }

      if (typeof window === "undefined") {
        if (mounted) setLoading(false);
        return;
      }

      const followedIds = Object.keys(window.localStorage)
        .filter((key) => key.startsWith(FOLLOWING_KEY_PREFIX) && window.localStorage.getItem(key) === "1")
        .map((key) => key.slice(FOLLOWING_KEY_PREFIX.length))
        .filter(Boolean);

      if (!followedIds.length) {
        if (mounted) {
          setFollowedSellers([]);
          setLoading(false);
        }
        return;
      }

      const fallbackById = new Map(
        validatedStores.map((store) => [
          store.id,
          {
            sellerId: store.id,
            storeName: store.displayName,
            tagline: store.tagline,
            whatsappNumber: store.whatsappNumber,
          },
        ])
      );

      const loaded = await Promise.all(
        followedIds.map(async (sellerId) => {
          try {
            const res = await fetch(`/api/seller/profile?sellerId=${encodeURIComponent(sellerId)}`, { cache: "no-store" });
            const body = (await res.json()) as {
              profile?: {
                sellerId?: string;
                storeName?: string;
                tagline?: string;
                whatsappNumber?: string;
              } | null;
            };

            if (!body.profile) {
              return fallbackById.get(sellerId) ?? null;
            }

            return {
              sellerId,
              storeName: body.profile.storeName?.trim() || fallbackById.get(sellerId)?.storeName || "Vendeur",
              tagline: body.profile.tagline?.trim() || fallbackById.get(sellerId)?.tagline || "Boutique disponible",
              whatsappNumber: body.profile.whatsappNumber?.trim() || fallbackById.get(sellerId)?.whatsappNumber || "",
            };
          } catch {
            return fallbackById.get(sellerId) ?? null;
          }
        })
      );

      if (mounted) {
        setFollowedSellers(loaded.filter((item): item is SellerWallProfile => Boolean(item)));
        setLoading(false);
      }
    };

    void loadWall();

    return () => {
      mounted = false;
    };
  }, [validatedStores]);

  const followedIds = new Set(followedSellers.map((seller) => seller.sellerId));
  const otherStores = validatedStores.filter((store) => !followedIds.has(store.id));

  const unfollowSeller = (sellerId: string) => {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(`${FOLLOWING_KEY_PREFIX}${sellerId}`);
    }

    setFollowedSellers((prev) => prev.filter((seller) => seller.sellerId !== sellerId));
  };

  const followSeller = (seller: { id: string; displayName: string; tagline: string; whatsappNumber: string }) => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(`${FOLLOWING_KEY_PREFIX}${seller.id}`, "1");
    }

    setFollowedSellers((prev) => {
      if (prev.some((item) => item.sellerId === seller.id)) return prev;
      return [
        {
          sellerId: seller.id,
          storeName: seller.displayName,
          tagline: seller.tagline,
          whatsappNumber: seller.whatsappNumber,
        },
        ...prev,
      ];
    });
  };

  const onProfilePhotoChange = async (event: any) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) return;

    setSavingPhoto(true);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ""));
        reader.onerror = () => reject(new Error("read-failed"));
        reader.readAsDataURL(file);
      });

      const nextViewer = { ...viewer, profileImage: dataUrl };
      setViewer(nextViewer);
      if (typeof window !== "undefined") {
        window.localStorage.setItem("pitchlive.viewer", JSON.stringify(nextViewer));
      }
    } catch {
      // keep previous photo silently on read failure.
    } finally {
      setSavingPhoto(false);
    }
  };

  const saveViewerModeration = (next: ViewerProfile) => {
    setViewer(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem("pitchlive.viewer", JSON.stringify(next));
    }
  };

  const validateVisitorInfos = () => {
    saveViewerModeration({
      ...viewer,
      status: "validated",
      validatedBy: "admin",
      lastModerationNote: "Informations visiteur validees depuis le mur",
    });
  };

  const warnVisitor = () => {
    saveViewerModeration({
      ...viewer,
      warningCount: (viewer.warningCount ?? 0) + 1,
      lastModerationNote: "Avertissement admin envoye",
    });
  };

  const banVisitorTemporary = () => {
    saveViewerModeration({
      ...viewer,
      bannedUntil: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      bannedPermanently: false,
      lastModerationNote: "Ban temporaire 24h",
    });
  };

  const banVisitorPermanent = () => {
    saveViewerModeration({
      ...viewer,
      bannedPermanently: true,
      bannedUntil: null,
      lastModerationNote: "Ban definitif",
    });
  };

  const clearVisitorBan = () => {
    saveViewerModeration({
      ...viewer,
      bannedPermanently: false,
      bannedUntil: null,
      lastModerationNote: "Ban leve",
    });
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 px-4 py-6 md:p-8">
      <section className="mx-auto max-w-5xl grid gap-6">
        <header className="rounded-2xl border border-slate-700 bg-slate-900/70 p-4 md:p-6 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <img
              src={viewer.profileImage || `https://api.dicebear.com/7.x/thumbs/svg?seed=${encodeURIComponent(viewer.username || viewer.id)}`}
              alt="Photo profil visiteur"
              className="h-14 w-14 rounded-full border border-slate-500 bg-slate-800"
            />
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-wider text-slate-400">Mon mur</p>
              <h1 className="text-xl md:text-2xl font-bold truncate">{viewer.username}</h1>
              <p className="text-sm text-slate-300">Vendeurs suivis: {followedSellers.length}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Link href="/watch" className="rounded-full bg-emerald-600 px-4 py-2 font-semibold">
              Revenir au live
            </Link>
            <Link href="/boutique" className="rounded-full bg-slate-700 px-4 py-2 font-semibold">
              Voir toutes les boutiques
            </Link>
            <label className="rounded-full bg-indigo-700 px-4 py-2 font-semibold cursor-pointer">
              {savingPhoto ? "Chargement..." : "Changer ma photo"}
              <input type="file" accept="image/*" className="hidden" onChange={(event) => void onProfilePhotoChange(event)} />
            </label>
          </div>
        </header>

        {adminMode ? (
          <article className="rounded-2xl border border-sky-500/45 bg-sky-900/15 p-4 md:p-5 grid gap-3">
            <h2 className="text-lg font-bold">Moderation visiteur (admin)</h2>
            <p className="text-sm text-slate-200">
              Statut: <strong>{(viewer.status || "pending").toUpperCase()}</strong> • Avertissements: <strong>{viewer.warningCount ?? 0}</strong>
            </p>
            <p className="text-sm text-slate-200">
              Ban: <strong>{viewer.bannedPermanently ? "DEFINITIF" : isTempBanned(viewer.bannedUntil) ? `TEMPORAIRE jusqu'au ${new Date(String(viewer.bannedUntil)).toLocaleString("fr-FR")}` : "AUCUN"}</strong>
            </p>
            {viewer.lastModerationNote ? <p className="text-xs text-slate-300">Derniere action: {viewer.lastModerationNote}</p> : null}

            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={validateVisitorInfos} className="rounded-full bg-emerald-600 px-3 py-2 text-sm font-semibold">
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
            </div>
          </article>
        ) : null}

        <article className="rounded-2xl border border-slate-700 bg-slate-900/70 p-4 md:p-6 grid gap-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg md:text-xl font-bold">Vendeurs auxquels vous etes abonne</h2>
            {loading ? <span className="text-sm text-slate-400">Chargement...</span> : null}
          </div>

          {!loading && !followedSellers.length ? (
            <div className="rounded-xl border border-slate-700 bg-slate-800/60 p-4 text-sm text-slate-300">
              Aucun abonnement pour le moment. Pendant un live, clique sur <strong>+ Suivre</strong> puis reviens ici.
            </div>
          ) : null}

          <div className="grid gap-3 md:grid-cols-2">
            {followedSellers.map((seller) => (
              <div key={seller.sellerId} className="rounded-xl border border-slate-700 bg-slate-800/70 p-4 grid gap-3">
                <div className="flex items-center gap-3">
                  <img
                    src={`https://api.dicebear.com/7.x/thumbs/svg?seed=${encodeURIComponent(seller.storeName)}`}
                    alt={`Profil ${seller.storeName}`}
                    className="h-11 w-11 rounded-full border border-slate-500 bg-slate-700"
                  />
                  <div className="min-w-0">
                    <h3 className="font-semibold truncate">{seller.storeName}</h3>
                    <p className="text-sm text-slate-300 line-clamp-2">{seller.tagline}</p>
                  </div>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <Link href={`/boutique/${encodeURIComponent(seller.sellerId)}`} className="rounded-full bg-emerald-600 px-3 py-2 text-sm font-semibold">
                    Visiter la boutique
                  </Link>
                  <Link href="/watch" className="rounded-full bg-slate-700 px-3 py-2 text-sm font-semibold">
                    Voir les lives
                  </Link>
                  <button
                    type="button"
                    onClick={() => unfollowSeller(seller.sellerId)}
                    className="rounded-full bg-rose-700/80 px-3 py-2 text-sm font-semibold"
                  >
                    Se desabonner
                  </button>
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className="rounded-2xl border border-slate-700 bg-slate-900/70 p-4 md:p-6 grid gap-4">
          <h2 className="text-lg md:text-xl font-bold">Autres vendeurs disponibles</h2>
          <div className="grid gap-3 md:grid-cols-2">
            {otherStores.map((store) => (
              <div key={store.id} className="rounded-xl border border-slate-700 bg-slate-800/60 p-4 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold truncate">{store.displayName}</p>
                  <p className="text-sm text-slate-300 truncate">{store.tagline}</p>
                </div>
                <div className="flex gap-2 flex-wrap justify-end">
                  <button
                    type="button"
                    onClick={() => followSeller(store)}
                    className="rounded-full bg-pink-600 px-3 py-2 text-sm font-semibold whitespace-nowrap"
                  >
                    S'abonner
                  </button>
                  <Link href={`/boutique/${encodeURIComponent(store.id)}`} className="rounded-full bg-slate-700 px-3 py-2 text-sm font-semibold whitespace-nowrap">
                    Boutique
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </article>
      </section>
    </main>
  );
}
