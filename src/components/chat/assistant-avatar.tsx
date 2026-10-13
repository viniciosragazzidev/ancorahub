"use client";

import { useId } from "react";
import { motion, useReducedMotion } from "motion/react";

import type { MascotShape } from "./types";

const SHAPES: Record<Exclude<MascotShape, "logo">, string> = {
  // 64x64 viewBox; every body leaves room under it for the soft shadow.
  mochi: "M8 40c0-15 10.7-26 24-26s24 11 24 26c0 6-4 9-10 9H18c-6 0-10-3-10-9Z",
  onigiri: "M28.6 13.8c1.6-2.6 5.2-2.6 6.8 0l17.4 28.9c1.6 2.7-.3 6.3-3.4 6.3H14.6c-3.1 0-5-3.6-3.4-6.3l17.4-28.9Z",
  cubo: "M14 16h36a6 6 0 0 1 6 6v20a6 6 0 0 1-6 6H14a6 6 0 0 1-6-6V22a6 6 0 0 1 6-6Z",
  favo: "M27 12.8a10 10 0 0 1 10 0l11.6 6.7a10 10 0 0 1 5 8.7v9.4a10 10 0 0 1-5 8.7L37 53a10 10 0 0 1-10 0l-11.6-6.7a10 10 0 0 1-5-8.7v-9.4a10 10 0 0 1 5-8.7L27 12.8Z",
  nuvem: "M18 46a10 10 0 0 1-2.6-19.7A14 14 0 0 1 42 22a11 11 0 0 1 6 20.9V46H18Z",
  salte: "M20 18h30c3.3 0 5.4 3.6 3.8 6.4L46 40c-1 1.9-3 3-5.2 3H12c-3.3 0-5.4-3.6-3.8-6.4L16 22a4.6 4.6 0 0 1 4-4Z",
  // Jack, the little pirate: a round body under the tricorn hat (hat and eye patch drawn on top).
  jack: "M9 41c0-13.5 10.3-23 23-23s23 9.5 23 23c0 5.4-3.8 8-9.4 8H18.4C12.8 49 9 46.4 9 41Z",
};

/** Jack's tricorn hat with a gold band and a tiny skull, and the eye patch with its strap. */
function PirateGear() {
  const ink = "oklch(26% 0.03 260)";
  return (
    <>
      <path d="M9.5 24.5C13 13.5 22 8.5 32 8.5s19 5 22.5 16c-6.4-3.4-14.2-5-22.5-5s-16.1 1.6-22.5 5Z" fill={ink} />
      <path d="M12.5 22.6c5.6-2.6 12.2-3.8 19.5-3.8s13.9 1.2 19.5 3.8" fill="none" stroke="oklch(80% 0.14 85)" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="32" cy="13.6" r="2.3" fill="white" />
      <path d="M28.6 17.4 35.4 15.2M28.6 15.2l6.8 2.2" stroke="white" strokeWidth="1" strokeLinecap="round" />
      <path d="M13.5 30.5 23 34M31 33.4 50.5 26.5" stroke={ink} strokeWidth="1.5" strokeLinecap="round" />
      <ellipse cx="26.5" cy="36" rx="4.6" ry="4.1" fill={ink} />
    </>
  );
}

/**
 * The assistant's mascot: a soft glossy body in the assistant's color with two
 * eyes. "working" breathes, "waiting" shows the blue dot. The logo variant is
 * the verified company mark.
 */
