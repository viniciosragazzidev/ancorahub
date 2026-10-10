import { cva, type VariantProps } from "class-variance-authority";

/**
 * Legacy button roles, skinned as the Lite/Arc button (docs/design-system/lite
 * §10.1b): filled-dark = primary, outlined-action = secondary, ghost-nav = ghost,
 * outlined-nav = small secondary.
 */
export const dsButtonVariants = cva(
  "ct-press inline-flex shrink-0 items-center justify-center whitespace-nowrap text-sm font-medium outline-none transition-[background-color,border-color,color,box-shadow,transform] duration-[var(--duration-quick)] ease-[var(--ease-smooth-out)] select-none disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color-mix(in_oklab,var(--foreground)_72%,transparent)] [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      dsVariant: {
        /** Filled Dark CTA — primary action, once per surface */
        "filled-dark":
          "h-11 rounded-full border border-primary bg-primary px-ds-16 text-primary-foreground hover:opacity-[.91] hover:shadow-[var(--shadow-card)] active:opacity-[.84]",
        /** Outlined Action Button — secondary/utility action workhorse */
        "outlined-action":
          "h-11 rounded-full border border-border bg-card px-ds-16 text-foreground hover:bg-muted hover:shadow-[var(--shadow-card)]",
        /** Ghost Nav Button — top-level nav item, no border until hover */
        "ghost-nav":
          "h-9 rounded-full border border-transparent bg-transparent px-ds-16 text-[var(--text-secondary)] hover:bg-muted hover:text-foreground",
        /** Outlined Nav Button — secondary nav action (Log in) */
        "outlined-nav":
          "h-9 rounded-full border border-border bg-card px-ds-16 text-foreground hover:bg-muted",
      },
    },
  },
);

export type DsButtonVariants = VariantProps<typeof dsButtonVariants>;
