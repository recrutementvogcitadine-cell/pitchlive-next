import Link from "next/link";

export default function Page() {
  return (
    <main className="min-h-screen bg-[#04060d] text-white px-4 py-8 md:py-12">
      <section className="mx-auto w-full max-w-md md:max-w-lg grid gap-7 text-center">
        <div className="relative mx-auto h-[360px] w-[360px] max-w-full">
          <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_center,#153a7e_0%,#071126_46%,#03050a_75%)] shadow-[0_0_80px_rgba(9,132,227,.28)]" />
          <div className="absolute inset-[22px] rounded-full border border-amber-300/45 shadow-[inset_0_0_20px_rgba(255,255,255,.18)]" />
          <div className="absolute inset-[54px] rounded-full border border-slate-200/35" />
          <div className="absolute inset-[92px] rounded-full bg-[radial-gradient(circle_at_center,#1ed3d8_0%,#102f52_40%,#050915_75%)]" />
          <div className="absolute left-1/2 top-1/2 h-16 w-16 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle_at_center,#6a4bff_0%,#1dd4cf_65%,#0f2038_100%)] shadow-[0_0_26px_rgba(31,212,201,.55)]" />

          <div className="absolute left-6 top-14">
            <div className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-3 py-2 font-extrabold tracking-wide shadow-lg">
              <span className="inline-block h-3 w-3 rounded-full bg-white" />
              LIVE
            </div>
            <p className="mt-1 text-5xl font-black leading-none">PITCH</p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Link
            href="/visiteur/inscription"
            className="rounded-xl border border-slate-400/45 bg-gradient-to-b from-slate-600 to-slate-900 px-4 py-5 text-xl font-extrabold tracking-wide shadow-[0_10px_28px_rgba(0,0,0,.55)]"
          >
            VISITEURS =&gt; CLIQUEZ ICI
          </Link>
          <Link
            href="/vendeur/inscription"
            className="rounded-xl border border-blue-300/45 bg-gradient-to-b from-blue-600 to-blue-900 px-4 py-5 text-xl font-extrabold tracking-wide shadow-[0_10px_28px_rgba(0,0,0,.55)]"
          >
            VENDEUR =&gt; CLIQUEZ ICI
          </Link>
        </div>

        <p className="text-3xl leading-tight text-amber-50/95">PITCH LIVE Le meilleur endroit pour vos live vente, no limites !</p>
      </section>
    </main>
  );
}
