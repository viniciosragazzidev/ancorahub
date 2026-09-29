import type * as React from "react";

import { cn } from "@/lib/utils";

export function DashboardGrid({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dashboard-grid"
      className={cn(
        "grid min-w-0 overflow-hidden rounded-[var(--radius-card)] border border-border bg-border p-px",
        "grid-cols-1 gap-px",
        className,
      )}
      {...props}
    />
  );
}
