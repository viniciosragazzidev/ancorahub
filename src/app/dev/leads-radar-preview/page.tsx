import { notFound } from "next/navigation";
import { LightChrome } from "@/components/light/light-chrome";
import type { ChatRailData } from "@/features/broker-workspace/chat/chat-rail-data";
import { SupervisorLeadsRadar, type RadarLead, type RadarTeamMember } from "@/features/supervisor-workspace/supervisor-leads-radar";

const now = new Date();
const ago = (minutes: number) => new Date(now.getTime() - minutes * 60_000).toISOString();
const rail: ChatRailData = { viewerName: "Marina Gestora", assistants: [], leads: [], nowIso: now.toISOString(), canQuote: false, leadsBadgeCount: 4 };

const team: RadarTeamMember[] = [
  { id: "b1", name: "Ana Souza", image: null, availability: "available", openCount: 5, late: 1 },
  { id: "b2", name: "Paulo Dias", image: null, availability: "available", openCount: 3, late: 0 },
  { id: "b3", name: "Bruna Soares", image: null, availability: "offline", openCount: 2, late: 1 },
  { id: "b4", name: "Diego Ramos", image: null, availability: "available", openCount: 1, late: 0 },
];
const pme = { id: "t1", name: "PME", colorHue: 210 };
const vip = { id: "t2", name: "Indicação", colorHue: 140 };
const retorno = { id: "t3", name: "Retornar amanhã", colorHue: 30 };
const base = { phone: null, ownerImage: null, stageEnteredAt: null };
const leads: RadarLead[] = [
  { ...base, id: "l1", name: "Carla Mendes", status: "distributed", ownerId: "b1", ownerName: "Ana Souza", productName: "Amil 400", assignedAt: ago(48), firstContactAt: null, tags: [pme] },
  { ...base, id: "l2", name: "Roberto Alves", status: "quote_sent", ownerId: "b2", ownerName: "Paulo Dias", productName: "Bradesco Saúde", assignedAt: ago(60 * 26), firstContactAt: ago(60 * 25), stageEnteredAt: ago(60 * 20), clientWaitingSince: ago(35), tags: [vip] },
  { ...base, id: "l3", name: "Juliana Prado", status: "negotiation", ownerId: "b3", ownerName: "Bruna Soares", productName: "SulAmérica", assignedAt: ago(60 * 24 * 5), firstContactAt: ago(60 * 24 * 5), stageEnteredAt: ago(60 * 24 * 4), overdueTasks: 2, tags: [retorno, pme] },
  { ...base, id: "l4", name: "Marcos Teixeira", status: "distributed", ownerId: "b3", ownerName: "Bruna Soares", productName: null, assignedAt: ago(95), firstContactAt: null },
  { ...base, id: "l5", name: "Fernanda Lopes", status: "distributed", ownerId: "b4", ownerName: "Diego Ramos", productName: "Hapvida", assignedAt: ago(6), firstContactAt: null },
  { ...base, id: "l6", name: "Lucas Martins", status: "in_contact", ownerId: "b1", ownerName: "Ana Souza", productName: "Amil 400", assignedAt: ago(120), firstContactAt: ago(110), stageEnteredAt: ago(110), tags: [pme, vip, retorno] },
  { ...base, id: "l7", name: "Patrícia Rocha", status: "quote_sent", ownerId: "b2", ownerName: "Paulo Dias", productName: "Unimed", assignedAt: ago(200), firstContactAt: ago(190), stageEnteredAt: ago(100) },
  { ...base, id: "l8", name: "Eduardo Nunes", status: "documentation_pending", ownerId: "b1", ownerName: "Ana Souza", productName: "Porto Saúde", assignedAt: ago(60 * 30), firstContactAt: ago(60 * 29), stageEnteredAt: ago(60 * 20), tags: [vip] },
  { ...base, id: "l9", name: "Sabrina Costa", status: "in_contact", ownerId: "b2", ownerName: "Paulo Dias", productName: null, assignedAt: ago(60 * 50), firstContactAt: ago(60 * 49), stageEnteredAt: ago(60 * 40) },
];

export default async function LeadsRadarPreview({ searchParams }: { searchParams: Promise<{ audience?: string; empty?: string; tab?: string }> }) {
  if (process.env.NODE_ENV !== "development") notFound();
  const params = await searchParams;
  const audience = params.audience === "supervisor" ? "supervisor" : "manager";
  const data = { team, leads: params.empty ? [] : leads, funnel: { new: 0, firstContact: 0, service: 0, quote: 0, closing: 0 }, slaMinutes: 15 };
  return (
    <LightChrome audience={audience} user={{ name: audience === "manager" ? "Marina Gestora" : "Rita Supervisora", email: "preview@example.test" }} initialChatRail={rail}>
      <SupervisorLeadsRadar data={data} now={now.toISOString()} audience={audience} initialTab={params.tab === "all" ? "all" : undefined} />
    </LightChrome>
  );
}
