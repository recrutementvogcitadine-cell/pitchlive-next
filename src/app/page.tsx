import { redirect } from "next/navigation";

export default function Page() {
  redirect("/watch");
}
import Link from "next/link";
import AddToHomeButton from "./components/AddToHomeButton";

export default function Home() {
  return (
    <main style={{ padding: 24, fontFamily: "system-ui, sans-serif" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1 style={{ fontSize: 28 }}>Pitch Live — Accueil</h1>
        <AddToHomeButton />
      </header>

      <p style={{ maxWidth: 720, marginTop: 12 }}>
        Bienvenue sur Pitch Live — plateforme de démonstration. Utilisez les liens ci‑dessous pour accéder
        aux démos et outils.
      </p>

      <ul style={{ marginTop: 16 }}>
        <li><Link href="/watch">Regarder une session</Link></li>
        <li><Link href="/agora-test">Démo Agora</Link></li>
      </ul>

      <section style={{ marginTop: 24 }}>
        <h2>À propos</h2>
        <p>Cette application combine vidéo temps réel et données temps réel.</p>
      </section>
    </main>
  );
}
