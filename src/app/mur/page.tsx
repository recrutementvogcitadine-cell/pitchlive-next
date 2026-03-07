"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getValidatedStores } from "@/lib/boutique-data";

type ViewerProfile = {
  id: string;
  username: string;
};

type SellerWallProfile = {
  sellerId: string;
  storeName: string;
  tagline: string;
  whatsappNumber: string;
};

const FOLLOWING_KEY_PREFIX = "pitchlive.following.";

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

  const validatedStores = useMemo(() => getValidatedStores(), []);

  useEffect(() => {
    let mounted = true;

    const loadWall = async () => {
      const profile = getViewerProfile();
      if (mounted) {
        setViewer(profile);
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

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 px-4 py-6 md:p-8">
      <section className="mx-auto max-w-5xl grid gap-6">
        <header className="rounded-2xl border border-slate-700 bg-slate-900/70 p-4 md:p-6 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <img
              src={`https://api.dicebear.com/7.x/thumbs/svg?seed=${encodeURIComponent(viewer.username || viewer.id)}`}
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
          </div>
        </header>

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
                <Link href={`/boutique/${encodeURIComponent(store.id)}`} className="rounded-full bg-slate-700 px-3 py-2 text-sm font-semibold whitespace-nowrap">
                  Boutique
                </Link>
              </div>
            ))}
          </div>
        </article>
      </section>
    </main>
  );
}
