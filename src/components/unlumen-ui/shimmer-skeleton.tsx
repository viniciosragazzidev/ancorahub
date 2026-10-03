import { type HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface ShimmerSkeletonProps extends HTMLAttributes<HTMLDivElement> {
  rounded?: "none" | "sm" | "md" | "lg" | "full";
  animate?: boolean;
}

function ShimmerSkeleton({
  className,
  rounded = "md",
  animate = true,
  ...props
}: ShimmerSkeletonProps) {
  const roundedClass = {
    none: "rounded-none",
    sm: "rounded-sm",
    md: "rounded-md",
    lg: "rounded-lg",
    full: "rounded-full",
  }[rounded];

  return (
    <div
      role="status"
      aria-label="Carregando"
      data-slot="shimmer-skeleton"
      data-animate={animate}
      className={cn(
        "ct-skeleton relative overflow-hidden bg-muted",
        roundedClass,
        className,
      )}
      {...props}
    />
  );
}

export { ShimmerSkeleton };
export type { ShimmerSkeletonProps };
