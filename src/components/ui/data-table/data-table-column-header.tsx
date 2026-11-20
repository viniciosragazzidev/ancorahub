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
  /** Ícone de 14px antes do título (skill `interface-enxuta`). */
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
      <div className={cn("flex items-center text-[11px] font-medium text-muted-foreground", className)}>
        <HeaderIcon icon={icon} />
        {title}
      </div>
    );
  }

  return (
    <div className={cn("flex items-center space-x-1.5", className)}>
      <DropdownMenu>
        {/* render= makes the Button the trigger itself (no <button> inside <button>). */}
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="sm"
              className="-ml-2 h-7 px-2 text-[11px] font-medium text-muted-foreground hover:text-foreground data-[popup-open]:bg-accent"
            />
          }
        >
          <HeaderIcon icon={icon} />
          <span>{title}</span>
          {column.getIsSorted() === "desc" ? (
            <ArrowDown className="ml-1.5 size-3" />
          ) : column.getIsSorted() === "asc" ? (
            <ArrowUp className="ml-1.5 size-3" />
          ) : (
            <ChevronsUpDown className="ml-1.5 size-3 opacity-50" />
          )}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-40">
          <DropdownMenuItem onClick={() => column.toggleSorting(false)}>
            <ArrowUp className="mr-2 size-3 text-muted-foreground/70" />
            Ascendente
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => column.toggleSorting(true)}>
            <ArrowDown className="mr-2 size-3 text-muted-foreground/70" />
            Descendente
          </DropdownMenuItem>
          {column.getCanHide() && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => column.toggleVisibility(false)}>
                <EyeOff className="mr-2 size-3 text-muted-foreground/70" />
                Ocultar coluna
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
