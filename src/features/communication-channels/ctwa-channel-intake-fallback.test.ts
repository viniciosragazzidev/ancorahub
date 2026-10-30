import { describe, expect, it } from "vitest";

import { shouldUseChannelIntakeForCtwa } from "./ctwa-channel-intake-fallback";

const base = { decisionAction: "ignore" as const, globalMode: "all", campaignRoute: undefined, channelIntakeEnabled: true };

describe("anúncio (CTWA) cai na fila do número quando a campanha não tem regra usável", () => {
  it("campanha sem regra e sem conta com fila padrão (caso 3232, 30/10): vira lead na fila do número", () => {
    expect(shouldUseChannelIntakeForCtwa(base)).toBe(true);
  });

  it("regra ou padrão da conta com fila ativa manda (a política já captura)", () => {
    expect(shouldUseChannelIntakeForCtwa({ ...base, decisionAction: "capture", campaignRoute: { enabled: true, queueStatus: "active" } })).toBe(false);
  });

  it("padrão da conta com a fila inativa: cai na fila do número em vez de perder o lead", () => {
    expect(shouldUseChannelIntakeForCtwa({ ...base, campaignRoute: { enabled: true, queueStatus: "inactive" } })).toBe(true);
    expect(shouldUseChannelIntakeForCtwa({ ...base, campaignRoute: { enabled: true, queueStatus: null } })).toBe(true);
  });

  it("regra desligada de propósito continua ignorando", () => {
    expect(shouldUseChannelIntakeForCtwa({ ...base, campaignRoute: { enabled: false, queueStatus: "active" } })).toBe(false);
  });

  it("captura desligada no tenant ou entrada do número desligada: não cria", () => {
    expect(shouldUseChannelIntakeForCtwa({ ...base, globalMode: "disabled" })).toBe(false);
    expect(shouldUseChannelIntakeForCtwa({ ...base, channelIntakeEnabled: false })).toBe(false);
  });
});
