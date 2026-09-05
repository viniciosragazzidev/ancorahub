"use client";

import * as React from "react";
import { flexRender, type Table as TanstackTable } from "@tanstack/react-table";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DataTablePagination } from "@/components/data-table/data-table-pagination";
import { getCommonPinningStyles } from "@/lib/data-table";
import { cn } from "@/lib/utils";

interface DataTableProps<TData> extends React.HTMLAttributes<HTMLDivElement> {
  table: TanstackTable<TData>;
  actionBar?: React.ReactNode;
  children?: React.ReactNode;
  containerClassName?: string;
  headerClassName?: string;
  isPending?: boolean;
}

export function DataTable<TData>({
  table,
  actionBar,
  children,
  className,
  containerClassName,
  headerClassName,
  isPending = false,
  ...props
}: DataTableProps<TData>) {
  return (
    <div data-slot="data-table" className={cn("w-full space-y-3", className)} {...props}>
      {children}
      <div data-slot="data-table-surface" className={cn("relative overflow-hidden rounded-2xl border-0 bg-card/40 dark:bg-card/60", containerClassName)}>
        {isPending && (
          <div className="absolute top-0 left-0 right-0 z-20 h-0.5 overflow-hidden bg-primary/20">
            <div className="h-full w-full animate-pulse bg-primary" />
          </div>
        )}
        <div className="overflow-x-auto">
          <Table className="w-full text-xs">
            <TableHeader className={cn("border-b border-border/30 bg-muted/10", headerClassName)}>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id} className="border-border/30 hover:bg-transparent">
                  {headerGroup.headers.map((header) => {
                    return (
                      <TableHead
                        key={header.id}
                        colSpan={header.colSpan}
                        style={{
                          ...getCommonPinningStyles({ column: header.column }),
                        }}
                        className="h-9 px-3 py-2 text-left align-middle text-xs font-semibold text-muted-foreground select-none tracking-tight"
                      >
                        {header.isPlaceholder
                          ? null
                          : flexRender(
                              header.column.columnDef.header,
                              header.getContext()
                            )}
                      </TableHead>
                    );
                  })}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody className={cn("transition-opacity duration-200", isPending && "opacity-50 pointer-events-none")}>
              {table.getRowModel().rows?.length ? (
                table.getRowModel().rows.map((row) => (
                  <TableRow
                    key={row.id}
                    data-state={row.getIsSelected() && "selected"}
                    className="cursor-pointer border-b border-border/30 transition-colors hover:bg-muted/30 dark:hover:bg-muted/30"
                    onClick={() => {
                      table.options.meta?.onRowClick?.(row.original);
                    }}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell
                        key={cell.id}
                        style={{
                          ...getCommonPinningStyles({ column: cell.column }),
                        }}
                        className="px-3 py-2.5 text-xs text-foreground align-middle"
                        onClick={(e) => {
                          // Prevent triggering row click when clicking on checkboxes or action buttons
                          if ((e.target as HTMLElement).closest("button, input, [role='checkbox']")) {
                            e.stopPropagation();
                          }
                        }}
                      >
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext()
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={table.getAllColumns().length}
                    className="h-24 text-center text-xs text-muted-foreground"
                  >
                    Nenhum resultado encontrado.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        <DataTablePagination table={table} isPending={isPending} />
      </div>
      {actionBar}
    </div>
  );
}
