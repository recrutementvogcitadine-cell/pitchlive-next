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

  if (!pathname || !shouldShowOnPath(pathname)) {
    return null;
  }

  const onCamera = () => {
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
      <div className="h-24 md:h-28" aria-hidden />
      <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-slate-700 bg-slate-950/95 backdrop-blur">
        <div className="mx-auto flex h-20 max-w-xl items-center justify-between px-7">
          <button
            type="button"
            onClick={() => router.push("/boutique")}
            className={`inline-flex h-11 w-11 items-center justify-center rounded-full border ${
              homeActive
                ? "border-emerald-400 bg-emerald-900/35 text-emerald-200"
                : "border-slate-600 bg-slate-800 text-slate-100"
            }`}
            aria-label="Voir les boutiques"
          >
            <House size={22} />
          </button>

          <button
            type="button"
            onClick={onCamera}
            className="-mt-8 inline-flex h-16 w-16 items-center justify-center rounded-full border border-red-300 bg-gradient-to-b from-red-500 to-red-700 text-white shadow-[0_14px_36px_rgba(239,68,68,0.5)]"
            aria-label="Lancer un live"
          >
            <Camera size={28} />
          </button>

          <button
            type="button"
            onClick={() => router.push("/recherche")}
            className={`inline-flex h-11 w-11 items-center justify-center rounded-full border ${
              searchActive
                ? "border-sky-400 bg-sky-900/35 text-sky-200"
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
