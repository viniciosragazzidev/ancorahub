"use client";

import React from "react";
import Link from "next/link";
import { ArrowRight, Link as LinkIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type RelatedLinkItem = {
  label: string;
  href: string;
  description?: string;
  icon?: React.ElementType;
  badge?: string;
};

interface RelatedActionsProps {
  title?: string;
  description?: string;
  links: RelatedLinkItem[];
  className?: string;
}

export function RelatedActions({
  title = "Ações e Contexto Relacionado",
  description = "Navegação direta para funcionalidades conectadas a esta etapa do trabalho.",
  links,
  className,
}: RelatedActionsProps) {
  if (!links || links.length === 0) return null;

  return (
    <Card variant="subtle" className={cn("rounded-xl border-border/80 p-4 space-y-3", className)}>
      <CardHeader className="p-0 space-y-1">
        <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
          <LinkIcon className="size-3.5 text-primary" />
          {title}
        </CardTitle>
        {description && <p className="text-[11px] text-muted-foreground">{description}</p>}
      </CardHeader>

      <CardContent className="p-0">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {links.map((item, index) => {
            const Icon = item.icon || ArrowRight;
            return (
              <Button
                key={index}
                variant="outline"
                size="sm"
                render={<Link href={item.href} />}
                className="h-auto justify-between rounded-lg p-3 text-left hover:border-primary/50 hover:bg-muted/40"
              >
                <div className="flex items-start gap-2.5 min-w-0">
                    <Icon className="size-4 shrink-0 text-primary mt-0.5" />
                    <div className="min-w-0 space-y-0.5">
                      <div className="font-semibold text-xs text-foreground truncate">{item.label}</div>
                      {item.description && (
                        <div className="text-[11px] text-muted-foreground line-clamp-1">{item.description}</div>
                      )}
                    </div>
                  </div>
                  {item.badge && (
                    <span className="ml-2 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary shrink-0">
                      {item.badge}
                    </span>
                  )}
              </Button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
