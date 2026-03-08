"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  getDefaultSellerProfile,
  getSellerStoreById,
  getStoreProductsLimited,
  normalizeWhatsappNumber,
  type SellerStoreProfile,
} from "@/lib/boutique-data";

  type ViewerProfile = {
    id: string;
    status?: string;
  };

function formatXof(value: number) {
  return new Intl.NumberFormat("fr-FR").format(value);
}

function buildWhatsAppUrl(phoneNumber: string, productName: string) {
  const normalized = normalizeWhatsappNumber(phoneNumber);
  const message = encodeURIComponent(`Bonjour, je veux commander: ${productName}`);
  return `https://wa.me/${normalized}?text=${message}`;
}

export default function SellerBoutiquePage() {
  const params = useParams<{ sellerId: string }>();
  const sellerId = String(params?.sellerId ?? "");

  const store = useMemo(() => getSellerStoreById(sellerId), [sellerId]);
  const [profile, setProfile] = useState<SellerStoreProfile | null>(null);
  const [canOrderOnWhatsapp, setCanOrderOnWhatsapp] = useState(false);

  useEffect(() => {
    let mounted = true;

    const fallback = getDefaultSellerProfile(sellerId);
    if (fallback && mounted) setProfile(fallback);

    const load = async () => {
      try {
        const res = await fetch(`/api/seller/profile?sellerId=${encodeURIComponent(sellerId)}`, { cache: "no-store" });
        const body = (await res.json()) as { profile?: SellerStoreProfile | null };
        if (!mounted || !body.profile) return;
        setProfile(body.profile);
      } catch {
        // Keep fallback profile silently.
      }
    };

    if (sellerId) {
      void load();
    }

    return () => {
      mounted = false;
    };
  }, [sellerId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem("pitchlive.viewer");
      if (!raw) {
        setCanOrderOnWhatsapp(false);
        return;
      }
      const viewer = JSON.parse(raw) as ViewerProfile;
      setCanOrderOnWhatsapp(viewer.status === "validated");
    } catch {
      setCanOrderOnWhatsapp(false);
    }
  }, []);

  if (!store || !store.isValidated) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-100 p-6 grid place-items-center">
        <section className="max-w-xl text-center grid gap-3">
          <h1 className="text-2xl font-bold">Boutique introuvable</h1>
          <p className="text-slate-300">Ce vendeur n&apos;est pas valide ou la boutique n&apos;existe pas.</p>
          <div className="flex items-center justify-center gap-2">
            <Link href="/boutique" className="rounded-full bg-orange-500 px-4 py-2 font-semibold">
              Voir les boutiques valides
            </Link>
            <Link href="/watch" className="rounded-full bg-emerald-600 px-4 py-2 font-semibold">
              Retour live
            </Link>
          </div>
        </section>
      </main>
    );
  }

  const products = getStoreProductsLimited(store);
  const whatsappNumber = profile?.whatsappNumber || store.whatsappNumber;
  const displayName = profile?.storeName || store.displayName;
  const tagline = profile?.tagline || store.tagline;

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8">
      <section className="mx-auto max-w-6xl grid gap-6">
        <header className="rounded-2xl border border-slate-700 bg-slate-900/70 p-4 md:p-5 grid gap-3">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">{displayName}</h1>
            <p className="text-emerald-300 text-sm">Vendeur valide</p>
          </div>
          <p className="text-slate-300">{tagline}</p>
          <p className="text-xs text-slate-400">Catalogue limite a 6 articles pour l&apos;instant.</p>
          <div className="flex items-center gap-2">
            <Link href="/boutique" className="rounded-full bg-slate-700 px-4 py-2 text-sm font-semibold">
              Toutes les boutiques
            </Link>
            <Link href="/watch" className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold">
              Retour live
            </Link>
          </div>
        </header>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
          {products.map((product) => {
            const waUrl = buildWhatsAppUrl(whatsappNumber, product.name);

            return (
              <article key={product.id} className="rounded-2xl border border-slate-700 bg-slate-900/70 overflow-hidden grid">
                <img src={product.imageUrl} alt={product.name} className="h-52 w-full object-cover" />
                <div className="p-4 grid gap-3">
                  <h2 className="font-semibold leading-tight">{product.name}</h2>
                  <p className="text-sm text-slate-300">{product.description}</p>
                  <p className="text-lg font-extrabold text-orange-300">{formatXof(product.priceXof)} XOF</p>
                  <a
                    href={canOrderOnWhatsapp ? waUrl : "#"}
                    target={canOrderOnWhatsapp ? "_blank" : undefined}
                    rel={canOrderOnWhatsapp ? "noopener noreferrer" : undefined}
                    onClick={(event) => {
                      if (!canOrderOnWhatsapp) {
                        event.preventDefault();
                      }
                    }}
                    aria-disabled={!canOrderOnWhatsapp}
                    className={`inline-flex items-center justify-center rounded-xl px-4 py-2 font-semibold ${
                      canOrderOnWhatsapp ? "bg-emerald-600" : "bg-slate-700 text-slate-300 cursor-not-allowed"
                    }`}
                  >
                    Commander sur WhatsApp
                  </a>
                  {!canOrderOnWhatsapp ? (
                    <p className="text-xs text-amber-300">Commande WhatsApp reservee aux visiteurs certifies.</p>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
}
