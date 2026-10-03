import { cn } from "@/lib/utils"

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("ct-skeleton rounded-[var(--radius-control)] bg-muted", className)}
      {...props}
    />
  )
}

export { Skeleton }
