import Link from "next/link";

import { EmptyState } from "@/components/arc/empty-state/empty-state";
import { Button } from "@/components/ui/button";
import { LightLeadDetail } from "@/features/broker-workspace/components/light-lead-detail";
import { stageLabel } from "@/features/broker-workspace/components/light-lead-detail/format";
import { arrivalView, nextStepFor } from "@/features/broker-workspace/chat/lead-arrival";
import { LeadHeaderBar, NextStepCard } from "@/features/broker-workspace/chat/lead-screen-parts";
import { LeadSocialLayout } from "@/features/broker-workspace/chat/lead-social-layout";
import type { ConfirmationDocument, LightLeadDetailData, LiteRequirement } from "@/features/broker-workspace/components/light-lead-detail/types";
import type { TeamConversationDetail } from "@/features/team-conversations/types";
import { ManagerLeadTransferForm, type TransferBroker } from "@/features/manager-workspace/manager-lead-transfer-form";
import { ManagerLeadStatusSheet } from "@/features/manager-workspace/manager-lead-status-sheet";


import { TeamLeadConversation } from "./team-lead-conversation";

const timelineLabels: Record<string, string> = {
  status_change: "Mudança de etapa",
  note: "Nota",
  service_started: "Atendimento iniciado",
  system_alert: "Aviso do sistema",
  quote_generated: "Cotação gerada",
  document_upload: "Documento enviado",
  document_review: "Documento revisado",
  distributed: "Lead distribuído",
  accepted: "Lead aceito",
  declined: "Lead recusado",
};

function timelineLabel(tipo: string) {
  return timelineLabels[tipo] ?? "Atualização";
}

type TimelineItem = { id: string; tipo: string; conteudo: string | null; userName: string | null; createdAt: Date | string };
type TaskItem = { id: string; title: string; dueAt: Date | null; completedAt: Date | null; priority: string };
type DocumentItem = { id: string; filename: string; status: string; requirementName: string | null };

const documentStatusLabels: Record<string, string> = { pending: "Pendente", uploaded: "Enviado", approved: "Aprovado", rejected: "Recusado" };

function LeadTasksAndDocuments({ tasks, documents }: { tasks: TaskItem[]; documents: DocumentItem[] }) {
  const dateFormat = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: "America/Sao_Paulo" });
  return <div className="grid gap-6 sm:grid-cols-2">
    <section className="flex flex-col gap-3" aria-labelledby="lead-tasks-title">
      <h2 id="lead-tasks-title" className="text-base font-semibold text-(--foreground)">Tarefas ({tasks.length})</h2>
      {tasks.length ? <ul className="grid gap-3">{tasks.map((task) => <li key={task.id} className="flex flex-col gap-1">
        <strong className={`text-sm font-medium ${task.completedAt ? "text-(--text-muted) line-through" : "text-(--foreground)"}`}>{task.title}</strong>
        <span className="text-xs text-(--text-secondary)">{task.completedAt ? "Concluída" : task.dueAt ? `Prazo ${dateFormat.format(new Date(task.dueAt))}` : "Sem prazo"}</span>
      </li>)}</ul> : <p className="text-sm text-(--text-secondary)">Nenhuma tarefa para este lead.</p>}
    </section>
    <section className="flex flex-col gap-3" aria-labelledby="lead-documents-title">
      <h2 id="lead-documents-title" className="text-base font-semibold text-(--foreground)">Documentos ({documents.length})</h2>
      {documents.length ? <ul className="grid gap-3">{documents.map((document) => <li key={document.id} className="flex flex-col gap-1">
        <strong className="text-sm font-medium text-(--foreground)">{document.filename}</strong>
        <span className="text-xs text-(--text-secondary)">{[document.requirementName, documentStatusLabels[document.status] ?? document.status.replaceAll("_", " ")].filter(Boolean).join(" · ")}</span>
      </li>)}</ul> : <p className="text-sm text-(--text-secondary)">Nenhum documento enviado.</p>}
    </section>
  </div>;
}

function LeadTimeline({ items }: { items: TimelineItem[] }) {
  const dateFormat = new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Sao_Paulo" });
  return <section className="flex flex-col gap-3" aria-labelledby="lead-timeline-title">
    <h2 id="lead-timeline-title" className="text-base font-semibold text-(--foreground)">Linha do tempo</h2>
    {items.length ? <ol className="grid gap-4">{items.map((item) => <li key={item.id} className="flex flex-col gap-1">
      <span className="text-sm font-medium text-(--foreground)">{timelineLabel(item.tipo)}</span>
      {item.conteudo ? <p className="break-words text-sm text-(--text-secondary)">{item.conteudo}</p> : null}
      <time className="text-xs text-(--text-muted)" dateTime={new Date(item.createdAt).toISOString()}>{item.userName ? `${item.userName} · ` : ""}{dateFormat.format(new Date(item.createdAt))}</time>
    </li>)}</ol> : <EmptyState title="Ainda não há atualizações neste lead" description="As próximas atividades aparecem aqui." />}
  </section>;
}

