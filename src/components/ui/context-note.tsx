import type { ElementType, ReactNode } from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { CheckCircle, InfoIcon, TriangleAlertIcon, XCircle } from "@/components/huge-icons";
import { cn } from "@/lib/utils";

const contextNoteVariants = cva(
  "flex items-start gap-2.5 rounded-[min(var(--radius-md),10px)] border px-3 py-2.5 text-xs leading-5",
  {
    variants: {
      variant: {
        info: "border-primary/20 bg-primary/[0.06] text-muted-foreground [&>svg]:text-primary",
        warning: "border-warning/25 bg-accent/[0.07] text-muted-foreground [&>svg]:text-warning",
        success: "border-success/20 bg-success/[0.06] text-muted-foreground [&>svg]:text-success",
        error: "border-destructive/20 bg-destructive/[0.06] text-muted-foreground [&>svg]:text-destructive",
        neutral: "border-border bg-muted/35 text-muted-foreground [&>svg]:text-foreground/60",
      },
    },
    defaultVariants: { variant: "info" },
  },
);

type ContextNoteProps = VariantProps<typeof contextNoteVariants> & {
  children: ReactNode;
  className?: string;
  icon?: ElementType;
  title?: string;
};

const defaultIcons = {
  info: InfoIcon,
  warning: TriangleAlertIcon,
  success: CheckCircle,
  error: XCircle,
  neutral: InfoIcon,
} as const;

export function ContextNote({ children, className, icon, title, variant = "info" }: ContextNoteProps) {
  const Icon = icon ?? defaultIcons[variant ?? "info"];

  return (
    <div className={cn(contextNoteVariants({ variant }), className)} role="status">
      <Icon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      <div className="min-w-0">
        {title ? <p className="font-medium text-foreground">{title}</p> : null}
        <p>{children}</p>
      </div>
    </div>
  );
}

export { contextNoteVariants };
