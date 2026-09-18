import * as React from "react";
import { cn } from "@/utils/core/cn";

export type DsStatusBadgeStatus =
  | "pending"
  | "completed"
  | "success"
  | "warning"
  | "info"
  | "secondary"
  | "destructive";

export interface DsStatusBadgeProps
  extends Omit<React.ComponentPropsWithoutRef<"span">, "children"> {
  status: DsStatusBadgeStatus;
  /** Defaults to a Portuguese label per status when omitted. */
  label?: React.ReactNode;
}

// success = completed, warning = pending: same tone, different label — see
// docs/design-system.md § Status Badge (semantic variants).
const STATUS_CLASS: Record<DsStatusBadgeStatus, string> = {
  completed: "bg-ds-soft-mint text-ds-forest-ink",
  success: "bg-ds-soft-mint text-ds-forest-ink",
  pending: "bg-ds-amber-wash text-ds-amber-ink",
  warning: "bg-ds-amber-wash text-ds-amber-ink",
  info: "bg-ds-powder-blue text-ds-electric-blue",
  secondary: "bg-ds-paper-mist text-ds-steel",
  destructive: "bg-ds-rose-wash text-ds-rose-ink",
};

const STATUS_DOT_CLASS: Record<DsStatusBadgeStatus, string> = {
  completed: "bg-ds-vivid-green",
  success: "bg-ds-vivid-green",
  pending: "bg-ds-tangerine",
  warning: "bg-ds-tangerine",
  info: "bg-ds-electric-blue",
  secondary: "bg-ds-steel",
  destructive: "bg-ds-rose-ink",
};

const STATUS_DEFAULT_LABEL: Record<DsStatusBadgeStatus, string> = {
  completed: "Concluído",
  success: "Concluído",
  pending: "Pendente",
  warning: "Atenção",
  info: "Info",
  secondary: "Neutro",
  destructive: "Erro",
};

/**
 * Status Badge — docs/design-system.md § Status Badge (semantic variants).
 * Tinted background, small colored dot, dark text, 9999px radius. Row-level
 * state indicator in tables and lists. Padding is 4px/8px (nearest values on
 * the spacing scale), not the doc's literal 6px/10px — confirmed with the
 * user. Pending/completed and warning/success share the same tone pair by
 * design; destructive is the system's only red — don't introduce another.
 */
export const DsStatusBadge = React.forwardRef<HTMLSpanElement, DsStatusBadgeProps>(
  function DsStatusBadge({ className, status, label, ...props }, ref) {
    return (
      <span
        ref={ref}
        data-slot="ds-status-badge"
        className={cn(
          "inline-flex items-center gap-ds-8 rounded-ds-tags px-ds-8 py-ds-4 font-ds-inter text-ds-caption font-medium",
          STATUS_CLASS[status],
          className,
        )}
        {...props}
      >
        <span
          className={cn("size-1.5 shrink-0 rounded-full", STATUS_DOT_CLASS[status])}
          aria-hidden="true"
        />
        {label ?? STATUS_DEFAULT_LABEL[status]}
      </span>
    );
  },
);
