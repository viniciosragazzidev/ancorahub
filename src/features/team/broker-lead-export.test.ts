import { describe, expect, it } from "vitest";

import {
  BROKER_LEAD_EXPORT_COLUMNS,
  buildBrokerLeadExportRow,
  buildBrokerLeadExportScope,
  canExportBrokerLeadsByPermission,
  canExportBrokerMember,
} from "./broker-lead-export";

describe("exportação da carteira atual do corretor", () => {
  it("exige diretor/gestor e ao menos uma das permissões efetivas", () => {
    expect(canExportBrokerLeadsByPermission({ role: "director", canExportOperationalReports: true, canAccessLeads: false })).toBe(true);
    expect(canExportBrokerLeadsByPermission({ role: "manager", canExportOperationalReports: false, canAccessLeads: true })).toBe(true);
    expect(canExportBrokerLeadsByPermission({ role: "manager", canExportOperationalReports: false, canAccessLeads: false })).toBe(false);
    expect(canExportBrokerLeadsByPermission({ role: "supervisor", canExportOperationalReports: true, canAccessLeads: true })).toBe(false);
  });

  it("permite qualquer corretor do tenant ao diretor e restringe gestor à própria unidade", () => {
    expect(canExportBrokerMember({ viewerRole: "director", viewerBranchId: null, memberRole: "broker", memberBranchId: "unit-b" })).toBe(true);
    expect(canExportBrokerMember({ viewerRole: "manager", viewerBranchId: "unit-a", memberRole: "broker", memberBranchId: "unit-a" })).toBe(true);
    expect(canExportBrokerMember({ viewerRole: "manager", viewerBranchId: "unit-a", memberRole: "broker", memberBranchId: "unit-b" })).toBe(false);
    expect(canExportBrokerMember({ viewerRole: "manager", viewerBranchId: null, memberRole: "broker", memberBranchId: null })).toBe(false);
    expect(canExportBrokerMember({ viewerRole: "director", viewerBranchId: null, memberRole: "manager", memberBranchId: "unit-a" })).toBe(false);
  });

  it("monta o filtro por tenant e dono atual, incluindo encerrados por padrão", () => {
    expect(buildBrokerLeadExportScope({ tenantId: "tenant-1", brokerId: "broker-1", viewerRole: "director", viewerBranchId: null, includeClosed: true })).toEqual({
      tenantId: "tenant-1", currentOwnerId: "broker-1", branchId: null, excludeDeleted: true, excludedStatuses: [],
    });
    expect(buildBrokerLeadExportScope({ tenantId: "tenant-1", brokerId: "broker-1", viewerRole: "manager", viewerBranchId: "unit-1", includeClosed: false })).toEqual({
      tenantId: "tenant-1", currentOwnerId: "broker-1", branchId: "unit-1", excludeDeleted: true, excludedStatuses: ["converted", "lost"],
    });
  });

  it("monta todas as colunas pedidas com rótulos, datas e URL do CRM", () => {
    const row = buildBrokerLeadExportRow({
      id: "lead/123",
      nome: "Ana Silva",
      telefone: "+55 11 99999-0000",
      email: "ana@example.test",
      tipo: "PJ",
      origem: "whatsapp",
      sourceChannel: "whatsapp",
      sourceCampaign: "Campanha Sul",
      queueName: "Empresarial",
      branchName: "Centro",
      status: "in_contact",
      qualificationStatus: "hot",
      monthlyValue: "450.00",
      livesCount: 4,
      createdAt: new Date("2026-11-01T12:00:00.000Z"),
      assignedAt: new Date("2026-11-01T12:30:00.000Z"),
      latestInteractionAt: new Date("2026-11-02T15:00:00.000Z"),
      firstContactAt: new Date("2026-11-01T13:00:00.000Z"),
      motivoPerda: null,
      qualificationSummary: "Busca plano empresarial",
    }, "https://crm.example.test/");

    expect(Object.keys(row)).toEqual([...BROKER_LEAD_EXPORT_COLUMNS]);
    expect(row["Tipo"]).toBe("Pessoa jurídica");
    expect(row["Origem/campanha"]).toContain("Campanha Sul");
    expect(row["Status/etapa"]).toBe("Em atendimento");
    expect(row["Temperatura/qualificação"]).toBe("Quente");
    expect(row["Valor mensal"]).toBe("R$ 450,00");
    expect(row["Vidas"]).toBe(4);
    expect(row["Último contato"]).toBe("02/11/2026, 12:00");
    expect(row["Resumo da IA"]).toBe("Busca plano empresarial");
    expect(row["Link do lead no CRM"]).toBe("https://crm.example.test/leads/lead%2F123");
  });
  it("aceita o último contato vindo do banco como texto (subconsulta sql)", () => {
    const row = buildBrokerLeadExportRow({
      id: "lead-2", nome: "Bia", telefone: "21999990000", email: null, tipo: "PF", origem: "whatsapp",
      sourceChannel: "whatsapp", sourceCampaign: null, queueName: null, branchName: null, status: "new",
      qualificationStatus: null, monthlyValue: null, livesCount: null,
      createdAt: new Date("2026-11-01T12:00:00.000Z"), assignedAt: null,
      latestInteractionAt: "2026-11-02 15:00:00+00", firstContactAt: null, motivoPerda: null, qualificationSummary: null,
    }, "https://crm.example.test");
    expect(row["Último contato"]).toBe("02/11/2026, 12:00");
  });
});
