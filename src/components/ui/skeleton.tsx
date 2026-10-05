import * as React from "react"

import { cn } from "@/lib/utils"

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("ct-skeleton rounded-[var(--radius-card)] bg-muted", className)}
      {...props}
    />
  )
}

function SkeletonReveal({
  loading,
  fallback,
  children,
  className,
}: {
  loading: boolean
  fallback: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <div data-slot="skeleton-reveal" data-loading={loading} aria-busy={loading} className={cn("ct-skeleton-reveal", className)}>
      <div data-slot="skeleton-reveal-fallback" aria-hidden={!loading} inert={!loading}>
        {fallback}
      </div>
      <div data-slot="skeleton-reveal-content" aria-hidden={loading} inert={loading}>
        {children}
      </div>
    </div>
  )
}

export { Skeleton, SkeletonReveal }
