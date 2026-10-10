import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const dataTableFrameVariants = cva(
  "relative overflow-hidden rounded-[var(--radius-card)] bg-card text-card-foreground shadow-[var(--shadow-card)]",
  {
    variants: {
      density: {
        comfortable: "rounded-[var(--radius-card)]",
        compact: "rounded-[var(--radius-card)]",
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
  header: "border-b border-[var(--border-subtle)] dark:border-border bg-transparent",
  headerRow: "border-b border-[var(--border-subtle)] dark:border-border hover:bg-transparent",
  head: "h-10 px-3.5 text-xs font-medium text-muted-foreground",
  body: "bg-transparent",
  row: "border-b border-[var(--border-subtle)] dark:border-border bg-transparent transition-colors duration-[var(--duration-quick)] hover:bg-muted focus-within:bg-muted motion-reduce:transition-none",
  cell: "px-4 py-2.5 text-sm font-normal text-foreground",
  /**
   * The /equipe table look for plain <Table> markup (tables not built on
   * DataTable): 40px header row, 12px cells, same paddings.
   */
  native: "[&_th]:h-10 [&_th]:px-3.5 [&_td]:px-4 [&_td]:py-2.5 [&_td]:text-sm",
} as const;

export { DataTableFrame, dataTableFrameVariants, dataTableStyles };
