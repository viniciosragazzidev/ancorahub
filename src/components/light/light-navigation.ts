"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

/**
 * The app's own history since the page was loaded (path + query), kept in step
 * with the browser: a push adds, a back removes, a replace swaps the top.
 * document.referrer only describes the first load, so "where does back go?"
 * is answered here instead.
 */
let entries: string[] = [];
let pending: NavigationKind | null = null;

export type NavigationKind = "push" | "pop" | "replace";

/** Pure step of the app history (exported for tests). */
export function nextEntries(current: readonly string[], kind: NavigationKind, href: string): string[] {
  if (!current.length) return [href];
  if (kind === "pop") return current.length > 1 ? current.slice(0, -1) : [href];
  if (kind === "replace") return [...current.slice(0, -1), href];
  return [...current, href];
}

/** Where back goes: history when the previous screen is in the app (and is the parent, when required). */
export function backDecision(current: readonly string[], parentHref: string, alwaysParent: boolean): "history" | "parent" {
  const previous = current.length > 1 ? current[current.length - 2] : null;
  if (previous === null) return "parent";
  if (!alwaysParent) return "history";
  const parent = parentHref.split("#")[0];
  return previous === parent || previous.split("?")[0] === parent ? "history" : "parent";
}

export function canGoBackInApp() {
  return entries.length > 1;
}

type BackRouter = { back: () => void; replace: (href: string) => void };

/**
 * Back that never loops: history back when possible; otherwise the parent
 * REPLACES the current screen, so a later back does not return to it.
 */
export function goBackInApp(router: BackRouter, parentHref: string, alwaysParent = false) {
  if (backDecision(entries, parentHref, alwaysParent) === "history") {
    pending = "pop";
    router.back();
    return;
  }
  pending = "replace";
  router.replace(parentHref);
}

/** Tests only. */
export function resetLightNavigationForTests(initial: string[] = []) {
  entries = [...initial];
  pending = null;
}

/** Mount once in the Light chrome. */
export function useLightNavigationTracker() {
  const pathname = usePathname();
  const previous = useRef<string | null>(null);

  useEffect(() => {
    const href = `${window.location.pathname}${window.location.search}`;
    if (previous.current === null) {
      previous.current = pathname;
      if (!entries.length) entries = [href];
      return;
    }
    if (previous.current === pathname) return;
    previous.current = pathname;
    entries = nextEntries(entries, pending ?? "push", href);
    pending = null;
  }, [pathname]);

  useEffect(() => {
    // Browser or gesture back (not our button): the next change is a pop.
    const onPopState = () => {
      if (!pending) pending = "pop";
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);
}