export function SupervisorLeadDetail({ lead, lightLead, requirements, leadDocuments, conversation, brokerWhatsAppConnected, timeline, now, managerBrokers, tasks, documents }: {
  lead: { id: string; name: string; status: string; ownerId: string | null; ownerName: string | null; ownerImage: string | null; productName: string | null; assignedAt: Date | null; branchName: string | null };
  lightLead: LightLeadDetailData;
  requirements: LiteRequirement[];
  leadDocuments: ConfirmationDocument[];
  conversation: TeamConversationDetail;
  brokerWhatsAppConnected: boolean;
  timeline: TimelineItem[];
  now: string;
  managerBrokers?: TransferBroker[];
  tasks?: TaskItem[];
  documents?: DocumentItem[];
}) {
  const nowDate = new Date(now);
  const isManager = Boolean(managerBrokers);
  const arrival = lead.assignedAt ? arrivalView({ arrivedAt: new Date(lead.assignedAt), now: nowDate, viewer: "management", ownerName: lead.ownerName }) : null;
  // The chat is ascending: the last message of each side is the latest one.
  const lastClient = [...conversation.messages].reverse().find((message) => message.fromClient);
  const lastBroker = [...conversation.messages].reverse().find((message) => !message.fromClient && !message.byAi);
  const step = nextStepFor({
    viewer: "management",
    owned: true,
    accepted: lightLead.status !== "distributed" && lightLead.status !== "new",
    closed: lightLead.status === "converted" || lightLead.status === "lost",
    ownerName: lead.ownerName,
    lastClientAt: lastClient ? new Date(lastClient.at) : null,
    lastBrokerAt: lastBroker ? new Date(lastBroker.at) : null,
    nextAction: null,
    now: nowDate,
  });

  const firstName = lead.ownerName?.split(" ")[0] ?? "corretor";
  const cobrar = lead.ownerId ? `/relacionamento?brokerId=${encodeURIComponent(lead.ownerId)}&leadId=${encodeURIComponent(lead.id)}&action=reminder` : null;
  const repassarHref = `/equipe/repassar?lead=${encodeURIComponent(lead.id)}`;
  // The waiting client is the one thing to act on: its button sits on the card, and the group leaves it out.
  const urgentWait = !isManager && step.kind === "wait" && step.tone === "urgent";
  const cardAction = urgentWait
    ? (cobrar
      ? <Button render={<Link href={cobrar} />}>Cobrar {firstName}</Button>
      : <Button variant="outline" render={<Link href={repassarHref} />}>Repassar</Button>)
    : undefined;
  const showRepassar = !isManager && !(urgentWait && !cobrar);
  const showCobrar = !isManager && Boolean(cobrar) && !(urgentWait && cobrar);

  return (
    <div className="arc-venancor h-full min-h-0">
      <LeadSocialLayout
        header={
          <div className="flex flex-col gap-3">
            <Link href="/leads" className="w-max text-sm text-(--text-muted) hover:text-(--foreground)">{isManager ? "← Leads da unidade" : "← Leads da equipe"}</Link>
            <LeadHeaderBar name={lead.name} statusLabel={stageLabel(lightLead.status)} arrival={arrival} subline={lead.ownerName ? `Com ${lead.ownerName}` : "Sem corretor"} />
          </div>
        }
        next={
          <div className="flex flex-col gap-4">
            <NextStepCard step={step} action={cardAction} />
            {isManager ? (
              <div className="flex flex-col gap-3" aria-label="Ações de gestão">
                <div className="flex flex-wrap gap-2"><ManagerLeadStatusSheet leadId={lead.id} leadName={lead.name} currentStatus={lead.status} /></div>
                <ManagerLeadTransferForm leadId={lead.id} leadName={lead.name} brokers={managerBrokers ?? []} />
              </div>
            ) : showRepassar || showCobrar ? (
              <div className="flex flex-wrap gap-2" aria-label="Ações de gestão">
                {showRepassar ? <Button variant="outline" render={<Link href={repassarHref} />}>Repassar</Button> : null}
                {showCobrar && cobrar ? <Button render={<Link href={cobrar} />}>Cobrar {firstName}</Button> : null}
              </div>
            ) : null}
          </div>
        }
        details={<LightLeadDetail variant="details" mode="management" lead={lightLead} requirements={requirements} documents={leadDocuments} />}
        side={
          <div className="flex flex-col gap-4">
            {lead.ownerId && !isManager ? <Link className="w-max text-sm font-medium text-(--chat-action-text)" href={`/equipe/${encodeURIComponent(lead.ownerId)}`}>Ver corretor</Link> : null}
            {tasks && documents ? <LeadTasksAndDocuments tasks={tasks} documents={documents} /> : null}
            <LeadTimeline items={timeline} />
          </div>
        }
        conversation={<TeamLeadConversation conversation={conversation} brokerWhatsAppConnected={brokerWhatsAppConnected} fill />}
      />
    </div>
  );
}
