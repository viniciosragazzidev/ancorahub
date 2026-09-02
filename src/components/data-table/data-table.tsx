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
  isPending?: boolean;
}

export function DataTable<TData>({
  table,
  actionBar,
  children,
  className,
  containerClassName,
  isPending = false,
  ...props
}: DataTableProps<TData>) {
  return (
    <div className={cn("w-full space-y-3", className)} {...props}>
      {children}
      <div className={cn("relative rounded-xl border border-border/60 overflow-hidden bg-background/40 backdrop-blur-xs shadow-2xs", containerClassName)}>
        <div className="overflow-x-auto">
          <Table className="w-full text-xs">
            <TableHeader className="bg-muted/50 dark:bg-muted/20 border-b border-border/60">
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id} className="hover:bg-transparent border-border/60">
                  {headerGroup.headers.map((header) => {
                    return (
                      <TableHead
                        key={header.id}
                        colSpan={header.colSpan}
                        style={{
                          ...getCommonPinningStyles({ column: header.column }),
                        }}
                        className="h-9 px-3 py-2 text-left align-middle text-xs font-bold text-muted-foreground select-none tracking-tight"
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
            <TableBody>
              {table.getRowModel().rows?.length ? (
                table.getRowModel().rows.map((row) => (
                  <TableRow
                    key={row.id}
                    data-state={row.getIsSelected() && "selected"}
                    className="hover:bg-muted/40 dark:hover:bg-muted/20 transition-all border-b border-border/40 cursor-pointer"
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
