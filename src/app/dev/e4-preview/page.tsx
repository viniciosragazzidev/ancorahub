import { notFound } from "next/navigation";
import { ChatHome } from "@/components/chat/chat-home";
import { LightChrome } from "@/components/light/light-chrome";
import { ManagerLiteUnitProfile } from "@/features/branches/components/manager-lite-unit-profile";
import type { BranchProfileData } from "@/features/branches/queries";
import type { ChatRailData } from "@/features/broker-workspace/chat/chat-rail-data";
import { ManagerLiteTeam } from "@/features/manager-workspace/manager-lite-team";
import type { ManagerLiteTeamData } from "@/features/manager-workspace/manager-lite-team-queries";
import { MyTeamPage } from "@/features/supervisor-workspace/my-team-page";
import type { SupervisorTeamPageData } from "@/features/supervisor-workspace/my-team-queries";
import type { PendingTransferRequest } from "@/features/supervisor-workspace/transfer-actions";

const instant = "2026-10-14T15:00:00.000Z";
const uuid = (suffix: string) => `00000000-0000-4000-8000-${suffix.padStart(12, "0")}`;

const managerRail: ChatRailData = {
  viewerName: "Marina Gestora",
  assistants: [
    { id: "assistant:equipe-leads", kind: "assistant", assistant: "equipe-leads", name: "Leads da unidade", verified: true, pinned: true, preview: "7 leads aguardando distribuição manual.", at: instant, unread: true, waitingYou: true, href: "/leads", shape: "favo", hue: 252 },
    { id: "assistant:equipe", kind: "assistant", assistant: "equipe", name: "Minha unidade", verified: true, preview: "4 corretores em atendimento na unidade.", at: instant, unread: false, waitingYou: false, href: `/unidades/${uuid("1")}`, shape: "mochi", hue: 150 },
    { id: "assistant:ancora", kind: "assistant", assistant: "ancora", name: "Notificações", verified: true, preview: "Avisos e atualizações da unidade.", at: instant, unread: false, waitingYou: false, href: "/notificacoes", shape: "jack", hue: 175 },
  ],
  leads: [], nowIso: instant, canQuote: false, leadsBadgeCount: 7,
  managerUnitSummary: { leads: 24, unassigned: 7, activeBrokers: 8, brokersWithoutWhatsApp: 2, inService: 11, late: 1 },
};

const brokerRail: ChatRailData = {
  viewerName: "Rafa Corretor",
  assistants: [
    { id: "assistant:ancora", kind: "assistant", assistant: "ancora", name: "Jack", verified: true, pinned: true, preview: "Tenho um resumo do seu dia.", at: instant, unread: false, waitingYou: false, href: "/dashboard/c/ancora", shape: "jack", hue: 175 },
    { id: "assistant:leads", kind: "assistant", assistant: "leads", name: "Minha fila", verified: true, preview: "Você tem uma oportunidade para olhar.", at: instant, unread: true, waitingYou: true, href: "/minha-fila", shape: "favo", hue: 252 },
    { id: "assistant:plantao", kind: "assistant", assistant: "plantao", name: "Meu plantão", verified: true, preview: "Sua próxima escala está confirmada.", at: instant, unread: false, waitingYou: false, href: "/plantoes", shape: "onigiri", hue: 28 },
  ],
  leads: [], nowIso: instant, canQuote: true,
};

const teamData: ManagerLiteTeamData = {
  unitBranchId: uuid("1"), unitName: "Unidade Centro", slaMinutes: 15,
  counts: { brokers: 8, inService: 4, late: 1 },
  unassignedBrokers: [{ userId: uuid("21"), name: "Bia Martins" }, { userId: uuid("22"), name: "Caio Alves" }],
  supervisorInvites: [{ id: uuid("30"), name: "João Pereira", email: "joao@example.test", createdAt: instant }],
  members: [
    { id: uuid("11"), userId: uuid("11"), name: "Ana Lima", image: null, email: "ana@example.test", availability: "available", status: "active", inviteId: null, inService: 3, late: 0 },
    { id: uuid("12"), userId: uuid("12"), name: "Bruno Costa", image: null, email: "bruno@example.test", availability: "on_duty", status: "active", inviteId: null, inService: 2, late: 1 },
    { id: uuid("13"), userId: null, name: "Carla Demo", image: null, email: "carla@example.test", availability: "offline", status: "pending", inviteId: uuid("31"), inService: 0, late: 0 },
  ],
};

const transferRequests: PendingTransferRequest[] = [{
  id: uuid("40"), brokerId: uuid("12"), brokerName: "Bruno Costa", fromSupervisorId: uuid("51"), fromSupervisorName: "Equipe Alfa",
  toSupervisorId: uuid("52"), toSupervisorName: "Equipe Beta", branchId: uuid("1"), branchName: "Unidade Centro",
  reason: "Ajuste de cobertura da unidade.", createdAt: instant,
}];

