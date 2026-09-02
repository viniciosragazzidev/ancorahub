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
  const [isPending, startTransition] = React.useTransition();
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>(
    initialState?.rowSelection ?? {}
  );
  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>(initialState?.columnVisibility ?? {});

  const [page, setPage] = useQueryState(
    "page",
    parseAsInteger.withOptions({ history: "push", shallow: false, startTransition }).withDefault(1)
  );
  const [pageSize, setPageSize] = useQueryState(
    "pageSize",
    parseAsInteger.withOptions({ history: "push", shallow: false, startTransition }).withDefault(20)
  );

  const [sorting, setSorting] = useQueryState(
    "sort",
    getSortingStateParser<TData>()
      .withOptions({ history: "push", shallow: false, startTransition })
      .withDefault([])
  );

  const [filters, setFilters] = useQueryState(
    "filters",
    getFiltersStateParser<TData>()
      .withOptions({ history: "push", shallow: false, startTransition })
      .withDefault([])
  );

  const [joinOperator, setJoinOperator] = useQueryState(
    "joinOperator",
    parseAsStringEnum([...dataTableConfig.joinOperators])
      .withOptions({ history: "push", shallow: false, startTransition })
      .withDefault("and")
  );

  // nuqs with shallow:false already triggers server rendering via router.push().
  // An explicit router.refresh() after that causes a redundant second full
  // server render (all DB queries re-execute). We only wait for the URL
  // params to commit; the Next.js router handles the rest.
  const refreshAfterUrlCommit = React.useCallback(
    (updates: Array<Promise<URLSearchParams>>) => {
      void Promise.all(updates).catch(() => undefined);
    },
    []
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
        refreshAfterUrlCommit([
          setPage(newPagination.pageIndex + 1),
          setPageSize(newPagination.pageSize),
        ]);
      } else {
        refreshAfterUrlCommit([
          setPage(updaterOrValue.pageIndex + 1),
          setPageSize(updaterOrValue.pageSize),
        ]);
      }
    },
    [pagination, refreshAfterUrlCommit, setPage, setPageSize]
  );

  const onSortingChange = React.useCallback(
    (updaterOrValue: SortingState | ((old: SortingState) => SortingState)) => {
      if (typeof updaterOrValue === "function") {
        const newSorting = updaterOrValue(sorting as SortingState) as ExtendedColumnSort<TData>[];
        refreshAfterUrlCommit([setPage(1), setSorting(newSorting)]);
      } else {
        refreshAfterUrlCommit([setPage(1), setSorting(updaterOrValue as ExtendedColumnSort<TData>[])]);
      }
    },
    [refreshAfterUrlCommit, setPage, setSorting, sorting]
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
    isPending,
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
