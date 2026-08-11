import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const cardVariants = cva(
  "group/card flex min-w-0 flex-col text-card-foreground [&_[data-slot=scroll-area-scrollbar]]:hidden",
  {
    variants: {
      variant: {
        default: "gap-4 rounded-xl border border-border/75 bg-card p-5 shadow-[var(--shadow-card)] transition-[border-color,box-shadow,background-color] duration-[var(--duration-fast)] ease-[var(--ease-smooth-out)] hover:border-border-strong hover:bg-card motion-reduce:transition-none",
        subtle: "gap-4 rounded-xl border border-border/65 bg-card/85 p-5",
        overview: "gap-0 overflow-hidden rounded-xl border border-border/80 bg-card p-0",
        compact: "gap-3 rounded-xl border border-border/70 bg-card p-4 shadow-[var(--shadow-card)] transition-[border-color,box-shadow,background-color] duration-[var(--duration-fast)] ease-[var(--ease-smooth-out)] hover:border-border-strong hover:bg-muted/20 motion-reduce:transition-none",
        kanban: "gap-0 overflow-hidden rounded-xl border border-border/70 bg-card p-0 shadow-[var(--shadow-card)] transition-[border-color,box-shadow,background-color] duration-[var(--duration-fast)] ease-[var(--ease-smooth-out)] hover:border-border-strong hover:bg-muted/20 motion-reduce:transition-none",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
)

function Card({
  className,
  variant = "default",
  size = "default",
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof cardVariants> & { size?: "default" | "sm" }) {
  return (
    <div
      data-slot="card"
      data-variant={variant}
      data-size={size}
      className={cn(
        cardVariants({ variant }),
        size === "sm" && variant === "default" && "gap-3 rounded-lg p-4",
        className
      )}
      {...props}
    />
  )
}

function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-header"
      className={cn(
        "group/card-header grid auto-rows-min items-start gap-1.5 p-0 pb-1 has-data-[slot=card-action]:grid-cols-[1fr_auto] has-data-[slot=card-description]:grid-rows-[auto_auto]",
        className
      )}
      {...props}
    />
  )
}

function CardTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-title"
      className={cn(
        "font-sans text-[15px] font-semibold tracking-[-0.015em] text-foreground",
        className
      )}
      {...props}
    />
  )
}

function CardDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-description"
      className={cn("font-sans text-xs text-muted-foreground", className)}
      {...props}
    />
  )
}

function CardAction({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-action"
      className={cn(
        "col-start-2 row-span-2 row-start-1 self-start justify-self-end",
        className
      )}
      {...props}
    />
  )
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-content"
      className={cn("p-0", className)}
      {...props}
    />
  )
}

function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-footer"
      className={cn("flex items-center rounded-b-lg px-5 pb-5", className)}
      {...props}
    />
  )
}

export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardAction,
  CardDescription,
  CardContent,
  cardVariants,
}
