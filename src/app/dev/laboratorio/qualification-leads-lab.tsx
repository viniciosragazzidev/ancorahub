"use client";

/**
 * Laboratório: Etapa do lead (recuperação, fase 1). A tela real de /qualificacao/leads com um lead simulado em cada
 * etapa (Q1 a N7, R1 a R3, X1). A linha do tempo e o "Não contatar" são simulados pelo DevLab; nada vai ao banco.
 */
import { buildQualificationRow, type QualificationLeadSource } from "@/features/lead-journey/rows";
import { QualificationLeadsWorkspace } from "@/features/lead-journey/components/qualification-leads-workspace";
import type { TimelineItem } from "@/features/lead-journey/timeline";

const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();

function source(partial: Partial<QualificationLeadSource> & Pick<QualificationLeadSource, "id" | "nome">): QualificationLeadSource {
  return {
    telefone: "5521998836148", status: "new", qualification_status: "pending", corretor_id: null, assigned_at: null, first_contact_at: null,
    distribution_status: "unassigned", created_at: minutesAgo(90), source_channel: "meta_lead_ads", lives_count: null, queue_id: "q1", queue_name: "Plantão Rio",
    broker_name: null, turbo: null, recovery: null, opt_out_at: null, wrong_number_at: null, collected_fields: [], inbound_count: 0,
    last_inbound_at: null, last_ai_at: null, first_ai_at: null, silence_sent: false, ...partial,
  };
}

const turbo = (sentTouches: number, firstMinutesAgo: number) => ({
  firstContactAt: minutesAgo(firstMinutesAgo),
  touches: [{ touch: "t0", status: "sent", at: minutesAgo(firstMinutesAgo) }, ...["t1", "t2", "t3", "t4"].slice(0, sentTouches).map((touch, index) => ({ touch, status: "sent", at: minutesAgo(firstMinutesAgo - 20 - index * 60) }))],
});

export const LAB_QUALIFICATION_SOURCES: QualificationLeadSource[] = [
  source({ id: "lab-q1", nome: "Ana Chegou", created_at: minutesAgo(1) }),
  source({ id: "lab-q2", nome: "Bruno Contatado", turbo: turbo(0, 8), first_ai_at: minutesAgo(8), last_ai_at: minutesAgo(8) }),
  source({ id: "lab-q3", nome: "Carla Conversa", qualification_status: "qualifying", inbound_count: 3, first_ai_at: minutesAgo(30), last_inbound_at: minutesAgo(3), last_ai_at: minutesAgo(2), collected_fields: ["planType", "numberOfLives"] }),
  source({ id: "lab-r2", nome: "Andréia Parou", qualification_status: "cold", inbound_count: 2, first_ai_at: minutesAgo(200), last_inbound_at: minutesAgo(140), last_ai_at: minutesAgo(130), collected_fields: ["planType", "numberOfLives"], silence_sent: true }),
  source({ id: "lab-r1", nome: "Diego Nunca", qualification_status: "cold", turbo: turbo(2, 300), first_ai_at: minutesAgo(300), last_ai_at: minutesAgo(180) }),
  source({ id: "lab-r1b", nome: "Elisa Fim dos lembretes", qualification_status: "cold", turbo: { ...turbo(4, 5000), stoppedAt: minutesAgo(10), stopReason: "finished" }, first_ai_at: minutesAgo(5000), last_ai_at: minutesAgo(800) }),
  source({ id: "lab-r3", nome: "Fábio Morno", qualification_status: "warm", inbound_count: 4, first_ai_at: minutesAgo(90), last_inbound_at: minutesAgo(40), last_ai_at: minutesAgo(39), collected_fields: ["planType", "numberOfLives", "age"] }),
  source({ id: "lab-q4", nome: "Gabi Quente", qualification_status: "hot", distribution_status: "manual_hold", inbound_count: 6, last_inbound_at: minutesAgo(20), first_ai_at: minutesAgo(60), first_inbound_at: minutesAgo(55), score_memory: { planType: { value: "empresarial" }, numberOfLives: { value: "8" }, averageAge: { value: "34" } } }),
  source({ id: "lab-q5", nome: "Hugo Na fila", qualification_status: "qualified", distribution_status: "queued", inbound_count: 5, last_inbound_at: minutesAgo(5) }),
  source({ id: "lab-n1", nome: "Iara 1º contato atrasado", status: "distributed", qualification_status: "hot", corretor_id: "u1", broker_name: "Vinicios Ragazzi", assigned_at: minutesAgo(27), inbound_count: 5 }),
  source({ id: "lab-n2", nome: "João Cotação", status: "quote_sent", qualification_status: "hot", corretor_id: "u1", broker_name: "Ana Paula", assigned_at: minutesAgo(600), first_contact_at: minutesAgo(590), inbound_count: 8 }),
  source({ id: "lab-n6", nome: "Karen Ganho", status: "converted", qualification_status: "hot", corretor_id: "u1", broker_name: "Ana Paula", inbound_count: 9 }),
  source({ id: "lab-r4", nome: "Marina Fila de ligação", qualification_status: "cold", recovery: { state: "call_queue", at: minutesAgo(30), score: "A2" }, turbo: { ...turbo(4, 6000), stoppedAt: minutesAgo(40), stopReason: "finished" }, score_memory: { planType: { value: "empresarial" }, numberOfLives: { value: "5" } }, operator: "Amil" }),
  source({ id: "lab-r6", nome: "Nina Nutrição", qualification_status: "cold", recovery: { state: "nurture", at: minutesAgo(60 * 24 * 3), until: new Date(Date.now() + 27 * 86_400_000).toISOString(), touches: 1 }, inbound_count: 3 }),
  source({ id: "lab-x1", nome: "Lucas Saiu", qualification_status: "cold", opt_out_at: minutesAgo(60), inbound_count: 1, last_inbound_at: minutesAgo(60) }),
];

