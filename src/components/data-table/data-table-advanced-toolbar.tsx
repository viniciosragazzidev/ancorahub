"use client";

import type { Table } from "@tanstack/react-table";

import { DataTableToolbar } from "@/components/data-table/data-table-toolbar";

interface DataTableAdvancedToolbarProps<TData> {
  table: Table<TData>;
  children?: React.ReactNode;
}

export function DataTableAdvancedToolbar<TData>({
  table,
  children,
}: DataTableAdvancedToolbarProps<TData>) {
  return (
    <DataTableToolbar table={table}>
      {children}
    </DataTableToolbar>
  );
}
