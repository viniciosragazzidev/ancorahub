/**
 * Dados de exemplo da Central de relacionamento (mensagens e jornada da equipe). Usados só nos testes e na moldura
 * real de desenvolvimento (/dev/diretor-shell-real?tela=relacionamento). Nada aqui roda em produção.
 */
import { ENGAGEMENT_RULES } from "@/features/engagement/catalog";
import type { DirectorJourneyData } from "@/features/journey/components/director/director-journey-panel";

import type { AudienceOptions } from "../../audience";
import type { BroadcastSummary } from "../../service";

export type RelationshipHistoryFixture = Omit<BroadcastSummary, "createdAt"> & { createdAt: string };

export const relationshipOptionsFixture: AudienceOptions = {
  role: "director",
  brokers: [
    { id: "broker-ana", name: "Ana Souza Ribeiro", branchName: "Centro" },
    { id: "broker-bruno", name: "Bruno Martins de Almeida", branchName: "Zona Norte" },
    { id: "broker-carla", name: "Carla Menezes", branchName: "Centro" },
    { id: "broker-diego", name: "Diego Ferraz", branchName: null },
  ],
  branches: [
    { id: "branch-centro", name: "Centro" },
    { id: "branch-norte", name: "Zona Norte" },
  ],
  dutyTypes: [
    { id: "duty-pf", name: "Plantão PF" },
    { id: "duty-pme", name: "Plantão PME" },
  ],
  supervisors: [
    { id: "sup-lucas", name: "Lucas Supervisor" },
    { id: "sup-paula", name: "Paula Supervisora" },
  ],
};

export const relationshipHistoryFixture: RelationshipHistoryFixture[] = [
  {
    id: "broadcast-1",
    kind: "confirmation",
    title: "Leia a nova regra de repasse de leads da semana",
    body: "A partir de segunda, o repasse segue a fila do plantão.\nConfirme a leitura até sexta.",
    audienceLabel: "Todos os corretores",
    requireAck: true,
    recipientsCount: 24,
    createdAt: "2026-10-24T13:10:00.000Z",
    senderName: "Marina Exemplo",
    read: 18,
    acked: 11,
  },
  {
    id: "broadcast-2",
    kind: "recognition",
    title: "Parabéns pelo plantão de ontem",
    body: "Equipe do Centro fechou 6 vendas no plantão.",
    audienceLabel: "Unidade Centro",
    requireAck: false,
    recipientsCount: 9,
    createdAt: "2026-10-23T21:40:00.000Z",
    senderName: "Marina Exemplo",
    read: 9,
    acked: 0,
  },
  {
    id: "broadcast-3",
    kind: "notice",
    title: "Escala de novembro publicada",
    body: "A escala de plantões de novembro já está no app.",
    audienceLabel: "Plantão de hoje",
    requireAck: false,
    recipientsCount: 5,
    createdAt: "2026-10-22T12:00:00.000Z",
    senderName: "Lucas Supervisor",
    read: 1,
    acked: 0,
  },
];

const week = { periodKey: "2026-W43", startsAt: "2026-10-19T03:00:00.000Z", endsAt: "2026-10-26T02:59:59.000Z" };