const LAB_TIMELINE: TimelineItem[] = [
  { id: "1", at: minutesAgo(5), kind: "touch", title: "Lembrete T2 (3 h)", detail: "anc_t2_beneficio", channel: "Meta", outcome: "Pulado: template não aprovado na Meta" },
  { id: "2", at: minutesAgo(120), kind: "stage", title: "Virou frio e ficou segurado", detail: null, channel: null, outcome: null },
  { id: "3", at: minutesAgo(122), kind: "touch", title: "Follow-up de silêncio", detail: "Andréia, consegue me dizer a idade de quem vai usar o plano? Assim eu já calculo pra você agora mesmo.", channel: "WAHA", outcome: null },
  { id: "4", at: minutesAgo(130), kind: "ai", title: "IA", detail: "Quantos anos tem quem vai usar o plano?", channel: "WAHA", outcome: null },
  { id: "5", at: minutesAgo(140), kind: "data", title: "Dado: Vidas", detail: "3", channel: null, outcome: null },
  { id: "6", at: minutesAgo(140), kind: "customer", title: "Cliente", detail: "Somos 3, eu meu marido e minha filha", channel: "WAHA", outcome: null },
  { id: "7", at: minutesAgo(200), kind: "ai", title: "IA", detail: "Oi, Andréia! Aqui é a Ana, da Âncora Saúde. O plano é só pra você, pra família ou pra empresa?", channel: "WAHA", outcome: null },
];

export function labQualificationServices(delay: number, failing: boolean) {
  const wait = () => new Promise((resolve) => setTimeout(resolve, delay));
  return {
    timeline: async () => {
      await wait();
      return failing ? { ok: false as const, error: "Não consegui carregar a linha do tempo agora." } : { ok: true as const, data: { items: LAB_TIMELINE } };
    },
    toCallQueue: async () => {
      await wait();
      return failing ? { ok: false as const, error: "Não consegui mandar para a fila agora." } : { ok: true as const, data: { score: "B2" } };
    },
    badMoment: async () => {
      await wait();
      return failing ? { ok: false as const, error: "Não consegui marcar agora." } : { ok: true as const, data: { until: new Date(Date.now() + 30 * 86_400_000).toISOString() } };
    },
    doNotContact: async () => {
      await wait();
      return failing ? { ok: false as const, error: "Não consegui marcar agora." } : { ok: true as const, data: null };
    },
  };
}

export function QualificationLeadsLab() {
  const now = new Date();
  const rows = LAB_QUALIFICATION_SOURCES.map((item) => buildQualificationRow(item, now));
  return (
    <main className="arc-venancor mx-auto flex max-w-6xl flex-col gap-ds-16 p-ds-24 font-ds-inter">
      <QualificationLeadsWorkspace rows={rows} nowIso={now.toISOString()} />
    </main>
  );
}
