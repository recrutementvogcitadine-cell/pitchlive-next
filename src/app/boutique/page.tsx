import Link from "next/link";
import { getValidatedStores } from "@/lib/boutique-data";

export default function BoutiqueIndexPage() {
  const stores = getValidatedStores();

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8">
      <section className="mx-auto max-w-6xl grid gap-6">
        <header className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">Boutiques vendeurs valides</h1>
            <p className="text-slate-300 text-sm md:text-base">Chaque vendeur valide dispose de sa boutique et de son contact WhatsApp.</p>
          </div>
          <Link href="/watch" className="rounded-full bg-emerald-600 px-4 py-2 font-semibold">
            Retour au live
          </Link>
        </header>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
          {stores.map((seller) => (
            <article key={seller.id} className="rounded-2xl border border-slate-700 bg-slate-900/70 p-4 grid gap-3">
              <div className="flex items-center gap-3">
                <img src={seller.avatarUrl} alt={seller.displayName} className="h-12 w-12 rounded-full object-cover" />
                <div>
                  <h2 className="font-semibold leading-tight">{seller.displayName}</h2>
                  <p className="text-xs text-emerald-300">Vendeur valide</p>
                </div>
              </div>
              <p className="text-sm text-slate-300">{seller.tagline}</p>
              <Link
                href={`/boutique/${encodeURIComponent(seller.id)}`}
                className="inline-flex w-fit rounded-full bg-orange-500 px-4 py-2 text-sm font-semibold"
              >
                Ouvrir la boutique
              </Link>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
