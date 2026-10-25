import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("./duty-lead-details-trigger", () => ({
  DutyLeadDetailsTrigger: ({ lead }: { lead: { nome: string } }) => <button type="button">{lead.nome}</button>,
}));

import { DirectorDutyLeads, type DutyLeadRecord } from "./director-duty-leads";

const row: DutyLeadRecord = {
  lead: {
    id: "lead-1",
    nome: "Mariana de Albuquerque Costa",
    telefone: "+5511999999999",
    status: "new",
    qualificationStatus: "hot",
    qualificationState: null,
    distributionStatus: "assigned",
    origem: "Meta",
    sourceCampaign: null,
    sourceMetadata: { campaign: "Simulação" },
    tipo: "PF",
    createdAt: "2026-10-25T15:00:00.000Z",
    assignedAt: "2026-10-25T15:05:00.000Z",
    stageEnteredAt: null,
    serviceStartedAt: null,
    firstContactAt: null,
    corretorId: "broker-1",
    corretorNome: "Ana Souza",
    branchId: "branch-1",
    branchName: "Centro",
    qualificationDetails: null,
    queueId: "queue-1",
    queueName: "Fila premium",
    queueColorHue: 210,
    distributionRemovalReason: null,
    distributionRemovalNote: null,
  },
  groupKey: "manha",
  groupLabel: "Turno da manhã",
  createdAt: "2026-10-25T15:00:00.000Z",
  assignedAt: "2026-10-25T15:05:00.000Z",
  brokerName: "Ana Souza",
  queueName: "Fila premium",
  distributionLabel: "Atribuído",
  distributionTone: "success",
  whatsappLabel: "Campanha de outubro",
  returnedUnaccepted: false,
  coldHeld: false,
};

describe("lista Lite de leads do plantão", () => {
  it("usa linhas no desktop, cartões no celular e datas no fuso de São Paulo", () => {
    const html = renderToStaticMarkup(
      <DirectorDutyLeads
        groups={[{ key: "manha", label: "Turno da manhã", leads: [row] }]}
        brokers={[{ id: "broker-1", name: "Ana Souza", branchId: "branch-1" }]}
        branches={[{ id: "branch-1", name: "Centro" }]}
        contextRole="director"
        contextJobTitle={null}
        contextBranchId={null}
        manualAssignmentChoiceEnabled
        slaFirstContactMinutes={15}
        slaStagnantDays={3}
        empty="Sem leads"
      />,
    );

    expect(html).toContain('data-lite="table"');
    expect(html).toContain('data-lite="list"');
    expect(html).toContain("Mariana de Albuquerque Costa");
    expect(html).toContain("25/10/2026, 12:00");
    expect(html).toContain("Campanha de outubro");
    expect(html).toContain("Fila premium");
  });

  it("mostra o estado vazio da ordem", () => {
    const html = renderToStaticMarkup(
      <DirectorDutyLeads
        groups={[{ key: "manha", label: "Turno da manhã", leads: [] }]}
        brokers={[]}
        branches={[]}
        contextRole="director"
        contextJobTitle={null}
        contextBranchId={null}
        manualAssignmentChoiceEnabled={false}
        slaFirstContactMinutes={15}
        slaStagnantDays={3}
        empty="Nenhum lead nesta ordem."
      />,
    );

    expect(html).toContain("Nenhum lead nesta ordem.");
  });
});
