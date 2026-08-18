"use client";

import { useEffect, useRef } from "react";

/**
 * PerformanceMonitor — reports Web Vitals and route timing to the server.
 *
 * Captures:
 * - TTFB (Time to First Byte)
 * - LCP (Largest Contentful Paint)
 * - INP (Interaction to Next Paint)
 * - CLS (Cumulative Layout Shift)
 * - Route load duration
 *
 * Data is sent via beacon API (non-blocking) to avoid impacting performance.
 * No PII is sent — only route name and metric values.
 */
export function PerformanceMonitor() {
  const routeStartRef = useRef<number>(performance.now());

  useEffect(() => {
    const routeStart = routeStartRef.current;
    const pathname = window.location.pathname;

    // Report route load duration after page is fully loaded
    const reportRouteLoad = () => {
      const routeLoadDuration = Math.round(performance.now() - routeStart);
      reportMetric({
        route: normalizeRoute(pathname),
        metric: "route_load",
        value: routeLoadDuration,
      });
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
        reportMetric({
          route: normalizeRoute(pathname),
          metric: "ttfb",
          value: Math.round(nav.responseStart),
        });
      }
    }

    // ── LCP ───────────────────────────────────────────────────────────
    let lcpObserver: PerformanceObserver | undefined;
    try {
      lcpObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const last = entries[entries.length - 1];
        if (last) {
          reportMetric({
            route: normalizeRoute(pathname),
            metric: "lcp",
            value: Math.round(last.startTime),
          });
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
        reportMetric({
          route: normalizeRoute(pathname),
          metric: "cls",
          value: Math.round(clsValue * 1000) / 1000,
        });
      }
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
        reportMetric({
          route: normalizeRoute(pathname),
          metric: "inp",
          value: Math.round(maxInp),
        });
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
  metric: string;
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
