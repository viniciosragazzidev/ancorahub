import { describe, expect, it } from "vitest";

import { canViewDistributionQueues } from "./director-distribution-tabs";

describe("acesso às filas da distribuição", () => {
  it("mantém as permissões atuais das filas por papel", () => {
    expect(canViewDistributionQueues("director")).toBe(true);
    expect(canViewDistributionQueues("manager")).toBe(false);
    expect(canViewDistributionQueues("supervisor")).toBe(false);
    expect(canViewDistributionQueues("broker")).toBe(false);
  });
});
