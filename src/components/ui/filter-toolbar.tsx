import * as React from "react"

import { cn } from "@/lib/utils"

type FilterToolbarProps = Omit<React.ComponentProps<"div">, "results"> & {
  filters?: React.ReactNode
  actions?: React.ReactNode
  results?: React.ReactNode
}

function FilterToolbar({ filters, actions, results, className, ...props }: FilterToolbarProps) {
  return (
    <div
      data-slot="filter-toolbar"
      className={cn(
        "flex min-w-0 flex-col gap-3 rounded-[var(--radius-md)] border border-border/70 bg-card p-[var(--size-spacing-03)] sm:flex-row sm:flex-wrap sm:items-center sm:justify-between",
        className,
      )}
      {...props}
    >
      {filters ? <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">{filters}</div> : <span />}
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        {results ? <span className="text-sm text-muted-foreground">{results}</span> : null}
        {actions}
      </div>
    </div>
  )
}

export { FilterToolbar, type FilterToolbarProps }
