import { cva, type VariantProps } from "class-variance-authority"

/*
 * Button skin = Lite/Arc button (docs/design-system/lite §10.1b, src/components/arc/button):
 * pill, 14/500, primary on the brand indigo (--primary, decided by the Vinicios for the normal mode), outlined secondary on --surface, ghost on secondary text,
 * danger outlined. Sizes follow Arc (sm 36, default 44, lg 50); names and props are unchanged.
 */
export const buttonVariants = cva(
  "ct-press group/button inline-flex shrink-0 items-center justify-center rounded-full border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-[background-color,border-color,color,box-shadow,opacity,scale] duration-[var(--duration-quick)] ease-[var(--ease-smooth-out)] outline-none select-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color-mix(in_oklab,var(--foreground)_72%,transparent)] disabled:pointer-events-none disabled:opacity-[.52] aria-invalid:border-destructive motion-reduce:transition-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 cursor-pointer",
  {
    variants: {
      variant: {
        default: "border-primary bg-primary text-primary-foreground hover:opacity-[.91] hover:shadow-[var(--shadow-card)] active:opacity-[.84]",
        primary: "border-primary bg-primary text-primary-foreground hover:opacity-[.91] hover:shadow-[var(--shadow-card)] active:opacity-[.84]",
        success:
          "border-success bg-success text-success-foreground hover:opacity-[.91] hover:shadow-[var(--shadow-card)] active:opacity-[.84]",
        outline:
          "border-border bg-card text-foreground hover:bg-muted hover:shadow-[var(--shadow-card)] active:bg-muted disabled:opacity-100 disabled:bg-muted disabled:text-muted-foreground",
        secondary:
          "border-border bg-card text-foreground hover:bg-muted hover:shadow-[var(--shadow-card)] active:bg-muted disabled:opacity-100 disabled:bg-muted disabled:text-muted-foreground",
        ghost:
          "text-[var(--text-secondary)] hover:bg-muted hover:text-foreground active:bg-muted aria-expanded:bg-muted aria-expanded:text-foreground disabled:opacity-100 disabled:text-muted-foreground",
        accent:
          "bg-[var(--accent-subtle,color-mix(in_oklab,var(--primary)_10%,transparent))] text-primary hover:bg-primary/12",
        destructive:
          "border-border bg-card text-destructive hover:border-destructive hover:bg-muted active:border-destructive active:bg-muted",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default:
          "h-11 gap-2 px-4 has-data-[icon=inline-end]:pr-3 has-data-[icon=inline-start]:pl-3",
        xs: "h-7 gap-1 px-2.5 text-xs has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2 [&_svg:not([class*='size-'])]:size-3.5",
        sm: "h-9 gap-1.5 px-3 has-data-[icon=inline-end]:pr-2.5 has-data-[icon=inline-start]:pl-2.5 [&_svg:not([class*='size-'])]:size-4",
        lg: "h-[50px] gap-2 px-5 has-data-[icon=inline-end]:pr-4 has-data-[icon=inline-start]:pl-4",
        icon: "size-10 rounded-full",
        "icon-xs":
          "size-7 rounded-full [&_svg:not([class*='size-'])]:size-3.5",
        "icon-sm": "size-9 rounded-full",
        "icon-lg": "size-11 rounded-full",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export type ButtonVariants = VariantProps<typeof buttonVariants>
