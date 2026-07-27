import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function BacklogOverlay({ title = "Recurso planejado", description, children, className }: { title?: string; description: string; children: ReactNode; className?: string }) {
  return <div className={cn("relative", className)}><div className="pointer-events-none select-none blur-[3px] opacity-60">{children}</div><div className="absolute inset-0 flex items-center justify-center rounded-xl bg-background/20"><div className="max-w-xs rounded-lg border border-border/80 bg-card/95 px-4 py-3 text-center shadow-sm"><Badge variant="outline">{title}</Badge><p className="mt-2 text-xs leading-5 text-muted-foreground">{description}</p></div></div></div>;
}
