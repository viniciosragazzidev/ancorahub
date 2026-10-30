import { describe, expect, it } from "vitest";

import { shouldUseChannelIntakeForCtwa } from "./ctwa-channel-intake-fallback";

const base = { decisionAction: "ignore" as const, globalMode: "selective", hasCampaignRule: false, channelIntakeEnabled: true };

describe("anúncio (CTWA) cai na fila do número quando a campanha não tem regra", () => {
  it("campanha identificada sem regra, entrada do número ligada: vira lead na fila do número", () => {
    expect(shouldUseChannelIntakeForCtwa(base)).toBe(true);
  });

  it("campanha com regra (mesmo desligada) manda na rota", () => {
    expect(shouldUseChannelIntakeForCtwa({ ...base, hasCampaignRule: true })).toBe(false);
  });

  it("captura desligada no tenant ou entrada do número desligada: não cria", () => {
    expect(shouldUseChannelIntakeForCtwa({ ...base, globalMode: "disabled" })).toBe(false);
    expect(shouldUseChannelIntakeForCtwa({ ...base, channelIntakeEnabled: false })).toBe(false);
  });

  it("política já captura: não troca a fila", () => {
    expect(shouldUseChannelIntakeForCtwa({ ...base, decisionAction: "capture" })).toBe(false);
  });
});
