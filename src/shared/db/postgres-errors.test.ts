import { describe, expect, it } from "vitest";

import { isUndefinedFunctionError, isUndefinedTableError, postgresErrorCode } from "./postgres-errors";

describe("postgresErrorCode", () => {
  it("reads the code from the error itself", () => {
    expect(postgresErrorCode({ code: "42P01" })).toBe("42P01");
  });

  it("looks through the wrappers drizzle puts around the driver error", () => {
    const driver = Object.assign(new Error('relation "x" does not exist'), { code: "42P01" });
    const wrapped = new Error("Failed query", { cause: new Error("query failed", { cause: driver }) });
    expect(postgresErrorCode(wrapped)).toBe("42P01");
  });

  it("ignores codes that are not a SQLSTATE and errors without one", () => {
    expect(postgresErrorCode({ code: "ECONNRESET" })).toBeUndefined();
    expect(postgresErrorCode(new Error("boom"))).toBeUndefined();
    expect(postgresErrorCode(null)).toBeUndefined();
    expect(postgresErrorCode("texto")).toBeUndefined();
  });

  it("stops on a cause loop instead of hanging", () => {
    const loop: { cause?: unknown } = {};
    loop.cause = loop;
    expect(postgresErrorCode(loop)).toBeUndefined();
  });
});

describe("migration-not-applied checks", () => {
  it("tells a missing table from a missing function", () => {
    expect(isUndefinedTableError({ code: "42P01" })).toBe(true);
    expect(isUndefinedTableError({ code: "42883" })).toBe(false);
    expect(isUndefinedFunctionError({ cause: { code: "42883" } })).toBe(true);
    expect(isUndefinedFunctionError({ code: "42P01" })).toBe(false);
  });
});
