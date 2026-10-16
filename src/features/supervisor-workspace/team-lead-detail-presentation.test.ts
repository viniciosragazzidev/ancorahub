import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { buildTeamLeadLightDetail } from "./team-lead-detail-presentation";

describe("buildTeamLeadLightDetail", () => {
  it("reuses qualification facts while removing direct contact fields from the management payload", () => {
    const result = buildTeamLeadLightDetail({
      id: "lead-1",
      name: "Marina Alves",
      phone: "5511999999999",
      email: "marina@example.com",
      status: "in_contact",
      qualificationStatus: "hot",
      qualificationState: "QUALIFIED",
      qualificationDetails: {
        numberOfLives: "3",
        city: "São Paulo",
        urgenciaContratacao: "30 dias",
        resumoAtendimento: "Procura cobertura familiar.",
        email: "resposta@example.com",
      },
      formData: { razaoSocial: "Empresa da Marina", funcionarios: "12" },
      consentimentoLgpd: true,
      tipo: "PF",
      origem: "whatsapp",
      sourceCampaign: null,
      sourceChannel: null,
      sourceMetadata: null,
      createdAt: new Date("2026-10-15T12:00:00Z"),
      assignedAt: new Date("2026-10-15T12:10:00Z"),
      ownerId: "broker-1",
      ownerName: "Paulo Dias",
      ownerImage: null,
      branchName: "Central",
      planName: "Plano familiar",
    }, [{ id: "beneficiary-1", name: "Marina Alves", birthDate: "1980-01-01", relationship: "titular", isHolder: true }]);

    expect(result).toMatchObject({
      telefone: null,
      email: null,
      qualificationStatus: "hot",
      summary: "Procura cobertura familiar.",
      livesCount: 3,
      city: "São Paulo",
      planName: "Plano familiar",
      isCurrentBroker: false,
      beneficiaries: [{ name: "Marina Alves", isHolder: true }],
    });
    expect(result.clientInfo?.some((item) => /e-?mail|telefone|phone|whats/i.test(`${item.key} ${item.label}`))).toBe(false);
    expect(result.clientInfo?.some((item) => item.value.includes("example.com"))).toBe(false);
  });
});
