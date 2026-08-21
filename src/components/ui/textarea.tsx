import * as React from "react";
import { cn } from "@/lib/utils";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return <textarea data-slot="textarea" className={cn("min-h-20 w-full resize-y rounded-[var(--radius-control)] border border-input bg-card px-3 py-2 text-sm shadow-none transition-[background-color,border-color,box-shadow] duration-[var(--duration-quick)] ease-[var(--ease-smooth-out)] outline-none placeholder:text-muted-foreground hover:border-border-strong focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/20 disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none", className)} {...props} />;
}

export { Textarea };
