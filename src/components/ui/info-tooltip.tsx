"use client";

import React from "react";
import { HelpCircle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { DOMAIN_GLOSSARY } from "@/shared/glossary";
import { cn } from "@/lib/utils";

interface InfoTooltipProps {
  term?: string;
  title?: string;
  description?: string;
  className?: string;
  iconClassName?: string;
  side?: "top" | "right" | "bottom" | "left";
}

export function InfoTooltip({
  term,
  title,
  description,
  className,
  iconClassName,
  side = "top",
}: InfoTooltipProps) {
  const entry = term ? DOMAIN_GLOSSARY[term] : undefined;
  const displayTitle = title || entry?.title || "Informação";
  const displayDesc = description || entry?.description || "";

  if (!displayDesc) return null;

  return (
    <TooltipProvider delay={200}>
      <Tooltip>
        <TooltipTrigger>
          <span
            className={cn(
              "inline-flex items-center justify-center text-muted-foreground/70 transition-colors hover:text-foreground focus:outline-none focus-visible:ring-1 focus-visible:ring-ring rounded-full p-0.5 cursor-help",
              className
            )}
            aria-label={`Ver ajuda para ${displayTitle}`}
          >
            <HelpCircle className={cn("size-3.5 shrink-0", iconClassName)} />
          </span>
        </TooltipTrigger>
        <TooltipContent side={side} className="max-w-xs space-y-1 p-3 text-left shadow-md">
          <p className="text-xs font-semibold text-foreground">{displayTitle}</p>
          <p className="text-[11px] leading-relaxed text-muted-foreground">{displayDesc}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
