"use client";

import { Camera, House, Search } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";

type SellerRegistration = {
  status?: "pending" | "validated" | "refused";
};

function shouldShowOnPath(pathname: string) {
  return (
    pathname.startsWith("/watch") ||
    pathname.startsWith("/boutique") ||
    pathname.startsWith("/mur") ||
    pathname.startsWith("/creator") ||
    pathname.startsWith("/recherche") ||
    pathname.startsWith("/choix-mode")
  );
}

export default function LiveBottomNav() {
  const pathname = usePathname();
  const router = useRouter();

  const hapticTap = (pattern: number | number[] = 12) => {
    if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
      navigator.vibrate(pattern);
    }
  };

  if (!pathname || !shouldShowOnPath(pathname)) {
    return null;
  }

  const onCamera = () => {
    hapticTap([12, 30, 18]);

    if (typeof window === "undefined") {
      router.push("/vendeur/inscription");
      return;
    }

    try {
      const rawRegistration = window.localStorage.getItem("pitchlive.seller.registration");
      const registration = rawRegistration ? (JSON.parse(rawRegistration) as SellerRegistration) : null;

      if (registration?.status === "validated") {
        router.push("/creator/studio");
        return;
      }

      router.push("/vendeur/inscription");
    } catch {
      router.push("/vendeur/inscription");
    }
  };

  const homeActive = pathname.startsWith("/boutique");
  const searchActive = pathname.startsWith("/recherche");

  return (
    <>
      <div className="safe-bottom-spacer" aria-hidden />
      <nav className="safe-bottom-nav fixed bottom-0 left-0 right-0 z-40 border-t border-slate-700 bg-slate-950/95 backdrop-blur navGlowBar">
        <div className="mx-auto flex h-20 max-w-xl items-center justify-between px-7 relative">
          <button
            type="button"
            onClick={() => {
              hapticTap(10);
              router.push("/boutique");
            }}
            className={`inline-flex h-11 w-11 items-center justify-center rounded-full border ${
              homeActive
                ? "border-emerald-300 bg-emerald-900/45 text-emerald-100 navActiveIcon"
                : "border-slate-600 bg-slate-800 text-slate-100"
            }`}
            aria-label="Voir les boutiques"
          >
            <House size={22} />
          </button>

          <div className="relative -mt-8">
            <span className="navLiveBadge" aria-hidden>
              LIVE
            </span>
            <button
              type="button"
              onClick={onCamera}
              className="inline-flex h-16 w-16 items-center justify-center rounded-full border border-red-200 bg-gradient-to-b from-red-500 to-red-700 text-white shadow-[0_14px_36px_rgba(239,68,68,0.5)] navCameraButton"
              aria-label="Lancer un live"
            >
              <Camera size={28} />
            </button>
          </div>

          <button
            type="button"
            onClick={() => {
              hapticTap(10);
              router.push("/recherche");
            }}
            className={`inline-flex h-11 w-11 items-center justify-center rounded-full border ${
              searchActive
                ? "border-sky-300 bg-sky-900/45 text-sky-100 navActiveIcon"
                : "border-slate-600 bg-slate-800 text-slate-100"
            }`}
            aria-label="Rechercher une boutique"
          >
            <Search size={22} />
          </button>
        </div>
      </nav>
    </>
  );
}
