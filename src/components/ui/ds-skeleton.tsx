import * as React from "react";
import { cn } from "@/utils/core/cn";

/**
 * Skeleton — the loading state of every DS list, tile and header. A soft
 * highlight sweeps over Paper Mist (static under reduced motion). Shapes
 * should mirror the real content so nothing jumps when data arrives.
 */
export function DsSkeleton({ className, ...props }: React.ComponentPropsWithoutRef<"div">) {
  return <div aria-hidden="true" data-slot="ds-skeleton" className={cn("ds-skeleton rounded-ds-inputs", className)} {...props} />;
}

/** Loading placeholder that matches a `DsDataRow` (title, description, action). */
export function DsDataRowSkeleton({ className, ...props }: React.ComponentPropsWithoutRef<"li">) {
  return (
    <li aria-hidden="true" className={cn("flex items-center justify-between gap-ds-16 px-ds-16 py-ds-16", className)} {...props}>
      <div className="flex min-w-0 flex-1 items-center gap-ds-12">
        <DsSkeleton className="size-4 shrink-0" />
        <div className="min-w-0 flex-1 space-y-ds-8">
          <DsSkeleton className="h-4 w-1/3" />
          <DsSkeleton className="h-3 w-1/2" />
        </div>
      </div>
      <DsSkeleton className="h-8 w-24 shrink-0 rounded-ds-buttons" />
    </li>
  );
}
