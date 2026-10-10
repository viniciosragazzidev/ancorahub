import * as React from "react";
import { cn } from "@/lib/utils";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return <textarea data-slot="textarea" className={cn("min-h-[110px] w-full resize-y rounded-3xl border border-[var(--border-strong)] bg-card p-3 text-sm shadow-none transition-[background-color,border-color] duration-[var(--duration-quick)] ease-[var(--ease-smooth-out)] outline-none placeholder:text-muted-foreground hover:border-foreground focus-visible:border-foreground disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-50 aria-invalid:border-destructive motion-reduce:transition-none", className)} {...props} />;
}

export { Textarea };
