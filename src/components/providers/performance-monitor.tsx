"use client";

import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";

/**
 * PerformanceMonitor — reports Web Vitals and route timing to the server.
 *
 * Captures:
 * - TTFB (Time to First Byte)
 * - LCP (Largest Contentful Paint)
 * - INP (Interaction to Next Paint)
 * - CLS (Cumulative Layout Shift)
 * - Route load duration
 * - Client navigation completion after an internal link click
 *
 * Data is sent via beacon API (non-blocking) to avoid impacting performance.
 * No PII is sent — only route name and metric values.
 */
export function PerformanceMonitor() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const routeStartRef = useRef<number>(performance.now());
  const reportedRef = useRef(new Set<string>());
  const pendingNavigationRef = useRef<{ target: string; startedAt: number } | null>(null);

  useEffect(() => {
    const captureNavigation = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = (event.target as Element | null)?.closest("a[href]") as HTMLAnchorElement | null;
      if (!anchor || anchor.target || anchor.hasAttribute("download")) return;

      const target = new URL(anchor.href, window.location.href);
      if (target.origin !== window.location.origin) return;

      const current = `${window.location.pathname}${window.location.search}`;
      const destination = `${target.pathname}${target.search}`;
      if (destination === current) return;

      pendingNavigationRef.current = {
        target: normalizeRoute(target.pathname),
        startedAt: performance.now(),
      };
    };

    window.addEventListener("click", captureNavigation, true);
    return () => window.removeEventListener("click", captureNavigation, true);
  }, []);

  useEffect(() => {
    const pending = pendingNavigationRef.current;
    const route = normalizeRoute(pathname);
    if (!pending || pending.target !== route) return;

    pendingNavigationRef.current = null;
    reportMetric({
      route,
      metric: "route_navigation",
      value: Math.round(performance.now() - pending.startedAt),
    });
  }, [pathname, searchParams]);

  useEffect(() => {
    const routeStart = routeStartRef.current;
    const pathname = window.location.pathname;
    const route = normalizeRoute(pathname);
    const reportOnce = (metric: MetricPayload["metric"], value: number) => {
      const key = `${route}:${metric}`;
      if (reportedRef.current.has(key)) return;
      reportedRef.current.add(key);
      reportMetric({ route, metric, value });
    };

    // Report route load duration after page is fully loaded
    const reportRouteLoad = () => {
      const routeLoadDuration = Math.round(performance.now() - routeStart);
      reportOnce("route_load", routeLoadDuration);
    };

    // Report when page is fully loaded
    if (document.readyState === "complete") {
      reportRouteLoad();
    } else {
      window.addEventListener("load", reportRouteLoad, { once: true });
    }

    // ── TTFB ──────────────────────────────────────────────────────────
    const navigationEntries = performance.getEntriesByType("navigation");
    if (navigationEntries.length > 0) {
      const nav = navigationEntries[0] as PerformanceNavigationTiming;
      if (nav.responseStart > 0) {
        reportOnce("ttfb", Math.round(nav.responseStart));
      }
    }

    // ── LCP ───────────────────────────────────────────────────────────
    let lcpObserver: PerformanceObserver | undefined;
    let lcpValue = 0;
    try {
      lcpObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const last = entries[entries.length - 1];
        if (last) {
          lcpValue = Math.round(last.startTime);
        }
      });
      lcpObserver.observe({ type: "largest-contentful-paint", buffered: true });
    } catch {
      // LCP not supported
    }

    // ── CLS ───────────────────────────────────────────────────────────
    let clsObserver: PerformanceObserver | undefined;
    let clsValue = 0;
    try {
      clsObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const layoutEntry = entry as PerformanceEntry & { hadRecentInput?: boolean; value?: number };
          if (!layoutEntry.hadRecentInput && layoutEntry.value) {
            clsValue += layoutEntry.value;
          }
        }
      });
      clsObserver.observe({ type: "layout-shift", buffered: true });
    } catch {
      // CLS not supported
    }

    // Report CLS on page hide (final value)
    const handlePageHide = () => {
      if (clsValue > 0) {
        reportOnce("cls", Math.round(clsValue * 1000) / 1000);
      }
      if (lcpValue > 0) reportOnce("lcp", lcpValue);
    };
    window.addEventListener("pagehide", handlePageHide);

    // ── INP ───────────────────────────────────────────────────────────
    let inpObserver: PerformanceObserver | undefined;
    let maxInp = 0;
    try {
      inpObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const eventEntry = entry as PerformanceEntry & { processingEnd?: number; processingStart?: number };
          if (eventEntry.processingEnd && eventEntry.processingStart) {
            const duration = eventEntry.processingEnd - eventEntry.processingStart;
            if (duration > maxInp) {
              maxInp = duration;
            }
          }
        }
      });
      inpObserver.observe({ type: "event", buffered: true });
    } catch {
      // INP not supported
    }

    // Report INP on page hide
    const handlePageHideInp = () => {
      if (maxInp > 0) {
        reportOnce("inp", Math.round(maxInp));
      }
    };
    window.addEventListener("pagehide", handlePageHideInp);

    // ── Cleanup ───────────────────────────────────────────────────────
    return () => {
      window.removeEventListener("load", reportRouteLoad);
      window.removeEventListener("pagehide", handlePageHide);
      window.removeEventListener("pagehide", handlePageHideInp);
      lcpObserver?.disconnect();
      clsObserver?.disconnect();
      inpObserver?.disconnect();
    };
  }, []);

  return null; // No UI — purely observational
}

// ─── Helpers ──────────────────────────────────────────────────────────

type MetricPayload = {
  route: string;
  metric: "ttfb" | "lcp" | "inp" | "cls" | "route_load" | "route_navigation";
  value: number;
};

function normalizeRoute(pathname: string): string {
  // Replace UUIDs and numeric IDs with [id]
  return pathname
    .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, "/[id]")
    .replace(/\/\d+/g, "/[id]");
}

function reportMetric(payload: MetricPayload): void {
  try {
    // Use sendBeacon for non-blocking reporting — doesn't impact page performance
    const url = "/api/internal/performance";
    const data = JSON.stringify(payload);

    if (navigator.sendBeacon) {
      navigator.sendBeacon(url, new Blob([data], { type: "application/json" }));
    } else {
      // Fallback: fetch with keepalive
      fetch(url, {
        method: "POST",
        body: data,
        headers: { "Content-Type": "application/json" },
        keepalive: true,
      }).catch(() => {
        // Silently ignore — performance reporting should never break the app
      });
    }
  } catch {
    // Silently ignore
  }
}
