import { cva, type VariantProps } from "class-variance-authority";

/**
 * Shared button primitive for the four button-shaped components in
 * docs/design-system.md (Filled Dark CTA, Outlined Action Button,
 * Ghost Nav Button, Outlined Nav Button). Each `dsVariant` locks the exact
 * colors/border/radius/padding from its spec — callers pick a role, not a
 * loose style.
 */
export const dsButtonVariants = cva(
  "inline-flex shrink-0 items-center justify-center whitespace-nowrap font-ds-inter text-ds-body font-medium outline-none transition-[background-color,border-color,color,box-shadow,transform] duration-150 ease-out select-none active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-ds-electric-blue/40 focus-visible:ring-offset-2 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      dsVariant: {
        /** Filled Dark CTA — primary action, once per surface */
        "filled-dark":
          "rounded-ds-buttons border border-transparent bg-ds-primary-action-fill px-ds-16 py-ds-12 text-ds-canvas-white shadow-ds-subtle hover:bg-ds-charcoal",
        /** Outlined Action Button — secondary/utility action workhorse */
        "outlined-action":
          "rounded-ds-buttons border border-ds-ash bg-ds-canvas-white px-ds-16 py-ds-12 text-ds-charcoal hover:bg-ds-paper-mist",
        /** Ghost Nav Button — top-level nav item, no border until hover */
        "ghost-nav":
          "rounded-ds-tags border border-transparent bg-transparent px-ds-16 py-ds-8 text-ds-charcoal hover:border-ds-ash hover:bg-ds-paper-mist",
        /** Outlined Nav Button — secondary nav action (Log in) */
        "outlined-nav":
          "rounded-ds-buttons border border-ds-ash bg-ds-canvas-white px-ds-16 py-ds-8 text-ds-charcoal hover:bg-ds-paper-mist",
      },
    },
  },
);

export type DsButtonVariants = VariantProps<typeof dsButtonVariants>;
