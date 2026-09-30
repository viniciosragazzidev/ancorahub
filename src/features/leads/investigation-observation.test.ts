import { describe, expect, it } from "vitest";

import { extractInvestigationReason } from "./investigation-observation";

describe("investigation observation", () => {
  it("extracts the reason recorded by a manager or director", () => {
    expect(extractInvestigationReason("Lead assumido para investigação por Diretor. Motivo: Conferir a origem do cadastro"))
      .toBe("Conferir a origem do cadastro");
    expect(extractInvestigationReason("Lead assumido para investigação por Gestor. Motivo: Revisar a campanha"))
      .toBe("Revisar a campanha");
  });

  it("does not expose unrelated interactions as an investigation reason", () => {
    expect(extractInvestigationReason("Lead reatribuído manualmente." )).toBeNull();
    expect(extractInvestigationReason("Lead assumido para investigação por Gestor. Motivo:   ")).toBeNull();
  });
});
