"use client";

import * as React from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

export interface DetailDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  summary?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
  size?: "default" | "sm" | "lg" | "xl";
}

const sizeClasses = {
  sm: "sm:max-w-md",
  default: "sm:max-w-lg",
  lg: "sm:max-w-xl",
  xl: "sm:max-w-2xl",
};

export function DetailDrawer({
  open,
  onOpenChange,
  title,
  description,
  summary,
  actions,
  children,
  footer,
  className,
  size = "default",
}: DetailDrawerProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className={cn(
          "flex flex-col gap-0 p-0 overflow-hidden",
          sizeClasses[size],
          className,
        )}
        data-slot="canonical-detail-drawer"
      >
        <SheetHeader className="border-b border-border/70 p-5 pb-4 space-y-2">
          <div className="flex items-start justify-between gap-4 pr-6">
            <div className="space-y-1">
              <SheetTitle className="text-base font-bold text-foreground sm:text-lg">
                {title}
              </SheetTitle>
              {description && (
                <SheetDescription className="text-xs text-muted-foreground leading-relaxed">
                  {description}
                </SheetDescription>
              )}
            </div>
            {actions && <div className="shrink-0">{actions}</div>}
          </div>

          {summary && <div className="pt-2">{summary}</div>}
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-5 space-y-6 [scrollbar-width:thin]">
          {children}
        </div>

        {footer && (
          <div className="border-t border-border/70 bg-muted/20 p-4 px-5">
            {footer}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
