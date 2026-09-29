import { cn } from "@/lib/utils";
import type * as React from "react";
import { Card } from "@/components/ui/card";

export function DashboardCard({ className, ...props }: React.ComponentProps<typeof Card>) {
  return (
    <Card
      variant="overview"
      className={cn("h-full rounded-none border-0 bg-card shadow-none ring-0", className)}
      {...props}
    />
  );
}
