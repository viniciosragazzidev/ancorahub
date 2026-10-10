import type { AchievementKey } from "@/features/engagement/journey-types";

import styles from "./journey.module.css";

/** Hue and glyph of each achievement medal (SVG, no emoji: same look on every phone). */
export const BADGE_STYLE: Record<AchievementKey, { hue: number; glyph: string }> = {
  lightning: { hue: 48, glyph: "M13 2 4 14h7l-1 8 9-12h-7z" },
  steady_duty: { hue: 212, glyph: "M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z" },
  first_sale: { hue: 150, glyph: "M12 3l2.6 5.6 6.1.6-4.6 4.1 1.3 6-5.4-3.1-5.4 3.1 1.3-6L3.3 9.2l6.1-.6z" },
  family_protected: { hue: 330, glyph: "M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" },
  business_cared: { hue: 268, glyph: "M4 20V8l8-4 8 4v12M9 20v-6h6v6M8 10h.01M12 10h.01M16 10h.01" },
  returns_on_time: { hue: 190, glyph: "M12 7v5l3 2M21 12a9 9 0 1 1-3-6.7M21 4v5h-5" },
  nobody_waiting: { hue: 28, glyph: "M5 12l4 4 10-10" },
  comeback: { hue: 0, glyph: "M12 3c2 3 5 4.5 5 9a5 5 0 0 1-10 0c0-2 1-3.5 2-4.5 0 2 1 3 2 3 0-3 1-5.5 1-7.5z" },
};

/**
 * One medal: a faceted disc with the badge glyph. Locked medals are drawn in
 * grey with a progress arc around them, so the broker sees how close it is.
 */
export function BadgeArt({ badge, earned, percentage = 0, size = 64 }: { badge: AchievementKey; earned: boolean; percentage?: number; size?: number }) {
  const { hue, glyph } = BADGE_STYLE[badge];
  const radius = 30;
  const length = 2 * Math.PI * radius;
  const id = `badge-${badge}-${earned ? "on" : "off"}`;
  return (
    <svg className={styles.badgeArt} data-earned={earned} viewBox="0 0 64 64" width={size} height={size} aria-hidden="true" style={{ "--badge-hue": hue } as React.CSSProperties}>
      <defs>
        <linearGradient id={`${id}-fill`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={earned ? `oklch(84% .13 ${hue})` : "oklch(93% 0 0)"} />
          <stop offset="1" stopColor={earned ? `oklch(62% .17 ${hue})` : "oklch(84% 0 0)"} />
        </linearGradient>
      </defs>
      {!earned ? (
        <>
          <circle cx="32" cy="32" r={radius} fill="none" stroke="oklch(92% 0 0)" strokeWidth="3" />
          <circle cx="32" cy="32" r={radius} fill="none" stroke={`oklch(66% .15 ${hue})`} strokeWidth="3" strokeLinecap="round" strokeDasharray={length} strokeDashoffset={length * (1 - Math.min(100, Math.max(0, percentage)) / 100)} transform="rotate(-90 32 32)" />
        </>
      ) : null}
      <path d="M32 8l19 11v22L32 56 13 41V19z" fill={`url(#${id}-fill)`} />
      <path d="M32 8l19 11v22L32 56 13 41V19z" fill="none" stroke={earned ? `oklch(98% .02 ${hue} / .7)` : "oklch(98% 0 0 / .8)"} strokeWidth="1.5" />
      <g transform="translate(20 20)">
        <path d={glyph} transform="scale(1)" fill="none" stroke={earned ? "white" : "oklch(70% 0 0)"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </svg>
  );
}