export const journeyDataFixture: DirectorJourneyData = {
  canManageRules: true,
  dashboard: {
    available: true,
    period: week,
    adoption: { activeBrokers: 24, scoringBrokers: 17, percentage: 71 },
    pointsByRule: [
      { ruleKey: "contact.first", label: "Primeiro contato", points: 1240, events: 112 },
      { ruleKey: "return.on_time", label: "Retorno em dia", points: 420, events: 84 },
      { ruleKey: "note.service", label: "Atendimento registrado", points: 255, events: 85 },
      { ruleKey: "mission.completed", label: "Missão concluída", points: 300, events: 6 },
    ],
    units: [
      { branchId: "branch-centro", branchName: "Centro", points: 1460, adoption: { activeBrokers: 14, scoringBrokers: 11, percentage: 79 }, brokers: [] },
      { branchId: "branch-norte", branchName: "Zona Norte de São Gonçalo e região", points: 755, adoption: { activeBrokers: 10, scoringBrokers: 6, percentage: 60 }, brokers: [] },
    ],
    teams: [
      { supervisorId: "sup-lucas", name: "Lucas Supervisor", imageUrl: null, branchId: "branch-centro", activeBrokers: 8, totalPoints: 980, averagePoints: 122.5, previousAveragePoints: 100, position: 1, previousPosition: 2, positionChange: 1 },
      { supervisorId: "sup-paula", name: "Paula Supervisora", imageUrl: null, branchId: "branch-norte", activeBrokers: 1, totalPoints: 90, averagePoints: 90, previousAveragePoints: 110, position: 2, previousPosition: 1, positionChange: -1 },
    ],
    topMissions: [
      { missionId: "mission-1", title: "Zerar retornos vencidos", kind: "daily", completed: 14 },
      { missionId: "mission-2", title: "Semana PME", kind: "campaign", completed: 3 },
    ],
  },
  campaigns: [
    { id: "camp-1", kind: "campaign", title: "Semana PME", description: "3 cotações PME valem bônus para a unidade Centro.", metric: "contacts.evidenced", target: 3, bonusPoints: 100, period: "campaign", audience: { branchIds: ["branch-centro"] }, startsAt: "2026-10-20T03:00:00.000Z", endsAt: "2026-10-27T02:59:59.000Z", status: "active", createdBy: "director-1", createdAt: "2026-10-19T12:00:00.000Z" },
    { id: "camp-2", kind: "campaign", title: "Retornos em dia", description: "", metric: "returns.cleared", target: 10, bonusPoints: 50, period: "campaign", audience: {}, startsAt: null, endsAt: null, status: "inactive", createdBy: "director-1", createdAt: "2026-10-10T12:00:00.000Z" },
  ],
  audience: {
    available: true,
    branches: [{ id: "branch-centro", name: "Centro", branchId: "branch-centro" }, { id: "branch-norte", name: "Zona Norte", branchId: "branch-norte" }],
    teams: [{ id: "sup-lucas", name: "Lucas Supervisor", branchId: "branch-centro" }],
    duties: [{ id: "duty-1", name: "Plantão PF manhã", branchId: "branch-centro" }],
    brokers: [{ id: "broker-ana", name: "Ana Souza Ribeiro", branchId: "branch-centro" }, { id: "broker-bruno", name: "Bruno Martins de Almeida", branchId: "branch-norte" }],
  },
  rules: {
    available: true,
    rules: [ENGAGEMENT_RULES["offer.fast_accept"], ENGAGEMENT_RULES["contact.first"], ENGAGEMENT_RULES["return.on_time"], { ...ENGAGEMENT_RULES["note.service"], enabled: false }],
  },
  risk: {
    available: true,
    period: week,
    brokers: [
      { brokerId: "broker-ana", name: "Ana Souza Ribeiro", branchId: "branch-centro", points: 410, rules: [{ ruleKey: "contact.first", label: "Primeiro contato", points: 300, events: 30, zScore: 2.7, outlier: true }], repeatedNotes: 3, unusualContacts: 0 },
      { brokerId: "broker-bruno", name: "Bruno Martins de Almeida", branchId: "branch-norte", points: 120, rules: [{ ruleKey: "note.service", label: "Atendimento registrado", points: 30, events: 10, zScore: 0.4, outlier: false }], repeatedNotes: 0, unusualContacts: 2 },
    ],
    events: [
      { id: "event-1", brokerId: "broker-ana", brokerName: "Ana Souza Ribeiro", ruleKey: "contact.first", points: 15, occurredAt: "2026-10-24T14:05:00.000Z", reversedAt: null, detail: "Primeiro contato com Maria Nova" },
      { id: "event-2", brokerId: "broker-bruno", brokerName: "Bruno Martins de Almeida", ruleKey: "note.service", points: 3, occurredAt: "2026-10-24T11:30:00.000Z", reversedAt: "2026-10-24T12:00:00.000Z", detail: null },
    ],
  },
};
