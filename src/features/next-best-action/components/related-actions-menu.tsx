"use client";

import React from "react";
import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { NextBestAction } from "../types";
import { trackNBAClicked } from "../analytics";

type RelatedActionsMenuProps = {
  secondaryActions: NextBestAction[];
};

export function RelatedActionsMenu({ secondaryActions }: RelatedActionsMenuProps) {
  if (!secondaryActions || secondaryActions.length === 0) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={
        <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs font-medium rounded-lg">
          <span>Outras ações</span>
          <ArrowRight className="size-3 text-muted-foreground" />
        </Button>
      } />
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Ações Recomendadas
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {secondaryActions.map((action) => (
          <DropdownMenuItem
            key={action.key}
            onClick={() => trackNBAClicked(action)}
            render={action.href ? <Link href={action.href} /> : undefined}
            className="flex items-center justify-between text-xs py-2 cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <Sparkles className="size-3.5 text-primary shrink-0" />
              <span>{action.label}</span>
            </div>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
