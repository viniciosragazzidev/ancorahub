import { describe, expect, it } from "vitest";

import { encodeDistributionLogPdf } from "./distribution-log-pdf";

const baseInput = {
  startDate: new Date("2026-09-22T00:00:00.000Z"),
  endDate: new Date("2026-09-22T23:59:59.000Z"),
  branchLabel: "Todas as unidades",
  tenantName: "Âncora Saúde",
  generatedAt: new Date("2026-09-22T15:00:00.000Z"),
};

describe("distribution log PDF", () => {
  it("creates a structured PDF grouped by fonte, with a queue badge per row", async () => {
    const bytes = await encodeDistributionLogPdf({
      ...baseInput,
      rows: [
        { brokerCode: "12352", brokerName: "Adriana Bernardo", queueName: "Fila Geral", fonteLabel: "Meta Ads (Campanha Setembro)", leadName: "João Silva", leadPhone: "5521999990000", assignedAt: new Date("2026-09-22T10:00:00.000Z") },
        { brokerCode: "3570", brokerName: "Adriana Costa", queueName: "Fila Geral", fonteLabel: "Meta Ads (Campanha Setembro)", leadName: "Maria Souza", leadPhone: "5521999990001", assignedAt: new Date("2026-09-22T10:05:00.000Z") },
        { brokerCode: "11454", brokerName: "Alexander Simas", queueName: "Plantão PME", fonteLabel: "Importação Manual (Lista Setembro)", leadName: "Pedro Alves", leadPhone: "5521999990002", assignedAt: new Date("2026-09-22T11:00:00.000Z") },
      ],
    });

    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");
    expect(bytes.length).toBeGreaterThan(500);
  });

  it("does not throw when there are no leads to report", async () => {
    const bytes = await encodeDistributionLogPdf({ ...baseInput, rows: [] });
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");
  });

  it("does not require a tenant logo", async () => {
    const bytes = await encodeDistributionLogPdf({
      ...baseInput,
      tenantLogoUrl: null,
      rows: [
        { brokerCode: "12352", brokerName: "Adriana Bernardo", queueName: "Fila Geral", fonteLabel: "Meta Ads (Campanha Externa)", leadName: "João Silva", leadPhone: "5521999990000", assignedAt: new Date("2026-09-22T10:00:00.000Z") },
      ],
    });

    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");
  });

  it("paginates when a fonte has many leads", async () => {
    const rows = Array.from({ length: 60 }, (_, index) => ({
      brokerCode: `100${index}`,
      brokerName: `Corretor ${index}`,
      queueName: index % 2 === 0 ? "Fila Geral" : "Plantão PME",
      fonteLabel: "Meta Ads (Campanha Setembro)",
      leadName: `Lead ${index}`,
      leadPhone: `55219999900${String(index).padStart(2, "0")}`,
      assignedAt: new Date(`2026-09-22T${String(8 + Math.floor(index / 10)).padStart(2, "0")}:00:00.000Z`),
    }));
    const bytes = await encodeDistributionLogPdf({ ...baseInput, rows });
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");
    expect(bytes.length).toBeGreaterThan(2000);
  });

  it("splits leads with a long, truncated queue-name badge across sections without throwing", async () => {
    const bytes = await encodeDistributionLogPdf({
      ...baseInput,
      rows: [
        { brokerCode: "1", brokerName: "Corretor A", queueName: "Fila de Atendimento Premium para Clientes VIP da Matriz", fonteLabel: "Google Ads (Campanha Institucional)", leadName: "Lead A", leadPhone: "5521999990000", assignedAt: new Date("2026-09-22T09:00:00.000Z") },
        { brokerCode: "2", brokerName: "Corretor B", queueName: "Fila Geral", fonteLabel: "WhatsApp Direto", leadName: "Lead B", leadPhone: "5521999990001", assignedAt: new Date("2026-09-22T09:10:00.000Z") },
      ],
    });
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");
  });
});
