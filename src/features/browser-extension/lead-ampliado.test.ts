import { describe, expect, it } from "vitest";
import { estadoDoResolve, leadAmpliadoDe } from "../../../apps/browser-extension/src/shared/lead-ampliado";
import { formatarValor, iniciais, rotuloTemperatura } from "../../../apps/browser-extension/src/panel/formatos";

// Payload no formato atual do resolve (lead-context.ts), com dados falsos.
const BASE = {
  id: "lead-falso-0001",
  version: 3,
  name: "Cliente Exemplo",
  phoneMasked: "(11) 9****-0000",
  currentStatus: { id: "in_contact", label: "Em atendimento" },
  unit: { id: "u1", name: "Unidade Centro (falsa)" },
  assignedUser: { id: "c1", name: "Corretor Exemplo" },
  nextAction: { id: "t1", title: "Enviar cotação", dueAt: "2026-11-03T15:00:00.000Z", status: "PENDING" },
};

describe("leadAmpliadoDe", () => {
  it("aceita o payload atual sem os campos novos", () => {
    const lead = leadAmpliadoDe(BASE);
    expect(lead?.name).toBe("Cliente Exemplo");
    expect(lead?.etapa).toBe("Em atendimento");
    expect(lead?.temperatura).toBeUndefined();
    expect(lead?.proximoPasso).toEqual({ titulo: "Enviar cotação", prazo: "2026-11-03T15:00:00.000Z" });
  });

  it("recusa payload sem identidade mínima", () => {
    expect(leadAmpliadoDe({ ...BASE, id: "" })).toBeNull();
    expect(leadAmpliadoDe({ ...BASE, version: "3" })).toBeNull();
    expect(leadAmpliadoDe({ ...BASE, name: "   " })).toBeNull();
  });

  it("ignora temperatura desconhecida e histórico malformado, e limita a cinco", () => {
    const lead = leadAmpliadoDe({
      ...BASE,
      temperatura: "pegando-fogo",
      historico: [
        { tipo: "ligação", data: "2026-11-03T13:00:00.000Z" },
        { tipo: "", data: "2026-11-03T13:00:00.000Z" },
        "lixo",
        { tipo: "mensagem", data: "2026-11-02T10:00:00.000Z" },
        { tipo: "nota", data: "2026-11-01T10:00:00.000Z" },
        { tipo: "tarefa", data: "2026-10-31T10:00:00.000Z" },
        { tipo: "ligação", data: "2026-10-30T10:00:00.000Z" },
        { tipo: "mensagem", data: "2026-10-29T10:00:00.000Z" },
      ],
    });
    expect(lead?.temperatura).toBeUndefined();
    expect(lead?.historico).toHaveLength(5);
    expect(lead?.historico?.every((item) => item.tipo.length > 0)).toBe(true);
  });

  it("lê os campos novos quando o servidor envia", () => {
    const lead = leadAmpliadoDe({ ...BASE, temperatura: "morno", plano: "Plano Falso Bronze", vidas: 2, valorMensal: 13.9, fila: "Fila teste", plantao: "Plantão falso", chegouEm: "2026-11-03T12:00:00.000Z" });
    expect(lead).toMatchObject({ temperatura: "morno", plano: "Plano Falso Bronze", vidas: 2, valorMensal: 13.9, fila: "Fila teste" });
  });
});

describe("estadoDoResolve", () => {
  it("mapeia os resultados do resolve para os estados da gaveta", () => {
    expect(estadoDoResolve({ status: "FOUND", lead: BASE })).toMatchObject({ tipo: "lead" });
    expect(estadoDoResolve({ status: "NOT_FOUND" })).toEqual({ tipo: "sem-lead" });
    expect(estadoDoResolve({ status: "FORBIDDEN" })).toEqual({ tipo: "sem-lead" });
    expect(estadoDoResolve({ status: "SESSION_EXPIRED" })).toEqual({ tipo: "sem-conexao" });
    expect(estadoDoResolve({ status: "OFFLINE" })).toEqual({ tipo: "erro" });
    expect(estadoDoResolve({ status: "NO_CONVERSATION" })).toBeNull();
  });
});

describe("formatos da gaveta", () => {
  it("formata valor em reais e traço quando falta", () => {
    expect(formatarValor(1234.5)).toBe("R$ 1.234,50");
    expect(formatarValor(undefined)).toBe("—");
  });

  it("rótulo de temperatura e iniciais", () => {
    expect(rotuloTemperatura(undefined)).toBe("Sem dados");
    expect(rotuloTemperatura("frio")).toBe("Frio");
    expect(iniciais("Cliente Exemplo da Silva")).toBe("CE");
    expect(iniciais("")).toBe("?");
  });
});
