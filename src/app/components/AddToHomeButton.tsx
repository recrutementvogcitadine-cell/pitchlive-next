"use client";
import { useEffect, useState } from "react";

export default function AddToHomeButton() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const onClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      try { await deferredPrompt.userChoice; } catch (e) { /* ignore */ }
      setDeferredPrompt(null);
    } else {
      alert("Sur iOS : utilisez le bouton Partager → Ajouter à l'écran d'accueil");
    }
  };

  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
      <button onClick={onClick} style={{ padding: "8px 12px", borderRadius: 8, background: "#0b61ff", color: "#fff", border: "none" }}>
        Télécharger ici
      </button>
      <small style={{ color: "#666" }}>iOS: Partager → Ajouter à l'écran d'accueil</small>
    </div>
  );
}
