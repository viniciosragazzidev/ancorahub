"use client";

import type { Column } from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ChevronsUpDown, EyeOff } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface DataTableColumnHeaderProps<TData, TValue>
  extends React.HTMLAttributes<HTMLDivElement> {
  column: Column<TData, TValue>;
  title: string;
  /** Ícone de 14px antes do título (skill `interface-enxuta`): ajuda a achar a coluna sem ler. */
  icon?: React.ReactNode;
}

function HeaderIcon({ icon }: { icon?: React.ReactNode }) {
  if (!icon) return null;
  return (
    <span aria-hidden className="mr-1.5 inline-flex shrink-0 text-ds-fog [&_svg]:size-3.5">
      {icon}
    </span>
  );
}

export function DataTableColumnHeader<TData, TValue>({
  column,
  title,
  icon,
  className,
}: DataTableColumnHeaderProps<TData, TValue>) {
  if (!column.getCanSort()) {
    return (
      <div className={cn("flex items-center text-xs font-semibold text-muted-foreground", className)}>
        <HeaderIcon icon={icon} />
        {title}
      </div>
    );
  }

  return (
    <div className={cn("flex items-center space-x-2", className)}>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="xs"
              className="-ml-3 h-8 text-xs font-semibold hover:bg-muted/50"
            >
              <HeaderIcon icon={icon} />
              <span>{title}</span>
              {column.getIsSorted() === "desc" ? (
                <ArrowDown className="ml-1.5 h-3.5 w-3.5 text-primary" />
              ) : column.getIsSorted() === "asc" ? (
                <ArrowUp className="ml-1.5 h-3.5 w-3.5 text-primary" />
              ) : (
                <ChevronsUpDown className="ml-1.5 h-3.5 w-3.5 opacity-50" />
              )}
            </Button>
          }
        />
        <DropdownMenuContent align="start" className="w-36">
          <DropdownMenuItem onClick={() => column.toggleSorting(false)}>
            <ArrowUp className="mr-2 h-3.5 w-3.5 text-muted-foreground/70" />
            Crescente
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => column.toggleSorting(true)}>
            <ArrowDown className="mr-2 h-3.5 w-3.5 text-muted-foreground/70" />
            Decrescente
          </DropdownMenuItem>
          {column.getCanHide() && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => column.toggleVisibility(false)}>
                <EyeOff className="mr-2 h-3.5 w-3.5 text-muted-foreground/70" />
                Ocultar
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
