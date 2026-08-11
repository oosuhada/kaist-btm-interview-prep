"use client";

import { useEffect } from "react";

const TAP_GAP_MS = 560;
const TAP_TARGET = 6;
const RETURN_KEY = "kaist-btm-lingo-return";

export function SixTapPortal() {
  useEffect(() => {
    let taps = 0;
    let lastTap = 0;

    const handlePointerDown = (event: PointerEvent) => {
      if (event.pointerType === "mouse" && event.button !== 0) return;
      const target = event.target instanceof Element ? event.target : null;
      if (
        target?.closest(
          "button, a, input, textarea, select, [role='button'], [data-six-tap-ignore]"
        )
      ) {
        taps = 0;
        lastTap = 0;
        return;
      }

      const now = performance.now();
      taps = now - lastTap <= TAP_GAP_MS ? taps + 1 : 1;
      lastTap = now;
      if (taps < TAP_TARGET) return;

      taps = 0;
      lastTap = 0;
      const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      if (window.location.pathname === "/lingo") {
        const destination = window.sessionStorage.getItem(RETURN_KEY) || "/";
        window.location.assign(destination === "/lingo" ? "/" : destination);
        return;
      }
      window.sessionStorage.setItem(RETURN_KEY, current);
      window.location.assign("/lingo");
    };

    window.addEventListener("pointerdown", handlePointerDown, { capture: true });
    return () => window.removeEventListener("pointerdown", handlePointerDown, { capture: true });
  }, []);

  return null;
}
