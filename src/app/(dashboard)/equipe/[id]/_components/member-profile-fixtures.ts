/** Perfil de membro de exemplo (dev e testes): corretor com carteira grande, plantões e redistribuições. */
import type { MemberProfileLite } from "./member-profile-lite";

type MemberProfileFixture = Parameters<typeof MemberProfileLite>[0]["profile"];
export const PROFILE_NOW = "2026-10-25T01:30:00.000Z";
const LEAD_NAMES = ["Justiniano Albuquerque de Souza", "Padaria Nova Esperança Ltda", "Cristiane Farizele Monteiro", "Bartolomeu Wanderley Castelo Branco", "Nazareth Gonçalves Pereira", "Clínica Odontológica Sorriso Pleno", "Roseleia Oliveira Bittencourt", "Transportadora Rápido Carioca", "Juliana Prado", "Raimundo Nonato Silva", "Ana", "Maximiliano Cavalcanti Rocha"];
const LEAD_STATUSES = ["in_contact", "negotiation", "quote_sent", "documentation_pending", "distributed", "converted", "lost"];

export const MEMBER_PROFILE_FIXTURE = {
  member: {
    userId: "user-4", name: "Maximiliano Cavalcanti Rocha", email: "maximiliano.rocha@ancorasaude.com.br", image: null, role: "broker", jobTitle: "broker",
    customRoleName: null, branchName: "Barra da Tijuca", availabilityStatus: "available", membershipStatus: "active", userStatus: "active",
    joinedAt: new Date("2025-03-12T12:00:00.000Z"), brokerCode: "COR-0142", brokerLifecycleStatus: "ACTIVE", brokerPhone: "21999990142",
  },
  metrics: {
    leads: { total: 214, active: 61, qualified: 132, lost: 48, withoutFirstContact: 9, converted: 31 },
    temperature: { hot: 41, warm: 57, cold: 34, unknown: 12 },
    sales: { total: 33, active: 31, cancelled: 2, volume: "61240.50" },
    tasks: { total: 188, completed: 171, overdue: 3, open: 17 },
    quotes: { total: 96, sent: 88, accepted: 35 },
    interactions: 1240,
    offers: { total: 260, accepted: 214, pending: 4, declined: 30, expired: 12 },
    redistributions: 14,
    redistributionsWithoutFirstContact: 3,
  },
  recentLeads: LEAD_NAMES.map((name, index) => ({
    id: `lead-${index + 1}`, name, status: LEAD_STATUSES[index % LEAD_STATUSES.length]!, queueName: index % 3 === 0 ? "Fila PME Barra" : index % 3 === 1 ? "PF Renan" : null,
    temperature: (["hot", "warm", "cold", null] as const)[index % 4] ?? null,
    assignedAt: new Date(new Date(PROFILE_NOW).getTime() - index * 9 * 3_600_000), createdAt: new Date(new Date(PROFILE_NOW).getTime() - index * 9 * 3_600_000 - 600_000),
    firstContactAt: index % 5 === 4 ? null : new Date(new Date(PROFILE_NOW).getTime() - index * 9 * 3_600_000 + 420_000),
  })),
  recentRedistributions: [
    { id: "r1", leadName: "Transportadora Rápido Carioca", reason: "Sem primeiro contato no SLA da fila", action: "redistributed", createdAt: new Date("2026-10-22T14:10:00.000Z") },
    { id: "r2", leadName: "Clínica Odontológica Sorriso Pleno", reason: null, action: "Transferido pelo gestor", createdAt: new Date("2026-10-18T19:40:00.000Z") },
  ],
  dutyDays: [
    { date: "2026-10-21", scheduleId: "s1", scheduleName: "Plantão PME manhã", startsAt: "08:00", endsAt: "12:00", typeName: "PME", typeHue: 210, attendanceMode: "presencial", state: "done", leads: 14, offersSent: 18, offersAccepted: 15, presence: "confirmed" },
    { date: "2026-10-24", scheduleId: "s2", scheduleName: "Plantão PF tarde", startsAt: "13:00", endsAt: "18:00", typeName: "PF", typeHue: 140, attendanceMode: "online", state: "today", leads: 6, offersSent: 7, offersAccepted: 6, presence: "pending" },
    { date: "2026-10-28", scheduleId: "s1", scheduleName: "Plantão PME manhã", startsAt: "08:00", endsAt: "12:00", typeName: "PME", typeHue: 210, attendanceMode: "presencial", state: "upcoming", leads: 0, offersSent: 0, offersAccepted: 0, presence: null },
  ],
} as unknown as MemberProfileFixture;

