import * as React from "react"

import { cn } from "@/lib/utils"

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("ct-skeleton rounded-xl !bg-[color-mix(in_oklab,var(--border-strong)_38%,var(--card))] !animate-[ct-pulse_1.8s_var(--ease-in-out)_11_both] motion-reduce:animate-none after:content-none", className)}
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
