/**
 * Dados de exemplo da ficha do cliente (/clientes/[clientId]). Usados só nos testes e na moldura real de
 * desenvolvimento (/dev/diretor-shell-real?tela=cliente). Nada aqui roda em produção.
 */
export const clientFixture = {
  id: "client-1",
  leadId: "11111111-1111-4111-8111-111111111111",
  name: "Maria Aparecida Nova dos Santos",
  phone: "(21) 99999-0101",
  email: "maria.aparecida.nova@exemplo.com.br",
  convertedAt: new Date("2026-08-14T15:00:00.000Z"),
  createdAt: new Date("2026-08-01T12:00:00.000Z"),
  branchId: "branch-1",
  corretorId: "broker-1",
  brokerName: "Ana Souza Ribeiro",
  branchName: "Centro",
};

export const clientLeadFixture = {
  id: clientFixture.leadId,
  nome: clientFixture.name,
  status: "converted",
  createdAt: new Date("2026-08-01T12:00:00.000Z"),
  origem: "webhook",
  consentimentoLgpd: true,
};

export const clientSalesFixture = [
  {
    id: "sale-1",
    saleValue: "1289.90",
    approvedValue: "1289.90",
    policyNumber: "AP-2026-000123",
    coverageStartDate: "2026-09-01",
    saleDate: new Date("2026-08-14T15:00:00.000Z"),
    status: "active",
    notes: "Cliente pediu boleto no dia 10.",
    planName: "Essencial Regional Enfermaria",
    carrierName: "Saúde Exemplo",
    brokerName: "Ana Souza Ribeiro",
    createdAt: new Date("2026-08-14T15:00:00.000Z"),
  },
  {
    id: "sale-2",
    saleValue: "310.00",
    approvedValue: null,
    policyNumber: null,
    coverageStartDate: null,
    saleDate: new Date("2026-06-02T15:00:00.000Z"),
    status: "cancelled",
    notes: null,
    planName: null,
    carrierName: null,
    brokerName: "Ana Souza Ribeiro",
    createdAt: new Date("2026-06-02T15:00:00.000Z"),
  },
];

export const clientActiveCustomerFixture = {
  id: "active-1",
  status: "active",
  coverageStartDate: "2026-09-01",
  contractAnniversary: "2027-09-01",
  expirationDate: "2026-11-20",
  renewalStatus: "in_renewal" as const,
  renewalNotes: "Proposta enviada, aguardando retorno",
  cancellationDate: null as string | null,
  cancellationReason: null as string | null,
  createdAt: new Date("2026-09-01T12:00:00.000Z"),
};

export const clientInteractionsFixture = [
  { id: "i1", tipo: "status_change" as const, conteudo: "Status alterado para Convertido", userName: "Ana Souza Ribeiro", createdAt: new Date("2026-08-14T15:00:00.000Z") },
  { id: "i2", tipo: "note" as const, conteudo: "Cliente pediu para falar sobre a inclusão do filho no plano no mês que vem.", userName: "Marina Exemplo", createdAt: new Date("2026-10-20T13:30:00.000Z") },
];

export const clientRequirementsFixture = [
  { id: "req-rg", name: "RG ou CNH do titular", description: "Frente e verso", required: true, appliesPerBeneficiary: false },
  { id: "req-dep", name: "Certidão do dependente", description: null, required: true, appliesPerBeneficiary: true },
  { id: "req-prop", name: "Proposta assinada", description: null, required: false, appliesPerBeneficiary: false },
];

export const clientDocumentsFixture = [
  { id: "doc-1", filename: "rg-maria.pdf", fileUrl: "/fixture/rg-maria.pdf", status: "approved", requirementId: "req-rg", beneficiaryId: null, category: "identificacao", description: null, version: 1 },
  { id: "doc-2", filename: "certidao-joao.pdf", fileUrl: "/fixture/certidao-joao.pdf", status: "pending", requirementId: "req-dep", beneficiaryId: "ben-2", category: "dependentes", description: null, version: 1 },
];

export const clientChecklistFixture = [
  { id: "chk-1", requirementId: "req-rg", requirementName: "RG ou CNH do titular", required: true, appliesPerBeneficiary: false, beneficiaryId: null, beneficiaryName: null, documentId: "doc-1", status: "approved" },
  { id: "chk-2", requirementId: "req-dep", requirementName: "Certidão do dependente", required: true, appliesPerBeneficiary: true, beneficiaryId: "ben-2", beneficiaryName: "João Nova", documentId: "doc-2", status: "pending" },
];

export const clientBeneficiariesFixture = [
  { id: "ben-1", name: clientFixture.name, birthDate: "1988-04-12", relationship: "Titular", isHolder: true },
  { id: "ben-2", name: "João Nova", birthDate: "2015-02-03", relationship: "Filho", isHolder: false },
];
