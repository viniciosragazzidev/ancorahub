import { afterEach, describe, expect, it, vi } from "vitest";

import {
  isPerfDiagnosticsEnabled,
  recordIssuedDatabaseQuery,
  withPerfSpan,
  withRequestTiming,
} from "./request-timing";

describe("request performance diagnostics", () => {
  const originalFlag = process.env.PERF_DIAGNOSTICS;
  const originalRate = process.env.PERF_DIAGNOSTICS_SAMPLE_RATE;

  afterEach(() => {
    process.env.PERF_DIAGNOSTICS = originalFlag;
    process.env.PERF_DIAGNOSTICS_SAMPLE_RATE = originalRate;
    vi.restoreAllMocks();
  });

  it("does not emit anything while diagnostics are disabled", async () => {
    delete process.env.PERF_DIAGNOSTICS;
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);

    await withRequestTiming("/leads", async () => withPerfSpan("leads.list", async () => "ok"));

    expect(isPerfDiagnosticsEnabled()).toBe(false);
    expect(info).not.toHaveBeenCalled();
  });

  it("emits safe spans and only query counts/shapes", async () => {
    process.env.PERF_DIAGNOSTICS = "true";
    process.env.PERF_DIAGNOSTICS_SAMPLE_RATE = "1";
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);

    await withRequestTiming("/leads", async () => {
      recordIssuedDatabaseQuery("select * from leads where phone = $1");
      await withPerfSpan("leads.list", async () => undefined);
    }, "request-test");

    const entries = info.mock.calls.map(([message]) => JSON.parse(String(message)));
    expect(entries).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: "perf_span", requestId: "request-test", route: "/leads", span: "leads.list" }),
      expect.objectContaining({ type: "perf_span", requestId: "request-test", route: "/leads", span: "request.total", dbQueryCount: 1, dbQueryShapes: 1 }),
    ]));
    expect(JSON.stringify(entries)).not.toContain("phone =");
  });
});
