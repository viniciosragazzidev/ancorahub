"use client";

import * as React from "react";
import Link from "next/link";
import { MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export interface PageActionItem {
  id?: string;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  onClick?: () => void;
  href?: string;
  disabled?: boolean;
  destructive?: boolean;
  tooltip?: string;
}

export interface PageActionsProps {
  primaryAction?: {
    label: string;
    icon?: React.ComponentType<{ className?: string }>;
    onClick?: () => void;
    href?: string;
    disabled?: boolean;
    loading?: boolean;
    className?: string;
  };
  moreActions?: PageActionItem[];
  children?: React.ReactNode;
  className?: string;
}

export function PageActions({
  primaryAction,
  moreActions = [],
  children,
  className,
}: PageActionsProps) {
  const standardActions = moreActions.filter((a) => !a.destructive);
  const destructiveActions = moreActions.filter((a) => a.destructive);

  return (
    <div className={cn("flex items-center gap-2", className)} data-slot="canonical-page-actions">
      {children}

      {primaryAction && (
        primaryAction.href ? (
          <Button
            size="sm"
            className={cn("gap-1.5 font-semibold shadow-xs", primaryAction.className)}
            disabled={primaryAction.disabled || primaryAction.loading}
            asChild
          >
            <Link href={primaryAction.href}>
              {primaryAction.icon && <primaryAction.icon className="size-4 shrink-0" />}
              <span>{primaryAction.label}</span>
            </Link>
          </Button>
        ) : (
          <Button
            size="sm"
            onClick={primaryAction.onClick}
            disabled={primaryAction.disabled || primaryAction.loading}
            className={cn("gap-1.5 font-semibold shadow-xs", primaryAction.className)}
          >
            {primaryAction.icon && <primaryAction.icon className="size-4 shrink-0" />}
            <span>{primaryAction.label}</span>
          </Button>
        )
      )}

      {moreActions.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger
            className="inline-flex size-8 items-center justify-center rounded-lg border border-border/80 bg-background text-muted-foreground hover:bg-muted/80 hover:text-foreground transition-colors cursor-pointer"
            aria-label="Mais opções"
            title="Mais opções"
          >
            <MoreHorizontal className="size-4" />
          </DropdownMenuTrigger>

            <DropdownMenuContent align="end" className="w-48">
              {standardActions.map((action, idx) => (
                action.href ? (
                  <DropdownMenuItem
                    key={action.id || idx}
                    disabled={action.disabled}
                    render={<Link href={action.href} />}
                    className="gap-2 text-xs font-medium cursor-pointer"
                  >
                    {action.icon && <action.icon className="size-3.5 text-muted-foreground" />}
                    <span>{action.label}</span>
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem
                    key={action.id || idx}
                    disabled={action.disabled}
                    onClick={action.onClick}
                    className="gap-2 text-xs font-medium cursor-pointer"
                  >
                    {action.icon && <action.icon className="size-3.5 text-muted-foreground" />}
                    <span>{action.label}</span>
                  </DropdownMenuItem>
                )
              ))}

              {destructiveActions.length > 0 && standardActions.length > 0 && (
                <DropdownMenuSeparator />
              )}

              {destructiveActions.map((action, idx) => (
                action.href ? (
                  <DropdownMenuItem
                    key={action.id || `destr-${idx}`}
                    disabled={action.disabled}
                    render={<Link href={action.href} />}
                    variant="destructive"
                    className="gap-2 text-xs font-medium cursor-pointer"
                  >
                    {action.icon && <action.icon className="size-3.5" />}
                    <span>{action.label}</span>
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem
                    key={action.id || `destr-${idx}`}
                    disabled={action.disabled}
                    onClick={action.onClick}
                    variant="destructive"
                    className="gap-2 text-xs font-medium cursor-pointer"
                  >
                    {action.icon && <action.icon className="size-3.5" />}
                    <span>{action.label}</span>
                  </DropdownMenuItem>
                )
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
      )}
    </div>
  );
}
