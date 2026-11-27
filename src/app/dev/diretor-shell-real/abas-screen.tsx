/**
 * ?tela=entradas|filas|saude: as abas Entradas e regras, Filas e Saúde da Distribuição no Lite (27/11/2026) com dados de
 * exemplo, montadas no servidor como a página real (assim a prévia pega o mesmo erro de estilo que a produção pegaria).
 */
import { Tab1a1 } from "@/app/(dashboard)/leads/distribuicao/_components/abas-1a1-kit";
import { BrokerAcceptanceSlaPanel } from "@/app/(dashboard)/leads/distribuicao/_components/broker-acceptance-sla-panel";
import { DddRoutingPanel } from "@/app/(dashboard)/leads/distribuicao/_components/ddd-routing-panel";
import { DisqualifiedLeadsRoutingPanel } from "@/app/(dashboard)/leads/distribuicao/_components/disqualified-leads-routing-panel";
import { DistributionHealth1a1 } from "@/app/(dashboard)/leads/distribuicao/_components/health-1a1";
import { QueueControlCenter } from "@/app/(dashboard)/leads/distribuicao/_components/queue-control-center";
import { DistributionHead1a1 } from "@/app/(dashboard)/leads/distribuicao/_components/resumo-1a1-shell";
import { RoutingMatrixPanel } from "@/app/(dashboard)/leads/distribuicao/_components/routing-matrix-panel";
import resumo from "@/app/(dashboard)/leads/distribuicao/_components/resumo-1a1.module.css";
import plantoes from "@/app/(dashboard)/leads/distribuicao/plantao/_components/plantoes-1a1.module.css";
import type { Queue } from "@/app/(dashboard)/leads/distribuicao/_components/queues/types";
import type { RoutingRule } from "@/features/lead-distribution/routing-engine";

const branches = [{ id: "b-20", name: "Matriz 20º Andar" }, { id: "b-ni", name: "Nova Iguaçu" }, { id: "b-nt", name: "Niterói" }];
const queueList = [{ id: "q-pf", name: "Fila PF" }, { id: "q-pme", name: "Fila PME" }, { id: "q-ade", name: "Fila Adesão" }, { id: "q-frios", name: "Leads frios" }];
const brokers = [{ id: "br-1", name: "Vitória Augusto" }, { id: "br-2", name: "Sara Soares" }, { id: "br-3", name: "Raiana Nunes" }];
const day = new Date("2026-11-27T12:00:00Z");

const rules: RoutingRule[] = Array.from({ length: 23 }, (_, index) => ({
  id: `r-${index + 1}`, tenantId: "t", name: ["PME acima de 3 vidas", "Adesão pelo WhatsApp", "Individual Niterói", "Frios para requalificar"][index % 4] + (index >= 4 ? ` ${index + 1}` : ""),
  priority: index + 1, enabled: index % 5 !== 3, distributionMode: index % 6 === 2 ? "manual" : "automatic",
  conditions: index % 4 === 0 ? { planTypes: ["pme"], minLives: 3 } : index % 4 === 1 ? { sources: ["whatsapp"] } : index % 4 === 2 ? { cities: ["Niterói"] } : {},
  targetType: index % 3 === 0 ? "queue" : index % 3 === 1 ? "branch" : "all_branches", targetId: index % 3 === 0 ? "q-pme" : index % 3 === 1 ? "b-nt" : "all",
  fallbackQueueId: index % 2 ? "q-pf" : null, createdAt: day, updatedAt: day,
})) as RoutingRule[];

const queues: Queue[] = [
  ["q-pf", "Fila PF", "b-20", "active", "automatic", "round_robin", 22, 9, 14, 210],
  ["q-pme", "Fila PME", null, "active", "automatic", "least_load", 4, 18, 31, 30],
  ["q-ade", "Fila Adesão", "b-ni", "active", "automatic", "round_robin", 0, 6, 8, 150],
  ["q-frios", "Leads frios", null, "active", "manual", "round_robin", 31, 0, 0, 260],
  ["q-old", "Fila antiga", "b-nt", "paused", "automatic", "round_robin", 0, 3, 0, 90],
].map(([id, name, branchId, status, assignmentMode, assignmentStrategy, waiting, members, activeLeads, colorHue]) => ({
  id: id as string, name: name as string, branchId: branchId as string | null, branchName: branches.find((b) => b.id === branchId)?.name ?? null,
  status: status as string, assignmentMode: assignmentMode as string, assignmentStrategy: assignmentStrategy as string,
  capacityEnabled: true, capacityPerBroker: 8, maxPendingOffersPerBroker: 1, aiQualificationEnabled: true, holdColdLeads: id === "q-pf",
  waiting: waiting as number, members: members as number, activeLeads: activeLeads as number, colorHue: colorHue as number,
  exclusiveDutyScheduleIds: id === "q-pf" ? ["d-1"] : [], allowedSourceIds: [], allowedBrokerIds: [],
}));