const unitData: BranchProfileData = {
  branch: { id: uuid("1"), name: "Unidade Centro", status: "active", acceptingLeads: true, autoDistribute: true, createdAt: new Date("2024-02-01T12:00:00.000Z") },
  metrics: { period: "últimos 30 dias", totalLeads: 184, leadsConvertidos: 21, leadsPerdidos: 9, leadsAtivos: 42, leadsDistribuidos: 31, taxaConversao: 11, taxaPerda: 5, leadsTrend: [18, 22, 19, 27, 31, 24, 28] },
  members: [
    { userId: uuid("11"), name: "Ana Lima", email: "ana@example.test", role: "broker", jobTitle: "broker", availabilityStatus: "available", membershipStatus: "active", activeLeads: 9 },
    { userId: uuid("12"), name: "Bruno Costa", email: "bruno@example.test", role: "broker", jobTitle: "broker", availabilityStatus: "paused", membershipStatus: "active", activeLeads: 6 },
    { userId: uuid("53"), name: "Rita Supervisora", email: "rita@example.test", role: "supervisor", jobTitle: "supervisor", availabilityStatus: "available", membershipStatus: "active", activeLeads: 0 },
  ],
  topBrokers: [
    { userId: uuid("11"), name: "Ana Lima", totalLeads: 33, converted: 8, conversionRate: 24 },
    { userId: uuid("12"), name: "Bruno Costa", totalLeads: 28, converted: 5, conversionRate: 18 },
  ],
};

const supervisorData: SupervisorTeamPageData = {
  branchId: uuid("1"), branchName: "Unidade Centro",
  team: { name: "Equipe Horizonte", description: "Atendimento da Unidade Centro.", imageUrl: null },
  ranking: { position: 2, positionChange: 1 }, overview: { brokers: 6, inService: 4, late: 1 },
  members: [
    { id: uuid("11"), name: "Ana Lima", imageUrl: null, availability: "available", receivedToday: 5, inService: 3, late: 0 },
    { id: uuid("12"), name: "Bruno Costa", imageUrl: null, availability: "on_duty", receivedToday: 4, inService: 1, late: 1 },
  ],
  invites: [{ id: uuid("60"), brokerId: uuid("21"), brokerName: "Bia Martins", createdAt: instant }],
  pendingAccessInvites: [{ id: uuid("61"), brokerProfileId: uuid("62"), brokerName: "Caio Alves", email: "caio@example.test", createdAt: instant }],
  brokers: [
    { id: uuid("21"), name: "Bia Martins", imageUrl: null, supervisorId: null, supervisorName: null, inviteId: null },
    { id: uuid("22"), name: "Caio Alves", imageUrl: null, supervisorId: null, supervisorName: null, inviteId: null },
  ],
};

function ReferenceHome() {
  return <div className="arc-venancor h-full w-full bg-[var(--surface)]"><ChatHome viewerName={brokerRail.viewerName} assistants={brokerRail.assistants} leads={brokerRail.leads} nowIso={brokerRail.nowIso} canQuote={brokerRail.canQuote} mode="page" /></div>;
}

export default async function E4PreviewPage({ searchParams }: { searchParams: Promise<{ screen?: string; compare?: string }> }) {
  if (process.env.NODE_ENV !== "development") notFound();
  const params = await searchParams;
  const screen = params.screen ?? "manager-team";
  const preview = screen === "comparison" ? params.compare ?? "manager-team" : screen;
  const managerContent = preview === "unit" ? <ManagerLiteUnitProfile data={unitData} period={30} /> : <ManagerLiteTeam initialData={teamData} initialTransfers={transferRequests} />;
  const managerScreen = <LightChrome audience="manager" user={{ name: managerRail.viewerName, email: "marina@example.test" }} initialChatRail={managerRail}>{managerContent}</LightChrome>;
  const supervisorScreen = <LightChrome audience="supervisor" user={{ name: "Rita Supervisora", email: "rita@example.test" }} initialChatRail={brokerRail}><MyTeamPage initialData={supervisorData} /></LightChrome>;
  const primaryScreen = preview === "supervisor-team" ? supervisorScreen : managerScreen;

  if (screen === "supervisor-team") return supervisorScreen;
  if (screen === "broker-reference") return <LightChrome audience="broker" user={{ name: brokerRail.viewerName, email: "rafa@example.test" }} initialChatRail={brokerRail}><ReferenceHome /></LightChrome>;
  if (screen === "comparison") {
    return <main className="grid h-screen w-full grid-cols-2 gap-0 bg-[var(--surface-muted)]">
      <section className="h-screen min-w-0 overflow-hidden border border-border" aria-label={preview === "supervisor-team" ? "Supervisor Lite" : "Gestor Lite"}><div className="h-screen">{primaryScreen}</div></section>
      <section className="h-screen min-w-0 overflow-hidden border border-border" aria-label="Referência do Corretor Lite"><div className="h-screen"><LightChrome audience="broker" user={{ name: brokerRail.viewerName, email: "rafa@example.test" }} initialChatRail={brokerRail}><ReferenceHome /></LightChrome></div></section>
    </main>;
  }
  return primaryScreen;
}
