import * as React from "react";
import { cn } from "@/lib/utils";

export interface PageHeaderProps extends Omit<React.HTMLAttributes<HTMLElement>, "title"> {
  title: React.ReactNode;
  description?: React.ReactNode;
  breadcrumb?: React.ReactNode;
  context?: React.ReactNode;
  actions?: React.ReactNode;
}

export function PageHeader({
  title,
  description,
  breadcrumb,
  context,
  actions,
  className,
  ...props
}: PageHeaderProps) {
  return (
    <header
      data-slot="canonical-page-header"
      className={cn(
        "flex min-w-0 flex-col gap-4 border-b border-border/70 pb-4 sm:flex-row sm:items-start sm:justify-between",
        className,
      )}
      {...props}
    >
      <div className="min-w-0 space-y-1">
        {breadcrumb && (
          <div className="text-xs font-medium text-muted-foreground">
            {breadcrumb}
          </div>
        )}
        <div className="flex flex-wrap items-center gap-2.5">
          <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
            {title}
          </h1>
          {context && <div className="shrink-0">{context}</div>}
        </div>
        {description && (
          <p className="max-w-3xl text-xs sm:text-sm text-muted-foreground leading-relaxed">
            {description}
          </p>
        )}
      </div>

      {actions && (
        <div className="flex shrink-0 flex-wrap items-center gap-2 sm:self-start">
          {actions}
        </div>
      )}
    </header>
  );
}
