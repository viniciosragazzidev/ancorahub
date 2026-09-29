import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

const WEIGHTS = ["regular", "medium", "semibold", "bold"] as const;
const withWeights = (names: readonly string[]) => names.flatMap((name) => WEIGHTS.map((weight) => `${name}-${weight}`));

/**
 * Custom font-size utilities from the theme. Without registering them,
 * tailwind-merge reads `text-ds-caption` as a *color* and drops it whenever a
 * color like `text-ds-amber-ink` follows — badges and labels then inherited
 * the body size (14.4px instead of 11px).
 */
const CUSTOM_FONT_SIZES = [
  "ds-caption", "ds-body", "ds-body-lg", "ds-body-xl", "ds-subheading",
  "ds-heading-sm", "ds-heading", "ds-heading-lg", "ds-display",
  ...withWeights([
    "caption-1", "caption-2", "body", "body-2", "headline", "title-1", "title-2", "title-3",
    "large-title", "display-1", "display-2", "display-3", "display-4",
  ]),
];

const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [{ text: CUSTOM_FONT_SIZES }],
    },
  },
});

/** Combina classes condicionais e resolve conflitos do Tailwind. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
