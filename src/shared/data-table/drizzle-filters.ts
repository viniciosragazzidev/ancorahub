import type { SQL } from "drizzle-orm";
import {
  and,
  eq,
  gt,
  gte,
  ilike,
  inArray,
  isNotNull,
  isNull,
  lt,
  lte,
  ne,
  notInArray,
  or,
  sql,
} from "drizzle-orm";

import type {
  ExtendedColumnFilter,
  ExtendedColumnSort,
  JoinOperator,
} from "@/types/data-table";

export type ColumnMapEntry<TData> = {
  column: any;
  transform?: (value: any) => unknown;
};

export type ColumnMap<TData> = Record<string, ColumnMapEntry<TData>>;

/**
 * Convert a tablecn ExtendedColumnFilter[] + column mapping + join operator
 * into a Drizzle SQL condition. Returns undefined when no filters apply.
 */
export function buildDrizzleFilter<TData>(
  filters: ExtendedColumnFilter<TData>[],
  columnMap: ColumnMap<TData>,
  joinOperator: JoinOperator = "and",
): SQL | undefined {
  const conditions: SQL[] = [];

  for (const filter of filters) {
    const entry = columnMap[filter.id];
    if (!entry) continue;

    const col = entry.column;
    const transform = entry.transform;
    const value = transform ? transform(filter.value) : filter.value;

    switch (filter.operator) {
      case "iLike":
        conditions.push(ilike(col, `%${value}%`));
        break;
      case "notILike":
        conditions.push(sql`${col} NOT ILIKE ${"%" + value + "%"}`);
        break;
      case "eq":
        conditions.push(eq(col, value as any));
        break;
      case "ne":
        conditions.push(ne(col, value as any));
        break;
      case "inArray":
        conditions.push(
          inArray(col, Array.isArray(value) ? value : [value]),
        );
        break;
      case "notInArray":
        conditions.push(
          notInArray(col, Array.isArray(value) ? value : [value]),
        );
        break;
      case "isEmpty":
        conditions.push(or(isNull(col), eq(col, ""))!);
        break;
      case "isNotEmpty":
        conditions.push(and(isNotNull(col), sql`${col} != ''`)!);
        break;
      case "lt":
        conditions.push(lt(col, value as any));
        break;
      case "lte":
        conditions.push(lte(col, value as any));
        break;
      case "gt":
        conditions.push(gt(col, value as any));
        break;
      case "gte":
        conditions.push(gte(col, value as any));
        break;
      case "isBetween": {
        const [min, max] = (typeof value === "string" ? value : "").split(",");
        if (min) conditions.push(gte(col, transform ? transform(min) : min));
        if (max) conditions.push(lte(col, transform ? transform(max) : max));
        break;
      }
      case "isRelativeToToday":
        conditions.push(
          sql`${col} >= now() - interval '1 day' * ${Number(value) || 0}`,
        );
        break;
    }
  }

  if (conditions.length === 0) return undefined;

  return joinOperator === "or" ? or(...conditions) : and(...conditions);
}

export type SortMapEntry<TData> = {
  column: any;
};

export type SortMap<TData> = Record<string, SortMapEntry<TData>>;

export function buildDrizzleOrderBy<TData>(
  sorting: ExtendedColumnSort<TData>[],
  sortMap: SortMap<TData>,
): SQL[] {
  return sorting
    .map((sort) => {
      const entry = sortMap[sort.id];
      if (!entry) return null;
      return sort.desc
        ? sql`${entry.column} DESC`
        : sql`${entry.column} ASC`;
    })
    .filter(Boolean) as SQL[];
}
