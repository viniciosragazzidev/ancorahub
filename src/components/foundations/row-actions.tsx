"use client";

import * as React from "react";
import Link from "next/link";
import { MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export type ActionGroup = "primary" | "management" | "other" | "danger";

export interface RowActionItem {
  id?: string;
  label: string;
  group?: ActionGroup;
  icon?: React.ComponentType<{ className?: string }>;
  onClick?: () => void;
  href?: string;
  disabled?: boolean;
  destructive?: boolean;
}

export interface RowActionsProps {
  actions: RowActionItem[];
  label?: string;
  align?: "start" | "center" | "end";
  className?: string;
}

export function RowActions({
  actions,
  label = "Ações",
  align = "end",
  className,
}: RowActionsProps) {
  if (actions.length === 0) return null;

  const primaryGroup = actions.filter((a) => (a.group === "primary" || !a.group) && !a.destructive);
  const managementGroup = actions.filter((a) => a.group === "management" && !a.destructive);
  const otherGroup = actions.filter((a) => a.group === "other" && !a.destructive);
  const dangerGroup = actions.filter((a) => a.destructive || a.group === "danger");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted/80 hover:text-foreground transition-colors cursor-pointer",
          className,
        )}
        aria-label={label}
        title={label}
      >
        <MoreHorizontal className="size-4" />
      </DropdownMenuTrigger>

        <DropdownMenuContent align={align} className="w-48">
          {primaryGroup.length > 0 && (
            <DropdownMenuGroup>
              {primaryGroup.map((action, idx) => (
                <ActionItem key={action.id || `prim-${idx}`} action={action} />
              ))}
            </DropdownMenuGroup>
          )}

          {managementGroup.length > 0 && (
            <>
              {primaryGroup.length > 0 && <DropdownMenuSeparator />}
              <DropdownMenuLabel className="text-[10px] uppercase font-semibold text-muted-foreground/70 tracking-wider px-2 py-1">
                Gestão
              </DropdownMenuLabel>
              <DropdownMenuGroup>
                {managementGroup.map((action, idx) => (
                  <ActionItem key={action.id || `mgmt-${idx}`} action={action} />
                ))}
              </DropdownMenuGroup>
            </>
          )}

          {otherGroup.length > 0 && (
            <>
              {(primaryGroup.length > 0 || managementGroup.length > 0) && <DropdownMenuSeparator />}
              <DropdownMenuGroup>
                {otherGroup.map((action, idx) => (
                  <ActionItem key={action.id || `oth-${idx}`} action={action} />
                ))}
              </DropdownMenuGroup>
            </>
          )}

          {dangerGroup.length > 0 && (
            <>
              {(primaryGroup.length > 0 || managementGroup.length > 0 || otherGroup.length > 0) && (
                <DropdownMenuSeparator />
              )}
              <DropdownMenuGroup>
                {dangerGroup.map((action, idx) => (
                  <ActionItem key={action.id || `dang-${idx}`} action={action} isDestructive />
                ))}
              </DropdownMenuGroup>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
  );
}

function ActionItem({ action, isDestructive }: { action: RowActionItem; isDestructive?: boolean }) {
  const Icon = action.icon;

  if (action.href && !action.disabled) {
    return (
      <DropdownMenuItem
        render={<Link href={action.href} />}
        variant={isDestructive ? "destructive" : "default"}
        className={cn(
          "gap-2 text-xs font-medium cursor-pointer",
          isDestructive && "text-destructive focus:bg-destructive/10 focus:text-destructive",
        )}
      >
        {Icon && <Icon className={cn("size-3.5", isDestructive ? "text-destructive" : "text-muted-foreground")} />}
        <span>{action.label}</span>
      </DropdownMenuItem>
    );
  }

  return (
    <DropdownMenuItem
      disabled={action.disabled}
      onClick={action.onClick}
      className={cn(
        "gap-2 text-xs font-medium cursor-pointer",
        isDestructive && "text-destructive focus:bg-destructive/10 focus:text-destructive",
      )}
    >
      {Icon && <Icon className={cn("size-3.5", isDestructive ? "text-destructive" : "text-muted-foreground")} />}
      <span>{action.label}</span>
    </DropdownMenuItem>
  );
}
