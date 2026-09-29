import * as React from "react";

import { cn } from "@/lib/utils";

function ResponsiveDataView({
  desktop,
  mobile,
  className,
}: {
  desktop: React.ReactNode;
  mobile: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className} data-slot="responsive-data-view">
      <div className="hidden sm:block" data-slot="responsive-data-desktop">
        {desktop}
      </div>
      <div className="sm:hidden" data-slot="responsive-data-mobile">
        {mobile}
      </div>
    </div>
  );
}

function MobileDataList({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="mobile-data-list"
      className={cn(
        "divide-y divide-border overflow-hidden rounded-[var(--radius-card)] border border-border bg-card",
        className,
      )}
      {...props}
    />
  );
}

function MobileDataListItem({ className, ...props }: React.ComponentProps<"article">) {
  return (
    <article
      data-slot="mobile-data-list-item"
      className={cn("min-w-0 px-4 py-3.5", className)}
      {...props}
    />
  );
}

function MobileDataRow({
  label,
  value,
  className,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex min-w-0 items-baseline justify-between gap-3", className)}>
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="min-w-0 text-right text-xs font-medium tabular-nums text-foreground">
        {value}
      </span>
    </div>
  );
}

export { MobileDataList, MobileDataListItem, MobileDataRow, ResponsiveDataView };