const events = Array.from({ length: 27 }, (_, index) => ({
  id: `e-${index}`, leadName: ["Ana Ribeiro", "Paula Rezende", "Marcos Teixeira", "Rita de Cássia França"][index % 4],
  brokerName: index % 5 === 2 ? null : brokers[index % 3].name, queueName: index % 4 === 3 ? null : queueList[index % 3].name,
  action: ["lead.assigned", "lead_offer_accepted", "lead_returned_to_queue", "lead_offer_expired"][index % 4],
  reason: index % 4 === 2 ? "Corretor não aceitou a tempo" : null,
  createdAt: new Date(day.getTime() - index * 7 * 60_000).toISOString(),
}));

export function AbasShellScreen({ tab }: { tab: "entradas" | "filas" | "saude" }) {
  const body = tab === "entradas" ? (
    <Tab1a1
      title="Entradas e regras"
      lead="O que acontece com cada lead antes da oferta: quem segura, para qual fila vai e em que ordem as regras valem."
      stats={[
        { key: "disq", label: "Desqualificados", text: true, value: "Retidos", hint: "ficam em espera antes da oferta", tone: "success", panel: <DisqualifiedLeadsRoutingPanel initialHoldDisqualifiedLeads canEdit /> },
        { key: "ddd", label: "Regra de DDD", text: true, value: "Ligada", hint: "3 DDDs válidos", tone: "success", panel: <DddRoutingPanel initialSettings={{ enabled: true, validDdds: ["21", "22", "24"], queues: { valid: "q-pf", invalid: null, unknown: null } }} queues={queueList} canEdit /> },
        { key: "rules", label: "Regras de roteamento", value: rules.length, hint: "em ordem de prioridade, na lista abaixo" },
      ]}
    >
      <RoutingMatrixPanel rules={rules} queues={queueList} branches={branches} brokers={brokers} canEdit />
    </Tab1a1>
  ) : tab === "filas" ? (
    <Tab1a1
      title="Filas"
      lead="Quem recebe cada lead, em que ordem e com quanto tempo para aceitar."
      stats={[
        { key: "queues", label: "Filas ativas", value: 4, hint: "57 leads esperando" },
        { key: "sla", label: "Prazo de aceite", value: "15 min", hint: "depois disso, passa para o próximo", panel: <BrokerAcceptanceSlaPanel initialMinutes={15} initialAutoRedistribute canEdit /> },
        { key: "ranking", label: "Distribuição inteligente", text: true, value: "Ordem da fila", hint: "sem ranking depois do plantão", tone: "neutral" },
      ]}
    >
      <QueueControlCenter
        queues={queues}
        branches={branches}
        brokers={brokers.map((broker) => ({ ...broker, branchId: "b-20", branchName: "Matriz 20º Andar" }))}
        dutySchedules={[{ id: "d-1", name: "Adesão Online", startsAt: "09:00", endsAt: "18:00", dayOfWeek: 5 }]}
        campaigns={[]}
        ads={[]}
        campaignRoutes={[]}
        adRoutes={[]}
        canEdit
      />
    </Tab1a1>
  ) : (
    <Tab1a1
      title="Saúde"
      lead="Se o motor de distribuição está rodando e o que ficou para revisão."
      stats={[
        { key: "engine", label: "Motor de distribuição", text: true, value: "Ativo", tone: "success" },
        { key: "pending", label: "Pendências", value: 3, hint: "o motor tenta de novo sozinho" },
        { key: "failed", label: "Exceções", value: 1, hint: "pedem revisão da gestão", tone: "danger" },
        { key: "events", label: "Decisões recentes", value: events.length, hint: "atribuições e redistribuições" },
      ]}
    >
      <DistributionHealth1a1
        events={events}
        jobs={{ pending: 2, retrying: 1, processing: 0, failed: 0, completed: 412 }}
        jobsAvailable
        jobsEnabled
        effects={{ pending: 0, retrying: 0, processing: 1, failed: 1, completed: 980 }}
        failedEffects={[{ id: "f-1", leadName: "Marcos Teixeira", type: "update_meta_status", attemptCount: 5, lastErrorCode: "meta_401", lastErrorMessage: "A Meta recusou o token da página." }]}
      />
    </Tab1a1>
  );
  return (
    <main className={`arc-venancor ${resumo.gx} ${resumo.page}`} data-skin="diretor">
      <DistributionHead1a1 available={38} waiting={12} />
      <div className={plantoes.gx} style={{ display: "contents" }}>{body}</div>
    </main>
  );
}
