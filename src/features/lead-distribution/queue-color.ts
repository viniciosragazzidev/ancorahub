/**
 * Color system for tagging queues, used to tell leads apart in the leads
 * table, the kanban board and the lead drawer by which queue they belong to.
 *
 * Each queue stores a single hue (0–359° on the HSL wheel) instead of a name
 * from a fixed palette. That's the point: the design system only defines a
 * handful of accent tokens (blue, mint, green, orange, violet) — nowhere near
 * enough to give every queue in a tenant its own color without repeats. A
 * continuous hue has no such ceiling, and only ever shows up as a small 8px
 * dot next to the queue name (the same dot+caption pattern the design system
 * already uses for chart legends) — never as a colored surface — so it stays
 * within the "one chromatic accent per component" rule.
 *
 * "Manual" and "aleatório" both resolve to the same primitive: pick an
 * unused-enough hue. Manual = the user clicks one of the curated swatches
 * below. Random = the same distance-maximizing search, with the result drawn
 * from the least crowded region instead of the single best spot.
 */

export const QUEUE_HUE_MIN = 0;
export const QUEUE_HUE_MAX = 359;

/** Fixed saturation/lightness so any hue reads clearly in both themes. */
const DOT_SATURATION = 72;
const DOT_LIGHTNESS = 50;

/**
 * Curated swatches for the manual picker: 16 hues spread evenly around the
 * wheel. Not the exhaustive set of possible colors — just enough visibly
 * distinct choices for a one-click grid, same idea as Linear/Notion tag
 * colors. Automatic assignment isn't limited to these; it searches the full
 * 0–359° wheel.
 */
export const QUEUE_COLOR_SWATCHES: readonly number[] = [
  10, 32, 54, 76, 98, 120, 142, 164, 186, 208, 230, 252, 274, 296, 318, 340,
];

/** Shortest distance between two hues on the circular wheel (0–180). */
export function circularHueDistance(a: number, b: number): number {
  const diff = Math.abs(a - b) % 360;
  return diff > 180 ? 360 - diff : diff;
}

function normalizeHue(hue: number): number {
  const wrapped = Math.round(hue) % 360;
  return wrapped < 0 ? wrapped + 360 : wrapped;
}

/**
 * Picks a hue that stays as far as possible from every hue already in use —
 * the "never repeats" guarantee. With `jitter`, ties (or near-ties, within 6°
 * of the best distance) are broken randomly instead of deterministically, for
 * an "Aleatória" action that still avoids crowding existing colors.
 */
export function pickDistinctHue(usedHues: readonly (number | null | undefined)[], options?: { jitter?: boolean }): number {
  const used = Array.from(new Set(usedHues.filter((hue): hue is number => typeof hue === "number" && Number.isFinite(hue)).map(normalizeHue)));
  if (used.length === 0) {
    return options?.jitter ? Math.floor(Math.random() * 360) : QUEUE_COLOR_SWATCHES[0];
  }

  let bestDistance = -1;
  const candidates: number[] = [];
  for (let hue = 0; hue < 360; hue++) {
    const distance = Math.min(...used.map((usedHue) => circularHueDistance(hue, usedHue)));
    if (distance > bestDistance) {
      bestDistance = distance;
      candidates.length = 0;
      candidates.push(hue);
    } else if (distance === bestDistance) {
      candidates.push(hue);
    }
  }

  if (!options?.jitter) return candidates[Math.floor(candidates.length / 2)];

  // Near-ties (within 6° of the best spread) all count as "least crowded" —
  // pick randomly among them so repeated clicks give different results.
  const nearBest = candidates.length > 1
    ? candidates
    : (() => {
        const pool: number[] = [];
        for (let hue = 0; hue < 360; hue++) {
          const distance = Math.min(...used.map((usedHue) => circularHueDistance(hue, usedHue)));
          if (distance >= bestDistance - 6) pool.push(hue);
        }
        return pool;
      })();
  return nearBest[Math.floor(Math.random() * nearBest.length)];
}

/** Solid dot color for a queue's hue. Falls back to a neutral gray when unset. */
export function queueHueToDotColor(hue: number | null | undefined): string {
  if (typeof hue !== "number" || !Number.isFinite(hue)) return "hsl(0 0% 65%)";
  return `hsl(${normalizeHue(hue)} ${DOT_SATURATION}% ${DOT_LIGHTNESS}%)`;
}
