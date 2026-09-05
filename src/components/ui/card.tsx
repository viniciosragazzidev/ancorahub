import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const cardVariants = cva(
  "group/card flex min-w-0 flex-col text-card-foreground",
  {
    variants: {
      variant: {
        default: "gap-[var(--size-spacing-04)] rounded-[var(--radius-card)] border border-border bg-card p-[var(--size-spacing-05)] shadow-none",
        subtle: "gap-[var(--size-spacing-04)] rounded-[var(--radius-card)] border border-border bg-[var(--surface-secondary)] p-[var(--size-spacing-05)] shadow-none",
        overview: "gap-0 overflow-hidden rounded-[var(--radius-card)] border border-border bg-card p-0 shadow-none",
        compact: "gap-[var(--size-spacing-03)] rounded-[var(--radius-card)] border border-border bg-card p-[var(--size-spacing-04)] shadow-none",
        kanban: "gap-0 overflow-hidden rounded-[var(--radius-card)] border border-border bg-card p-0 shadow-none",
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
        size === "sm" && variant === "default" && "gap-[var(--size-spacing-03)] p-[var(--size-spacing-04)]",
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
        "font-sans text-base font-semibold tracking-tight text-foreground",
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
      className={cn("flex items-center rounded-b-[var(--radius-card)] px-[var(--size-spacing-05)] pb-[var(--size-spacing-05)]", className)}
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
