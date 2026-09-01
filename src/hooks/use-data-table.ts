"use client";

import * as React from "react";
import {
  getCoreRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type PaginationState,
  type RowSelectionState,
  type SortingState,
  type TableOptions,
  type VisibilityState,
} from "@tanstack/react-table";
import {
  parseAsInteger,
  parseAsStringEnum,
  useQueryState,
} from "nuqs";

import { dataTableConfig } from "@/config/data-table";
import { getFiltersStateParser, getSortingStateParser } from "@/lib/parsers";
import type { ExtendedColumnSort } from "@/types/data-table";

export interface UseDataTableProps<TData>
  extends Omit<
    TableOptions<TData>,
    | "state"
    | "onPaginationChange"
    | "onSortingChange"
    | "onColumnFiltersChange"
    | "onColumnVisibilityChange"
    | "getCoreRowModel"
  > {
  columns: ColumnDef<TData, any>[];
  data: TData[];
  pageCount: number;
}

export function useDataTable<TData>({
  columns,
  data,
  pageCount,
  initialState,
  ...props
}: UseDataTableProps<TData>) {
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>(
    initialState?.rowSelection ?? {}
  );
  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>(initialState?.columnVisibility ?? {});

  const [page, setPage] = useQueryState(
    "page",
    parseAsInteger.withOptions({ history: "push", shallow: false }).withDefault(1)
  );
  const [pageSize, setPageSize] = useQueryState(
    "pageSize",
    parseAsInteger.withOptions({ history: "push", shallow: false }).withDefault(10)
  );

  const [sorting, setSorting] = useQueryState(
    "sort",
    getSortingStateParser<TData>()
      .withOptions({ history: "push", shallow: false })
      .withDefault([])
  );

  const [filters, setFilters] = useQueryState(
    "filters",
    getFiltersStateParser<TData>()
      .withOptions({ history: "push", shallow: false })
      .withDefault([])
  );

  const [joinOperator, setJoinOperator] = useQueryState(
    "joinOperator",
    parseAsStringEnum([...dataTableConfig.joinOperators])
      .withOptions({ history: "push", shallow: false })
      .withDefault("and")
  );

  const pagination: PaginationState = React.useMemo(
    () => ({
      pageIndex: page - 1,
      pageSize,
    }),
    [page, pageSize]
  );

  const onPaginationChange = React.useCallback(
    (updaterOrValue: PaginationState | ((old: PaginationState) => PaginationState)) => {
      if (typeof updaterOrValue === "function") {
        const newPagination = updaterOrValue(pagination);
        void setPage(newPagination.pageIndex + 1);
        void setPageSize(newPagination.pageSize);
      } else {
        void setPage(updaterOrValue.pageIndex + 1);
        void setPageSize(updaterOrValue.pageSize);
      }
    },
    [pagination, setPage, setPageSize]
  );

  const onSortingChange = React.useCallback(
    (updaterOrValue: SortingState | ((old: SortingState) => SortingState)) => {
      if (typeof updaterOrValue === "function") {
        const newSorting = updaterOrValue(sorting as SortingState) as ExtendedColumnSort<TData>[];
        void setSorting(newSorting);
      } else {
        void setSorting(updaterOrValue as ExtendedColumnSort<TData>[]);
      }
    },
    [sorting, setSorting]
  );

  const table = useReactTable({
    ...props,
    data,
    columns,
    pageCount: pageCount ?? -1,
    state: {
      pagination,
      sorting: sorting as SortingState,
      rowSelection,
      columnVisibility,
    },
    enableRowSelection: true,
    onRowSelectionChange: setRowSelection,
    onPaginationChange,
    onSortingChange,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    manualPagination: true,
    manualSorting: true,
    manualFiltering: true,
  });

  return {
    table,
    page,
    pageSize,
    sorting,
    setSorting,
    filters,
    setFilters,
    joinOperator,
    setJoinOperator,
  };
}
