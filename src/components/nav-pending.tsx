"use client";

import { useLinkStatus } from "next/link";

import { cn } from "@/lib/utils";

/**
 * Shows inside a menu <Link> that the tap was taken while the next page loads (Fase 1 de
 * performance, 24/10): with no sign, people clicked the Plantão again and again. Same size in
 * both states (only the opacity changes, so nothing moves), and it only appears after 120 ms,
 * so an instant navigation shows nothing.
 */
export function NavPending({ className }: { className?: string }) {
  const { pending } = useLinkStatus();
  return (
    <span
      aria-hidden="true"
      data-pending={pending ? "true" : undefined}
      className={cn(
        "pointer-events-none absolute inset-0 rounded-full bg-current opacity-0 transition-opacity duration-150 data-[pending=true]:animate-pulse data-[pending=true]:opacity-[0.08] data-[pending=true]:delay-[120ms] motion-reduce:animate-none",
        className,
      )}
    />
  );
}
