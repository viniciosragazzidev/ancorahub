"use client"

import { useRender } from "@base-ui/react/use-render"
import { mergeProps } from "@base-ui/react/merge-props"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "group/badge inline-flex h-5.5 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-full border border-transparent px-2.5 py-0.5 font-mono text-[11px] font-medium whitespace-nowrap transition-[background-color,border-color,color,box-shadow,opacity] duration-[var(--duration-quick)] ease-[var(--ease-smooth-out)] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 motion-reduce:transition-none [&>svg]:pointer-events-none [&>svg]:size-3!",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground [a]:hover:bg-primary/80",
        secondary:
          "bg-muted/80 text-foreground/80 border border-border/50 [a]:hover:bg-muted",
        success:
          "border-emerald-200/60 bg-emerald-50 text-emerald-700 dark:border-emerald-800/40 dark:bg-emerald-950/40 dark:text-emerald-400 [a]:hover:bg-emerald-100",
        warning:
          "border-amber-200/60 bg-amber-50 text-amber-700 dark:border-amber-800/40 dark:bg-amber-950/40 dark:text-amber-400 [a]:hover:bg-amber-100",
        destructive:
          "border-rose-200/60 bg-rose-50 text-rose-700 dark:border-rose-800/40 dark:bg-rose-950/40 dark:text-rose-400 [a]:hover:bg-rose-100",
        info:
          "border-sky-200/60 bg-sky-50 text-sky-700 dark:border-sky-800/40 dark:bg-sky-950/40 dark:text-sky-400 [a]:hover:bg-sky-100",
        indigo:
          "border-indigo-200/60 bg-indigo-50 text-indigo-700 dark:border-indigo-800/40 dark:bg-indigo-950/40 dark:text-indigo-400",
        purple:
          "border-purple-200/60 bg-purple-50 text-purple-700 dark:border-purple-800/40 dark:bg-purple-950/40 dark:text-purple-400",
        pink:
          "border-pink-200/60 bg-pink-50 text-pink-700 dark:border-pink-800/40 dark:bg-pink-950/40 dark:text-pink-400",
        cyan:
          "border-cyan-200/60 bg-cyan-50 text-cyan-700 dark:border-cyan-800/40 dark:bg-cyan-950/40 dark:text-cyan-400",
        orange:
          "border-orange-200/60 bg-orange-50 text-orange-700 dark:border-orange-800/40 dark:bg-orange-950/40 dark:text-orange-400",
        outline:
          "border-border/80 text-muted-foreground bg-card [a]:hover:bg-muted [a]:hover:text-foreground",
        ghost:
          "hover:bg-muted hover:text-muted-foreground dark:hover:bg-muted/50",
        link: "text-primary underline-offset-4 hover:underline",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant = "default",
  render,
  ...props
}: useRender.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return useRender({
    defaultTagName: "span",
    props: mergeProps<"span">(
      {
        className: cn(badgeVariants({ variant }), className),
      },
      props
    ),
    render,
    state: {
      slot: "badge",
      variant,
    },
  })
}

export { Badge, badgeVariants }
