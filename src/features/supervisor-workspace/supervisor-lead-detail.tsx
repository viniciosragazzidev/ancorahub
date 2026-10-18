import Link from "next/link";

import { Avatar } from "@/components/arc/avatar/avatar";
import { EmptyState } from "@/components/arc/empty-state/empty-state";
import { Button } from "@/components/ui/button";
import { LightLeadDetail } from "@/features/broker-workspace/components/light-lead-detail";
import type { ConfirmationDocument, LightLeadDetailData, LiteRequirement } from "@/features/broker-workspace/components/light-lead-detail/types";
import type { TeamConversationDetail } from "@/features/team-conversations/types";
import { ManagerLeadTransferForm, type TransferBroker } from "@/features/manager-workspace/manager-lead-transfer-form";
import { ManagerLeadStatusSheet } from "@/features/manager-workspace/manager-lead-status-sheet";

import { LeadSocialLayout } from "@/features/broker-workspace/chat/lead-social-layout";

import { TeamLeadConversation } from "./team-lead-conversation";

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
      <span className="text-sm font-medium text-(--foreground)">{item.tipo.replaceAll("_", " ")}</span>
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
  const since = lead.assignedAt ? new Intl.RelativeTimeFormat("pt-BR", { numeric: "auto" }).format(-Math.max(0, Math.floor((new Date(now).getTime() - lead.assignedAt.getTime()) / 86_400_000)), "day") : "sem atribuição";
  const isManager = Boolean(managerBrokers);

  // Perfil à esquerda (computador) ou no topo (celular); a conversa do WhatsApp ocupa o resto (Vinicios, 17/10).
  const profile = (
  <div className="flex flex-col gap-4">
    <Link href="/leads" className="w-max text-sm text-(--text-muted) hover:text-(--foreground)">{isManager ? "← Leads da unidade" : "← Leads da equipe"}</Link>

    <section className="flex items-center gap-3" aria-label="Corretor responsável">
      <Avatar name={lead.ownerName ?? "Corretor"} src={lead.ownerImage ?? undefined} size="lg" />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-sm text-(--text-secondary)">Com o corretor</span>
        <strong className="truncate text-sm font-semibold">{lead.ownerName ?? "Sem corretor"}</strong>
        <span className="text-xs text-(--text-muted)">{since}</span>
      </div>
      {lead.ownerId && !isManager ? <Link className="text-sm font-medium text-(--chat-action-text)" href={`/equipe/${encodeURIComponent(lead.ownerId)}`}>Ver corretor</Link> : null}
    </section>

    {isManager ? <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2"><ManagerLeadStatusSheet leadId={lead.id} leadName={lead.name} currentStatus={lead.status} /></div>
      <section className="flex flex-col gap-2" aria-label="Repassar lead">
        <h2 className="text-base font-semibold">Repassar lead</h2>
        <ManagerLeadTransferForm leadId={lead.id} leadName={lead.name} brokers={managerBrokers ?? []} />
      </section>
    </div> : <div className="flex flex-wrap gap-2">
      <Button variant="outline" render={<Link href={`/equipe/repassar?lead=${encodeURIComponent(lead.id)}`} />}>Repassar</Button>
      {lead.ownerId ? <Button render={<Link href={`/relacionamento?brokerId=${encodeURIComponent(lead.ownerId)}&leadId=${encodeURIComponent(lead.id)}&action=reminder`} />}>Cobrar corretor</Button> : null}
    </div>}

    <LightLeadDetail lead={lightLead} requirements={requirements} documents={leadDocuments} mode="management" />
    {tasks && documents ? <LeadTasksAndDocuments tasks={tasks} documents={documents} /> : null}
    <LeadTimeline items={timeline} />
  </div>
  );

  return (
  <div className="arc-venancor">
    <LeadSocialLayout profile={profile}>
      <TeamLeadConversation conversation={conversation} brokerWhatsAppConnected={brokerWhatsAppConnected} fill />
    </LeadSocialLayout>
  </div>
  );
}
