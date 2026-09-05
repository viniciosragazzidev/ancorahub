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
import {
  DataTableFrame,
  dataTableStyles,
} from "@/components/ui/data-table/data-table-frame";

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
      <DataTableFrame className={containerClassName}>
        {isPending && (
          <div className="absolute top-0 left-0 right-0 z-20 h-0.5 overflow-hidden bg-primary/20">
            <div className="h-full w-full animate-pulse bg-primary" />
          </div>
        )}
        <div className="overflow-x-auto">
          <Table className="w-full text-xs">
            <TableHeader className={cn(dataTableStyles.header, headerClassName)}>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id} className={dataTableStyles.headerRow}>
                  {headerGroup.headers.map((header) => {
                    return (
                      <TableHead
                        key={header.id}
                        colSpan={header.colSpan}
                        style={{
                          ...getCommonPinningStyles({ column: header.column }),
                        }}
                        className={cn(dataTableStyles.head, "select-none")}
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
            <TableBody className={cn(dataTableStyles.body, "transition-opacity duration-200", isPending && "opacity-50 pointer-events-none")}>
              {table.getRowModel().rows?.length ? (
                table.getRowModel().rows.map((row) => (
                  <TableRow
                    key={row.id}
                    data-state={row.getIsSelected() && "selected"}
                    className={cn(dataTableStyles.row, "cursor-pointer")}
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
                        className={cn(dataTableStyles.cell, "text-xs")}
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
      </DataTableFrame>
      {actionBar}
    </div>
  );
}
