import type { ReactNode } from "react";

import { CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/**
 * Standard card header: neutral 16px icon, text-base title, text-xs
 * description and a hairline divider. Shared by /equipe and
 * /leads/distribuicao so every card title reads the same.
 */
export function SectionCardHeader({
  icon,
  title,
  badge,
  description,
  actions,
  className,
}: {
  icon?: ReactNode;
  title: ReactNode;
  badge?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <CardHeader className={cn("gap-0 border-b border-border/50 p-4", className)}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <CardTitle className="flex flex-wrap items-center gap-2 text-base">
            {icon ? (
              <span aria-hidden="true" className="flex size-4 shrink-0 items-center justify-center text-foreground [&_svg]:size-4!">
                {icon}
              </span>
            ) : null}
            {title}
            {badge}
          </CardTitle>
          {description ? (
            <CardDescription className="mt-1 max-w-3xl text-xs leading-5">{description}</CardDescription>
          ) : null}
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </CardHeader>
  );
}
