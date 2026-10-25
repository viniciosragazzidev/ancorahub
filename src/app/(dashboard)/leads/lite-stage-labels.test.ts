import { describe, expect, it } from "vitest";

import { LEAD_STATUS_LABELS } from "@/features/leads/lead-status-constants";

import { liteStageLabel } from "./lite-stage-labels";

describe("rótulos de etapa do Lite", () => {
  it("usa sentence case sem mexer no mapa do resto do app", () => {
    expect(liteStageLabel("in_contact")).toBe("Em atendimento");
    expect(liteStageLabel("quote_sent")).toBe("Cotação enviada");
    expect(liteStageLabel("documentation_pending")).toBe("Documentação pendente");
    expect(LEAD_STATUS_LABELS.in_contact).toBe("Em Atendimento");
  });

  it("cobre todas as etapas do mapa atual e devolve o código para etapa desconhecida", () => {
    for (const status of Object.keys(LEAD_STATUS_LABELS)) {
      const label = liteStageLabel(status);
      expect(label).not.toBe(status);
      expect(label.slice(1)).toBe(label.slice(1).toLowerCase());
    }
    expect(liteStageLabel("x")).toBe("x");
  });
});
