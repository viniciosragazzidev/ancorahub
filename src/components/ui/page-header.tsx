import * as React from "react"

import { cn } from "@/lib/utils"

type PageHeaderProps = React.ComponentProps<"header"> & {
  eyebrow?: React.ReactNode
  title: React.ReactNode
  description?: React.ReactNode
  actions?: React.ReactNode
}

function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
  ...props
}: PageHeaderProps) {
  return (
    <header
      data-slot="page-header"
      className={cn(
        "flex min-w-0 flex-col gap-3 border-b border-border/70 pb-[var(--size-spacing-04)] sm:flex-row sm:items-start sm:justify-between",
        className,
      )}
      {...props}
    >
      <div className="min-w-0 space-y-1">
        {eyebrow ? <p className="text-xs font-medium text-muted-foreground">{eyebrow}</p> : null}
        <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">{title}</h1>
        {description ? <p className="max-w-3xl text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  )
}

export { PageHeader, type PageHeaderProps }
