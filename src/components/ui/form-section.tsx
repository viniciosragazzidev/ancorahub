import * as React from "react"

import { cn } from "@/lib/utils"

type FormSectionProps = React.ComponentProps<"section"> & {
  title: React.ReactNode
  description?: React.ReactNode
  actions?: React.ReactNode
}

function FormSection({ title, description, actions, children, className, ...props }: FormSectionProps) {
  return (
    <section
      data-slot="form-section"
      className={cn("grid gap-[var(--size-spacing-03)] border-t border-border/70 pt-[var(--size-spacing-04)] first:border-t-0 first:pt-0", className)}
      {...props}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="space-y-1">
          <h2 className="text-sm font-semibold text-foreground">{title}</h2>
          {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
        </div>
        {actions}
      </div>
      <div className="grid gap-[var(--size-spacing-03)]">{children}</div>
    </section>
  )
}

export { FormSection, type FormSectionProps }
