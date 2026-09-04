"use client";

import * as React from "react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export interface SettingsSectionProps {
  title: string;
  description?: string;
  badge?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export function SettingsSection({
  title,
  description,
  badge,
  actions,
  children,
  className,
}: SettingsSectionProps) {
  return (
    <div
      data-slot="canonical-settings-section"
      className={cn("rounded-xl border border-border/80 bg-card p-5 space-y-5 shadow-xs", className)}
    >
      <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between border-b border-border/60 pb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold tracking-tight text-foreground sm:text-base">
              {title}
            </h3>
            {badge}
          </div>
          {description && (
            <p className="max-w-2xl text-xs text-muted-foreground leading-relaxed">
              {description}
            </p>
          )}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2 pt-2 sm:pt-0">{actions}</div>}
      </div>

      <div className="space-y-4">{children}</div>
    </div>
  );
}

export interface SettingsToggleRowProps {
  id?: string;
  label: string;
  description?: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  badge?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}

export function SettingsToggleRow({
  id: explicitId,
  label,
  description,
  checked,
  onCheckedChange,
  disabled = false,
  badge,
  children,
  className,
}: SettingsToggleRowProps) {
  const generatedId = React.useId();
  const id = explicitId || generatedId;

  return (
    <div
      data-slot="canonical-settings-toggle-row"
      className={cn(
        "rounded-lg border border-border/60 bg-muted/20 p-4 transition-colors",
        checked && "bg-muted/40 border-border/80",
        disabled && "opacity-60",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex items-center gap-2">
            <Label
              htmlFor={id}
              className="text-xs font-semibold text-foreground cursor-pointer sm:text-sm"
            >
              {label}
            </Label>
            {badge}
          </div>
          {description && (
            <p className="text-xs text-muted-foreground leading-relaxed">
              {description}
            </p>
          )}
        </div>

        <Switch
          id={id}
          checked={checked}
          onCheckedChange={onCheckedChange}
          disabled={disabled}
          className="shrink-0 mt-0.5"
        />
      </div>

      {checked && children && (
        <div className="mt-4 border-t border-border/60 pt-4 space-y-3 animate-in fade-in-50 duration-200">
          {children}
        </div>
      )}
    </div>
  );
}
