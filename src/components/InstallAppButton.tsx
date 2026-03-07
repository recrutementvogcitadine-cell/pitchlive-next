"use client";

import { useEffect, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

function isiOS() {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

export default function InstallAppButton() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const handler = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const onInstall = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      try {
        await deferredPrompt.userChoice;
      } catch {
        // Ignore user-dismissed flow.
      }
      setDeferredPrompt(null);
      return;
    }

    if (isiOS()) {
      window.alert("Sur iPhone: bouton Partager -> Ajouter a l'ecran d'accueil.");
    }
  };

  if (!deferredPrompt && !isiOS()) {
    return null;
  }

  return (
    <button
      type="button"
      onClick={() => void onInstall()}
      className="fixed right-4 top-4 z-50 rounded-full border border-slate-500 bg-slate-900/95 px-4 py-2 text-xs font-semibold text-slate-100 shadow-lg"
    >
      Installer l'app
    </button>
  );
}
