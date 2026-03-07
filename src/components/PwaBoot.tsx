"use client";

import { useEffect } from "react";

export default function PwaBoot() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    void navigator.serviceWorker.register("/push-sw.js").catch(() => {
      // Fail silently to avoid breaking first render.
    });
  }, []);

  return null;
}
