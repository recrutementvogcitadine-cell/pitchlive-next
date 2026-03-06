"use client";

import { useRef } from "react";

export function useDoubleTap(onDoubleTap: () => void, maxDelayMs = 250) {
  const lastTap = useRef<number>(0);

  return () => {
    const now = Date.now();
    if (now - lastTap.current < maxDelayMs) {
      onDoubleTap();
    }
    lastTap.current = now;
  };
}