export function AssistantAvatar({
  shape,
  hue,
  size = 44,
  state = "idle",
  initials,
  temperature,
  label,
}: {
  shape: MascotShape;
  hue: number | null;
  size?: number;
  state?: "idle" | "working" | "waiting";
  /** Lead conversations show initials instead of a mascot. */
  initials?: string;
  temperature?: "hot" | "warm" | "cold" | null;
  label?: string;
}) {
  const id = useId().replace(/:/g, "");
  const reduce = useReducedMotion();
  const h = hue ?? 220;

  if (initials) {
    const ring = temperature === "hot" ? "oklch(64% 0.2 30)" : temperature === "warm" ? "oklch(75% 0.16 75)" : temperature === "cold" ? "oklch(68% 0.12 235)" : "transparent";
    return (
      <span
        role={label ? "img" : undefined}
        aria-label={label}
        aria-hidden={label ? undefined : true}
        style={{
          width: size, height: size, borderRadius: 999, display: "grid", placeItems: "center", flex: "none",
          background: "var(--surface-muted)", color: "var(--text-secondary)", fontSize: size * 0.34, fontWeight: 500,
          boxShadow: `0 0 0 2px var(--surface), 0 0 0 ${temperature ? 3.5 : 0}px ${ring}`,
        }}
      >
        {initials}
      </span>
    );
  }

  if (shape === "logo") {
    return (
      <span
        role={label ? "img" : undefined}
        aria-label={label}
        aria-hidden={label ? undefined : true}
        style={{ width: size, height: size, borderRadius: 999, display: "grid", placeItems: "center", flex: "none", background: "linear-gradient(160deg, oklch(70% 0.17 250), oklch(55% 0.21 258))", color: "white" }}
      >
        <svg viewBox="0 0 24 24" width={size * 0.5} height={size * 0.5} aria-hidden="true">
          <path fill="currentColor" d="M12 2a2.5 2.5 0 0 1 1 4.8V9h3a1 1 0 1 1 0 2h-3v8.9a7 7 0 0 0 5.7-5.4l-1.4.4a1 1 0 0 1-.6-1.9l3.4-1a1 1 0 0 1 1.3 1A9 9 0 0 1 3 13a1 1 0 0 1 1.3-1l3.4 1a1 1 0 1 1-.6 1.9l-1.4-.4A7 7 0 0 0 11 19.9V11H8a1 1 0 1 1 0-2h3V6.8A2.5 2.5 0 0 1 12 2Z" />
        </svg>
      </span>
    );
  }

  const body = SHAPES[shape];
  const top = `oklch(86% 0.1 ${h})`;
  const base = `oklch(66% 0.17 ${h})`;
  const deep = `oklch(54% 0.18 ${h})`;
  return (
    <span style={{ position: "relative", width: size, height: size, display: "inline-grid", flex: "none" }} role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      <motion.svg
        viewBox="0 0 64 64"
        width={size}
        height={size}
        animate={state === "working" && !reduce ? { scale: [1, 1.05, 1], y: [0, -1.5, 0] } : { scale: 1, y: 0 }}
        transition={state === "working" && !reduce ? { duration: 1.6, repeat: Infinity, ease: "easeInOut" } : { duration: 0.2 }}
        style={{ overflow: "visible" }}
      >
        <defs>
          <linearGradient id={`b${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={top} />
            <stop offset="0.55" stopColor={base} />
            <stop offset="1" stopColor={deep} />
          </linearGradient>
          <radialGradient id={`g${id}`} cx="0.35" cy="0.25" r="0.5">
            <stop offset="0" stopColor="white" stopOpacity="0.75" />
            <stop offset="1" stopColor="white" stopOpacity="0" />
          </radialGradient>
        </defs>
        <ellipse cx="32" cy="55" rx="17" ry="3" fill={`oklch(40% 0.08 ${h} / 0.18)`} />
        <path d={body} fill={`url(#b${id})`} />
        <path d={body} fill={`url(#g${id})`} />
        <motion.g
          animate={!reduce ? { scaleY: [1, 1, 0.15, 1, 1] } : undefined}
          transition={!reduce ? { duration: 4.2, repeat: Infinity, times: [0, 0.9, 0.93, 0.96, 1] } : undefined}
          style={{ transformOrigin: "32px 36px" }}
        >
          <ellipse cx="26.5" cy="36" rx="2.4" ry="3.4" fill={`oklch(28% 0.06 ${h})`} />
          <ellipse cx="37.5" cy="36" rx="2.4" ry="3.4" fill={`oklch(28% 0.06 ${h})`} />
        </motion.g>
        {shape === "jack" ? <PirateGear /> : null}
      </motion.svg>
      {state === "waiting" ? (
        <span aria-hidden="true" style={{ position: "absolute", right: 0, top: 0, width: Math.max(8, size * 0.2), height: Math.max(8, size * 0.2), borderRadius: 999, background: "oklch(62% 0.2 255)", boxShadow: "0 0 0 2px var(--surface)" }} />
      ) : null}
    </span>
  );
}
