import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type StatusTone = "neutral" | "info" | "success" | "warning" | "danger";

export interface StatusBadgeProps {
  label: string;
  tone?: StatusTone;
  icon?: React.ComponentType<{ className?: string }>;
  dot?: boolean;
  className?: string;
}

const toneBadgeVariants: Record<StatusTone, "secondary" | "outline" | "default" | "destructive" | "warning" | "success"> = {
  neutral: "secondary",
  info: "secondary",
  success: "success",
  warning: "warning",
  danger: "destructive",
};

const toneDotColors: Record<StatusTone, string> = {
  neutral: "bg-muted-foreground",
  info: "bg-primary",
  success: "bg-emerald-500",
  warning: "bg-amber-500",
  danger: "bg-rose-500",
};

export function StatusDot({
  tone = "neutral",
  className,
}: {
  tone?: StatusTone;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-block size-2 shrink-0 rounded-full",
        toneDotColors[tone],
        className,
      )}
      aria-hidden="true"
    />
  );
}

export function StatusBadge({
  label,
  tone = "neutral",
  icon: Icon,
  dot = false,
  className,
}: StatusBadgeProps) {
  return (
    <Badge
      variant={toneBadgeVariants[tone]}
      className={cn("gap-1.5 font-medium text-[11px] py-0.5 px-2", className)}
      data-slot="canonical-status-badge"
    >
      {dot && <StatusDot tone={tone} />}
      {Icon && <Icon className="size-3 shrink-0" />}
      <span>{label}</span>
    </Badge>
  );
}
