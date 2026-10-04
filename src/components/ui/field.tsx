import * as React from "react"

import { cn } from "@/lib/utils"
import { CheckIcon } from "@/components/huge-icons"

function Field({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="field"
      className={cn("grid gap-[var(--size-spacing-02)]", className)}
      {...props}
    />
  )
}

function FieldLabel({ className, ...props }: React.ComponentProps<"label">) {
  return (
    <label
      data-slot="field-label"
      className={cn("text-sm font-medium leading-none tracking-tight", className)}
      {...props}
    />
  )
}

function FieldDescription({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="field-description"
      className={cn("text-xs text-muted-foreground", className)}
      {...props}
    />
  )
}

function FieldError({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="field-error"
      role="alert"
      className={cn("text-xs font-medium text-destructive", className)}
      {...props}
    />
  )
}

function FieldSuccess({ className, children, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="field-success"
      role="status"
      className={cn("ct-field-success inline-flex items-center gap-1 text-xs font-medium text-success", className)}
      {...props}
    >
      <CheckIcon className="size-3.5" aria-hidden="true" />
      {children}
    </p>
  )
}

export { Field, FieldLabel, FieldDescription, FieldError, FieldSuccess }
