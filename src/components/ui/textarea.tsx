import * as React from "react";
import { cn } from "@/lib/utils";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return <textarea data-slot="textarea" className={cn("min-h-20 w-full resize-y rounded-lg border border-input bg-transparent px-3 py-2 text-sm transition-[background-color,border-color,box-shadow] duration-[var(--duration-quick)] ease-[var(--ease-smooth-out)] outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none", className)} {...props} />;
}

export { Textarea };
