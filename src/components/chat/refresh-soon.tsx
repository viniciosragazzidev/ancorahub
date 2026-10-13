"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Reloads the screen's data a few times while an analysis runs in the background. */
export function RefreshSoon({ afterMs = 9_000, times = 3 }: { afterMs?: number; times?: number }) {
  const router = useRouter();
  useEffect(() => {
    let count = 0;
    const timer = window.setInterval(() => {
      count += 1;
      router.refresh();
      if (count >= times) window.clearInterval(timer);
    }, afterMs);
    return () => window.clearInterval(timer);
  }, [afterMs, router, times]);
  return null;
}
