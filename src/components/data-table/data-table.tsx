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
}

export function DataTable<TData>({
  table,
  actionBar,
  children,
  className,
  ...props
}: DataTableProps<TData>) {
  return (
    <div className={cn("w-full space-y-3", className)} {...props}>
      {children}
      <div className="relative rounded-md border border-border/60 bg-card overflow-hidden shadow-xs dark:bg-card/90">
        <div className="overflow-x-auto">
          <Table className="w-full text-xs">
            <TableHeader className="bg-muted/40 dark:bg-muted/20 border-b border-border/60">
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
                        className="h-9 px-3 py-2 text-left align-middle text-xs font-semibold text-muted-foreground select-none"
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
                    className="hover:bg-muted/30 dark:hover:bg-muted/15 transition-colors border-b border-border/40 cursor-pointer"
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
        <DataTablePagination table={table} />
      </div>
      {actionBar}
    </div>
  );
}
