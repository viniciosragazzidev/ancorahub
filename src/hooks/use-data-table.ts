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
  useQueryStates,
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
  /** Use replace for high-frequency operational tables to avoid history churn. */
  queryHistory?: "push" | "replace";
}

export function useDataTable<TData>({
  columns,
  data,
  pageCount,
  queryHistory = "push",
  initialState,
  ...props
}: UseDataTableProps<TData>) {
  const [isPending, startTransition] = React.useTransition();
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>(
    initialState?.rowSelection ?? {}
  );
  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>(initialState?.columnVisibility ?? {});

  // Pagination values always change together from TanStack's perspective.
  // Keep them in one nuqs state so a page click produces a single URL update
  // and, consequently, a single RSC request. Two independent setters here
  // used to race and make /leads appear stuck in its loading state.
  const [{ page, pageSize }, setPaginationQuery] = useQueryStates(
    {
      page: parseAsInteger.withDefault(1),
      pageSize: parseAsInteger.withDefault(20),
    },
    { history: queryHistory, shallow: false, startTransition },
  );

  const [sorting, setSorting] = useQueryState(
    "sort",
    getSortingStateParser<TData>()
      .withOptions({ history: queryHistory, shallow: false, startTransition })
      .withDefault([])
  );

  const [filters, setFilters] = useQueryState(
    "filters",
    getFiltersStateParser<TData>()
      .withOptions({ history: queryHistory, shallow: false, startTransition })
      .withDefault([])
  );

  const [joinOperator, setJoinOperator] = useQueryState(
    "joinOperator",
    parseAsStringEnum([...dataTableConfig.joinOperators])
      .withOptions({ history: queryHistory, shallow: false, startTransition })
      .withDefault("and")
  );

  // nuqs with shallow:false already triggers server rendering via router.push().
  // An explicit router.refresh() after that causes a redundant second full
  // server render (all DB queries re-execute). We only wait for the URL
  // params to commit; the Next.js router handles the rest.
  const refreshAfterUrlCommit = React.useCallback(
    (updates: Partial<{ page: number; pageSize: number }>) => {
      void setPaginationQuery(updates).catch(() => undefined);
    },
    [setPaginationQuery],
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
        refreshAfterUrlCommit({
          page: newPagination.pageIndex + 1,
          pageSize: newPagination.pageSize,
        });
      } else {
        refreshAfterUrlCommit({
          page: updaterOrValue.pageIndex + 1,
          pageSize: updaterOrValue.pageSize,
        });
      }
    },
    [pagination, refreshAfterUrlCommit]
  );

  const onSortingChange = React.useCallback(
    (updaterOrValue: SortingState | ((old: SortingState) => SortingState)) => {
      if (typeof updaterOrValue === "function") {
        const newSorting = updaterOrValue(sorting as SortingState) as ExtendedColumnSort<TData>[];
        void setPaginationQuery({ page: 1 }).catch(() => undefined);
        void setSorting(newSorting).catch(() => undefined);
      } else {
        void setPaginationQuery({ page: 1 }).catch(() => undefined);
        void setSorting(updaterOrValue as ExtendedColumnSort<TData>[]).catch(() => undefined);
      }
    },
    [setPaginationQuery, setSorting, sorting]
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
