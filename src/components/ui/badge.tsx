"use client"

import { useRender } from "@base-ui/react/use-render"
import { mergeProps } from "@base-ui/react/merge-props"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "group/badge inline-flex h-5.5 w-fit shrink-0 items-center justify-center gap-1 rounded-md border border-transparent px-2 py-0.5 text-[11px] font-medium whitespace-nowrap transition-[background-color,border-color,color,box-shadow,opacity] duration-150 ease-out focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/30 has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 motion-reduce:transition-none [&>svg]:pointer-events-none [&>svg]:size-3!",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground [a]:hover:bg-primary/80",
        secondary:
          "bg-muted/70 text-foreground/80 border border-border/70 [a]:hover:bg-muted",
        success:
          "border-emerald-500/25 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 dark:border-emerald-500/30 dark:bg-emerald-500/15 [a]:hover:bg-emerald-500/20",
        warning:
          "border-amber-500/25 bg-amber-500/10 text-amber-800 dark:text-amber-300 dark:border-amber-500/30 dark:bg-amber-500/15 [a]:hover:bg-amber-500/20",
        destructive:
          "border-rose-500/25 bg-rose-500/10 text-rose-800 dark:text-rose-300 dark:border-rose-500/30 dark:bg-rose-500/15 [a]:hover:bg-rose-500/20",
        info:
          "border-sky-500/25 bg-sky-500/10 text-sky-800 dark:text-sky-300 dark:border-sky-500/30 dark:bg-sky-500/15 [a]:hover:bg-sky-500/20",
        indigo:
          "border-indigo-500/25 bg-indigo-500/10 text-indigo-800 dark:text-indigo-300 dark:border-indigo-500/30 dark:bg-indigo-500/15",
        purple:
          "border-purple-500/25 bg-purple-500/10 text-purple-800 dark:text-purple-300 dark:border-purple-500/30 dark:bg-purple-500/15",
        pink:
          "border-pink-500/25 bg-pink-500/10 text-pink-800 dark:text-pink-300 dark:border-pink-500/30 dark:bg-pink-500/15",
        cyan:
          "border-cyan-500/25 bg-cyan-500/10 text-cyan-800 dark:text-cyan-300 dark:border-cyan-500/30 dark:bg-cyan-500/15",
        orange:
          "border-orange-500/25 bg-orange-500/10 text-orange-800 dark:text-orange-300 dark:border-orange-500/30 dark:bg-orange-500/15",
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
