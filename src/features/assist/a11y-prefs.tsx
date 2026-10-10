"use client";

import { MotionConfig } from "motion/react";
import { useEffect, useState, type ReactNode } from "react";

/**
 * Accessibility preferences of the Lite (plan §5, E11), kept on this device:
 * bigger text, less motion and high contrast. Applied as attributes on <html>
 * (CSS in venancor-scope.css) and through MotionConfig for the animations.
 */
export type A11yPrefs = { textScale: 100 | 115 | 130; reduceMotion: boolean; highContrast: boolean };

export const A11Y_DEFAULTS: A11yPrefs = { textScale: 100, reduceMotion: false, highContrast: false };
const STORAGE_KEY = "ancora:a11y";
export const A11Y_EVENT = "ancora:a11y-change";

export function readA11yPrefs(): A11yPrefs {
  try {
    const raw = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "{}") as Partial<A11yPrefs>;
    return {
      textScale: raw.textScale === 115 || raw.textScale === 130 ? raw.textScale : 100,
      reduceMotion: raw.reduceMotion === true,
      highContrast: raw.highContrast === true,
    };
  } catch {
    return A11Y_DEFAULTS;
  }
}

export function applyA11yPrefs(prefs: A11yPrefs) {
  const root = document.documentElement;
  root.dataset.textScale = String(prefs.textScale);
  root.dataset.reduceMotion = prefs.reduceMotion ? "1" : "0";
  root.dataset.contrast = prefs.highContrast ? "high" : "normal";
}

export function saveA11yPrefs(prefs: A11yPrefs) {
  try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs)); } catch { /* private mode: still applies for this visit */ }
  applyA11yPrefs(prefs);
  window.dispatchEvent(new CustomEvent(A11Y_EVENT, { detail: prefs }));
}

/** True when the user asked the app for less motion (on top of the system setting). */
export function prefersLessMotion() {
  return typeof document !== "undefined" && document.documentElement.dataset.reduceMotion === "1";
}

/** Applies the saved preferences once and keeps MotionConfig in sync with "less motion". */
export function A11yPrefsProvider({ children }: { children: ReactNode }) {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    const prefs = readA11yPrefs();
    applyA11yPrefs(prefs);
    setReduce(prefs.reduceMotion);
    const onChange = (event: Event) => setReduce(Boolean((event as CustomEvent<A11yPrefs>).detail?.reduceMotion));
    window.addEventListener(A11Y_EVENT, onChange);
    return () => window.removeEventListener(A11Y_EVENT, onChange);
  }, []);
  return <MotionConfig reducedMotion={reduce ? "always" : "user"}>{children}</MotionConfig>;
}
