import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const dataTableFrameVariants = cva(
  "relative overflow-hidden border border-border/75 bg-card text-card-foreground shadow-none",
  {
    variants: {
      density: {
        comfortable: "rounded-[var(--radius-card)]",
        compact: "rounded-[var(--radius-control)]",
      },
    },
    defaultVariants: {
      density: "comfortable",
    },
  },
);

type DataTableFrameProps = React.ComponentProps<"div"> &
  VariantProps<typeof dataTableFrameVariants>;

function DataTableFrame({
  className,
  density = "comfortable",
  ...props
}: DataTableFrameProps) {
  return (
    <div
      data-slot="data-table-surface"
      data-density={density}
      className={cn(dataTableFrameVariants({ density }), className)}
      {...props}
    />
  );
}

const dataTableStyles = {
  header: "border-b border-border bg-[var(--surface-secondary)]",
  headerRow: "border-b border-border hover:bg-transparent",
  head: "h-10 px-3.5 text-xs font-semibold tracking-tight text-muted-foreground",
  body: "bg-card",
  row: "border-b border-border/70 bg-card transition-colors duration-[var(--duration-quick)] hover:bg-muted/40 focus-within:bg-muted/40 motion-reduce:transition-none",
  cell: "px-4 py-2.5 text-sm font-normal text-foreground",
} as const;

export { DataTableFrame, dataTableFrameVariants, dataTableStyles };
