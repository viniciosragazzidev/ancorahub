/** Propostas de exemplo (testes e moldura real de desenvolvimento): todos os estados, nomes longos, valores grandes. */
import type { ProposalRecord } from "@/features/proposals/queries";
import type { ProposalStatus } from "@/shared/db/schema";

const rows: Array<[string, string, ProposalStatus, string, number]> = [
  ["Proposta Bradesco Saúde Top Nacional Flex", "Justiniano Albuquerque de Souza", "negociacao", "4890.20", 3],
  ["Amil S380 QC PME 12 vidas", "Padaria Nova Esperança Ltda", "aprovada", "12850.40", 1],
  ["SulAmérica Exato familiar", "Cristiane Farizele Monteiro", "enviada", "1980.00", 1],
  ["Unimed Rio Pleno adesão", "Bartolomeu Wanderley Castelo Branco", "em_revisao", "642.90", 2],
  ["Porto Seguro Saúde 400", "Nazareth Gonçalves Pereira", "visualizada", "2340.50", 1],
  ["Hapvida Mix individual", "Ana", "rascunho", "189.90", 1],
  ["Bradesco Saúde Efetivo III empresarial", "Transportadora Rápido Carioca", "aprovada", "47210.80", 4],
  ["NotreDame Smart 300", "Roseleia Oliveira Bittencourt", "perdida", "455.30", 1],
  ["Amil 400 QP regional", "Raimundo Nonato Silva", "expirada", "990.00", 1],
];

export const PROPOSAL_FIXTURES: ProposalRecord[] = rows.map(([title, leadName, status, totalMonthly, version], index) => ({
  id: `prop-${index + 1}`,
  tenantId: "tenant-1",
  leadId: `lead-${index + 1}`,
  leadName,
  leadPhone: index === 5 ? null : `55219${String(98836148 - index * 1111).padStart(8, "0")}`,
  quoteId: null,
  title,
  status,
  version,
  validUntil: new Date(Date.UTC(2026, 9, 26 + index, 12)),
  notes: null,
  documentIds: [],
  createdBy: "director-1",
  createdByName: "Marina Exemplo",
  convertedAt: index === 6 ? new Date(Date.UTC(2026, 9, 23, 12)) : null,
  convertedSaleId: index === 6 ? "sale-7" : null,
  totalMonthly,
  beneficiaryCount: 1 + index,
  createdAt: new Date(Date.UTC(2026, 9, 20 - index, 12)),
  updatedAt: new Date(Date.UTC(2026, 9, 22, 12)),
}));

export const PROPOSAL_LEADS = PROPOSAL_FIXTURES.map((proposal) => ({ id: proposal.leadId, name: proposal.leadName }));
