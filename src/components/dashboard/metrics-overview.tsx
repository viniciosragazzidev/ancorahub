import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type MetricsOverviewProps = {
  children: ReactNode;
  columns?: 2 | 3 | 4 | 5;
  className?: string;
};

const columnClasses = {
  2: "sm:grid-cols-2",
  3: "sm:grid-cols-3",
  4: "sm:grid-cols-2 xl:grid-cols-4",
  5: "sm:grid-cols-2 lg:grid-cols-5",
} as const;

/** Groups related indicators in a single operational surface. */
export function MetricsOverview({ children, columns = 3, className }: MetricsOverviewProps) {
  return (
    <section
      aria-label="Resumo operacional"
      data-slot="metrics-overview"
      className={cn(
        "grid overflow-hidden rounded-xl border border-border bg-border shadow-[0_1px_1px_rgb(15_23_42/0.02)]",
        columnClasses[columns],
        "[&>[data-slot=card]]:min-w-0 [&>[data-slot=card]]:rounded-none [&>[data-slot=card]]:border-0 [&>[data-slot=card]]:shadow-none",
        className,
      )}
    >
      {children}
    </section>
  );
}
