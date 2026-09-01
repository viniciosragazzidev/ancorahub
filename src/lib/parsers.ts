import { dataTableConfig } from "@/config/data-table";
import type { ExtendedColumnFilter, ExtendedColumnSort } from "@/types/data-table";
import { createParser, parseAsJson } from "nuqs/server";
import { z } from "zod";

export const filterItemSchema = z.object({
  id: z.string(),
  value: z.union([z.string(), z.array(z.string()), z.number(), z.boolean()]),
  operator: z.enum(dataTableConfig.operators),
  rowId: z.string().optional(),
});

export type FilterItemSchema = z.infer<typeof filterItemSchema>;

export const filterItemParser = createParser({
  parse: (query: string) => {
    try {
      const parsed = JSON.parse(query);
      const result = z.array(filterItemSchema).safeParse(parsed);
      return result.success ? result.data : null;
    } catch {
      return null;
    }
  },
  serialize: (value) => JSON.stringify(value),
});

export const sortItemSchema = z.object({
  id: z.string(),
  desc: z.boolean(),
});

export const getSortingStateParser = <TData>() => {
  return parseAsJson<ExtendedColumnSort<TData>[]>((val) => {
    const res = z.array(sortItemSchema).safeParse(val);
    return res.success ? (res.data as ExtendedColumnSort<TData>[]) : [];
  }).withDefault([]);
};

export const getFiltersStateParser = <TData>() => {
  return parseAsJson<ExtendedColumnFilter<TData>[]>((val) => {
    const res = z.array(filterItemSchema).safeParse(val);
    return res.success ? (res.data as ExtendedColumnFilter<TData>[]) : [];
  }).withDefault([]);
};
