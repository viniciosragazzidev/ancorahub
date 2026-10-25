/** Documentos e requisitos de exemplo (testes e moldura real de desenvolvimento). */
import type { PendingDocLite, RequirementLite } from "./documents-lite";

const LEADS = ["Justiniano Albuquerque de Souza", "Padaria Nova Esperança Ltda", "Cristiane Farizele Monteiro", "Bartolomeu Wanderley Castelo Branco", "Nazareth Gonçalves Pereira", "Ana", "Transportadora Rápido Carioca"];
const FILES = ["rg-frente-e-verso-titular.pdf", "comprovante-de-residencia-outubro-2026.jpg", "cartao-cnpj-atualizado.pdf", "carteirinha-plano-anterior.png", "declaracao-de-saude-assinada.pdf"];
const TYPES = ["RG ou CNH do titular", "Comprovante de residência", "Cartão CNPJ", null, "Declaração de saúde"];

export const DOC_FIXTURES: PendingDocLite[] = Array.from({ length: 14 }, (_, index) => ({
  id: `doc-${index + 1}`,
  filename: FILES[index % FILES.length]!,
  fileUrl: `https://example.com/docs/${index + 1}.pdf`,
  status: index < 9 ? "pending" : index < 12 ? "approved" : "rejected",
  createdAt: new Date(Date.UTC(2026, 9, 24, 15 - (index % 10), 10)),
  leadId: `lead-${(index % LEADS.length) + 1}`,
  leadNome: LEADS[index % LEADS.length]!,
  corretorNome: index % 4 === 3 ? null : ["Ana Souza", "Bruno Lima", "Carla Dias"][index % 3] ?? null,
  branchName: ["Centro", "Barra da Tijuca", "Niterói 1"][index % 3] ?? null,
  requirementName: TYPES[index % TYPES.length] ?? null,
}));

export const REQUIREMENT_FIXTURES: RequirementLite[] = [
  { id: "req-1", name: "RG ou CNH do titular", description: "Frente e verso, legível", required: true, appliesPerBeneficiary: true, carrierId: null, carrierName: null, planId: null, planName: null },
  { id: "req-2", name: "Comprovante de residência", description: "Emitido nos últimos 90 dias", required: true, appliesPerBeneficiary: false, carrierId: "c1", carrierName: "Amil", planId: null, planName: null },
  { id: "req-3", name: "Cartão CNPJ", description: null, required: true, appliesPerBeneficiary: false, carrierId: "c2", carrierName: "Bradesco Saúde", planId: "p2", planName: "Top Nacional Flex" },
  { id: "req-4", name: "Carteirinha do plano anterior", description: "Para aproveitar carência", required: false, appliesPerBeneficiary: true, carrierId: null, carrierName: null, planId: null, planName: null },
];

export const CARRIER_FIXTURES = [{ id: "c1", name: "Amil" }, { id: "c2", name: "Bradesco Saúde" }, { id: "c3", name: "SulAmérica" }];
export const PLAN_FIXTURES = [{ id: "p1", name: "S380 QC Nacional", carrierName: "Amil" }, { id: "p2", name: "Top Nacional Flex", carrierName: "Bradesco Saúde" }];
