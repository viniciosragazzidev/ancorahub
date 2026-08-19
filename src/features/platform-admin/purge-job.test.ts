import { describe, expect, it } from "vitest";

import { affectedRows, resultRows } from "./purge-job";

describe("purge-job driver result normalization", () => {
  it("reads affected rows from postgres.js RowList (.count)", () => {
    const rowList = Object.assign([{ id: "a" }, { id: "b" }, { id: "c" }], { count: 3 });
    expect(affectedRows(rowList)).toBe(3);
  });

  it("reads affected rows from node-postgres/neon results (.rowCount)", () => {
    expect(affectedRows({ rowCount: 7, rows: [] })).toBe(7);
  });

  it("defaults to 0 when no count is present", () => {
    expect(affectedRows(undefined)).toBe(0);
    expect(affectedRows({})).toBe(0);
    expect(affectedRows(Object.assign([], { count: 0 }))).toBe(0);
  });

  it("reads rows from postgres.js array results directly", () => {
    const rowList = Object.assign([{ id: "lead-1" }, { id: "lead-2" }], { count: 2 });
    expect(resultRows<{ id: string }>(rowList).map((r) => r.id)).toEqual(["lead-1", "lead-2"]);
  });

  it("reads rows from node-postgres/neon { rows } results", () => {
    expect(resultRows<{ id: string }>({ rows: [{ id: "lead-1" }] })).toEqual([{ id: "lead-1" }]);
  });

  it("returns empty array for unknown shapes instead of crashing", () => {
    expect(resultRows(undefined)).toEqual([]);
    expect(resultRows(null)).toEqual([]);
  });
});
