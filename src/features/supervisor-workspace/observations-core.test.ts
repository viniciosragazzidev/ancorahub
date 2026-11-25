import { describe, expect, it } from "vitest";

import { isSupervisorObservationInScope, isSupervisorTeamBrokerObservation, readSupervisorObservation, readSupervisorObservationStage } from "./observations-core";

const scope = { role: "supervisor", tenantId: "tenant-a", branchId: "unit-a", supervisorId: "sup-a", teamBrokerIds: ["broker-a", "broker-b"] };

describe("observações da equipe do supervisor", () => {
  it("mantém somente lead e autor da equipe, no mesmo tenant e unidade", () => {
    const base = { tenantId: "tenant-a", branchId: "unit-a", leadOwnerId: "broker-a", authorId: "broker-b" };
    expect(isSupervisorObservationInScope(scope, base)).toBe(true);
    expect(isSupervisorObservationInScope(scope, { ...base, tenantId: "tenant-b" })).toBe(false);
    expect(isSupervisorObservationInScope(scope, { ...base, branchId: "unit-b" })).toBe(false);
    expect(isSupervisorObservationInScope(scope, { ...base, leadOwnerId: "other-broker" })).toBe(false);
    expect(isSupervisorObservationInScope(scope, { ...base, authorId: "other-broker" })).toBe(false);
    expect(isSupervisorObservationInScope({ ...scope, branchId: null }, base)).toBe(false);
  });

  it("retorna o texto completo do campo e recupera observações antigas da timeline", () => {
    const longText = "Cliente pediu retorno após conversar com a família. ".repeat(20).trim();
    expect(readSupervisorObservation({ observation: longText }, "texto legado")).toBe(longText);
    expect(readSupervisorObservation(null, "Contato registrado. Como foi o contato: Ligou e pediu retorno amanhã.")).toBe("Ligou e pediu retorno amanhã.");
    expect(readSupervisorObservation({}, "Mudou a etapa sem observação.")).toBeNull();
  });
  it("allows supervisor detail notes from active brokers in the current team only", () => {
    expect(isSupervisorTeamBrokerObservation({ actorRole: "broker", isCurrentTeamMember: true })).toBe(true);
    expect(isSupervisorTeamBrokerObservation({ actorRole: "broker", isCurrentTeamMember: false })).toBe(false);
    expect(isSupervisorTeamBrokerObservation({ actorRole: "manager", isCurrentTeamMember: true })).toBe(false);
  });

  it("reads the stage from metadata and legacy timeline text", () => {
    expect(readSupervisorObservationStage({ toStatus: "contacted" }, "legacy")).toBe("contacted");
    expect(readSupervisorObservationStage({}, "Status alterado: Em Atendimento → Entrei em Contato. Como foi o contato: Liguei." )).toBe("contacted");
    expect(readSupervisorObservationStage(null, "Novo contato registrado. Como foi o contato: Retornou." )).toBe("contacted");
    expect(readSupervisorObservationStage(null, "Texto sem etapa" )).toBeNull();
  });
});
