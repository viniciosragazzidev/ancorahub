"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

function Progress({
  className,
  value = 0,
  max = 100,
  ...props
}: React.ComponentProps<"div"> & {
  value?: number
  max?: number
}) {
  const percentage = Math.min(Math.max(value, 0), max) / max * 100

  return (
    <div
      data-slot="progress"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
      aria-valuetext={`${Math.round(percentage)}%`}
      className={cn(
        "relative h-2 w-full overflow-hidden rounded-full bg-muted",
        className
      )}
      {...props}
    >
      <div
        data-slot="progress-indicator"
        className="h-full w-full flex-1 rounded-full bg-primary transition-all duration-300 ease-smooth-out"
        style={{ transform: `translateX(-${100 - percentage}%)` }}
      />
    </div>
  )
}

export { Progress }
