import { describe, expect, it } from "vitest";

import { decidirCorretorNaMudancaDeEtapa } from "./qualification-stage-rules";

describe("manual qualification stage change and the broker who holds the lead", () => {
  it("keeps the broker who already accepted when no broker is chosen (incident 05/11)", () => {
    expect(decidirCorretorNaMudancaDeEtapa({ targetStage: "qualificado", corretorAtual: "anderson", brokerEscolhido: null })).toEqual({ tipo: "manter" });
    expect(decidirCorretorNaMudancaDeEtapa({ targetStage: "humano", corretorAtual: "anderson", brokerEscolhido: "anderson" })).toEqual({ tipo: "manter" });
  });

  it("reassigns only when another broker is chosen on purpose", () => {
    expect(decidirCorretorNaMudancaDeEtapa({ targetStage: "qualificado", corretorAtual: "anderson", brokerEscolhido: "bruna" })).toEqual({ tipo: "seguir" });
  });

  it("blocks sending a lead with a broker back to qualification", () => {
    expect(decidirCorretorNaMudancaDeEtapa({ targetStage: "qualificacoes", corretorAtual: "anderson", brokerEscolhido: null }).tipo).toBe("bloquear");
  });

  it("changes nothing for a lead without a broker", () => {
    expect(decidirCorretorNaMudancaDeEtapa({ targetStage: "qualificado", corretorAtual: null, brokerEscolhido: null })).toEqual({ tipo: "seguir" });
    expect(decidirCorretorNaMudancaDeEtapa({ targetStage: "qualificacoes", corretorAtual: null, brokerEscolhido: null })).toEqual({ tipo: "seguir" });
  });
});
