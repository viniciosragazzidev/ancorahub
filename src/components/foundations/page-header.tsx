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
        "flex min-w-0 flex-col gap-3 border-b border-border/70 pb-4 sm:flex-row sm:items-start sm:justify-between sm:gap-4",
        className,
      )}
      {...props}
    >
      <div className="min-w-0 space-y-1">
        {breadcrumb && (
          <div className="text-xs font-medium text-muted-foreground max-[559px]:hidden">
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
          <p className="max-w-3xl text-xs leading-relaxed text-muted-foreground max-[559px]:line-clamp-2 sm:text-sm">
            {description}
          </p>
        )}
      </div>

      {actions && (
        <div className="flex w-full shrink-0 items-center gap-2 overflow-x-auto pb-0.5 [scrollbar-width:none] sm:w-auto sm:flex-wrap sm:overflow-visible sm:pb-0 sm:self-start">
          {actions}
        </div>
      )}
    </header>
  );
}
