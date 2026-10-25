/**
 * Negociações de exemplo do Radar IA (testes e rotas de desenvolvimento): quente, em risco, pendente no corretor e
 * sem leitura ainda. Não vai para produção.
 */
import type { RadarDealItem } from "./negotiations-radar-tab";

export const RADAR_FIXTURES: RadarDealItem[] = [
  {
    id: "r1",
    nome: "Justiniano Albuquerque de Souza",
    telefone: "5521998836148",
    status: "negotiation",
    corretorId: "b1",
    corretorNome: "Ana Souza",
    branchId: "branch-centro",
    branchName: "Centro",
    createdAt: "2026-10-20T12:00:00.000Z",
    stageEnteredAt: "2026-10-23T12:00:00.000Z",
    qualificationDetails: {
      aiLastAnalyzedAt: "2026-10-24T13:00:00.000Z",
      aiIntelligence: {
        customerIntent: "VERY_HIGH",
        conversationStage: "CLOSING",
        sentiment: "POSITIVE",
        summary: "Cliente aprovou a cotação PME para 4 vidas e pediu o contrato para assinar hoje.",
        nextBestAction: "Enviar o contrato e a lista de documentos ainda hoje, confirmando a data de vigência.",
        pendingFrom: "BROKER",
      },
    },
  },
  {
    id: "r2",
    nome: "Cristiane Farizele Monteiro",
    telefone: "5521979896800",
    status: "quote_sent",
    corretorId: "b2",
    corretorNome: "Bruno Lima",
    branchId: "branch-barra",
    branchName: "Barra da Tijuca",
    createdAt: "2026-10-19T12:00:00.000Z",
    stageEnteredAt: "2026-10-21T12:00:00.000Z",
    qualificationDetails: {
      aiIntelligence: {
        customerIntent: "LOW",
        conversationStage: "QUOTE_PRESENTED",
        sentiment: "NEGATIVE",
        summary: "Cliente achou o valor alto e citou uma proposta mais barata de outra corretora.",
        risk: "Comparando preço com concorrente; sem resposta há 2 dias.",
        nextBestAction: "Apresentar a opção com coparticipação e reforçar a rede credenciada.",
        pendingFrom: "CUSTOMER",
      },
    },
  },
  {
    id: "r3",
    nome: "Nazareth Gonçalves Pereira",
    telefone: "5521999199783",
    status: "in_contact",
    corretorId: "b1",
    corretorNome: "Ana Souza",
    branchId: "branch-centro",
    branchName: "Centro",
    createdAt: "2026-10-22T12:00:00.000Z",
    stageEnteredAt: "2026-10-23T09:00:00.000Z",
    qualificationDetails: {
      aiIntelligence: {
        customerIntent: "MEDIUM",
        conversationStage: "DISCOVERY",
        sentiment: "NEUTRAL",
        summary: "Família de 3 pessoas buscando plano com obstetrícia; aguardando idades.",
        pendingFrom: "BROKER",
      },
    },
  },
  {
    id: "r4",
    nome: "Ana",
    telefone: null,
    status: "negotiation",
    corretorId: null,
    corretorNome: null,
    branchId: null,
    branchName: null,
    createdAt: "2026-10-23T12:00:00.000Z",
    stageEnteredAt: null,
    qualificationDetails: null,
  },
];
