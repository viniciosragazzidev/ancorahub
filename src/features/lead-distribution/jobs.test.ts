import { describe, expect, it } from "vitest";

import { distributionRetryDelayMilliseconds, isDeferredDistributionReason } from "./domain";

describe("lead distribution jobs", () => {
  it("retries transient failures with bounded exponential backoff", () => {
    expect(distributionRetryDelayMilliseconds(1, 60)).toBe(60_000);
    expect(distributionRetryDelayMilliseconds(3, 60)).toBe(240_000);
    expect(distributionRetryDelayMilliseconds(20, 60)).toBe(30 * 60_000);
  });

  it("keeps operational waits recoverable instead of consuming attempts", () => {
    expect(isDeferredDistributionReason("Nenhum corretor elegível nesta unidade.")).toBe(true);
    expect(isDeferredDistributionReason("A fila está em modo manual.")).toBe(true);
    expect(isDeferredDistributionReason("Falha de conexão inesperada.")).toBe(false);
  });
});
