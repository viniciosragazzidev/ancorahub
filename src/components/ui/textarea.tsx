import * as React from "react";
import { cn } from "@/lib/utils";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return <textarea data-slot="textarea" className={cn("min-h-20 w-full resize-y rounded-md border border-input bg-card px-3 py-2 text-sm shadow-[inset_0_1px_1px_rgb(15_23_42/0.02)] transition-[background-color,border-color,box-shadow] duration-200 ease-out outline-none placeholder:text-muted-foreground hover:border-border-strong focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/20 disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none", className)} {...props} />;
}

export { Textarea };
