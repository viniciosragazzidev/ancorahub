import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/arc/avatar/avatar";
import { Badge } from "@/components/arc/badge/badge";
import { EmptyState } from "@/components/arc/empty-state/empty-state";
import { ManagerLeadTransferForm } from "@/features/manager-workspace/manager-lead-transfer-form";
import { LEAD_STATUS_LABELS } from "@/features/leads/lead-status-constants";

import styles from "./supervisor-lead-detail.module.css";

type TimelineItem = { id: string; tipo: string; conteudo: string | null; userName: string | null; createdAt: Date | string };
type TaskItem = { id: string; title: string; dueAt: Date | null; completedAt: Date | null; priority: string };
type DocumentItem = { id: string; filename: string; status: string; requirementName: string | null };

const documentStatusLabels: Record<string, string> = { pending: "Pendente", uploaded: "Enviado", approved: "Aprovado", rejected: "Recusado" };

/** Tarefas e documentos do lead no gestor Lite: leitura, na mesma linguagem das listas da unidade. */
function LeadTasksAndDocuments({ tasks, documents }: { tasks: TaskItem[]; documents: DocumentItem[] }) {
  const dateFormat = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: "America/Sao_Paulo" });
  return <>
    <section className={styles.timeline} aria-labelledby="lead-tasks-title"><h2 id="lead-tasks-title">Tarefas ({tasks.length})</h2>
      {tasks.length ? <ul className={styles.rows}>{tasks.map((task) => <li key={task.id}><strong className={task.completedAt ? styles.done : undefined}>{task.title}</strong><small>{task.completedAt ? "Concluída" : task.dueAt ? `Prazo ${dateFormat.format(new Date(task.dueAt))}` : "Sem prazo"}</small></li>)}</ul> : <p className={styles.empty}>Nenhuma tarefa para este lead.</p>}
    </section>
    <section className={styles.timeline} aria-labelledby="lead-documents-title"><h2 id="lead-documents-title">Documentos ({documents.length})</h2>
      {documents.length ? <ul className={styles.rows}>{documents.map((document) => <li key={document.id}><strong>{document.filename}</strong><small>{[document.requirementName, documentStatusLabels[document.status] ?? document.status.replaceAll("_", " ")].filter(Boolean).join(" · ")}</small></li>)}</ul> : <p className={styles.empty}>Nenhum documento enviado.</p>}
    </section>
  </>;
}

export function SupervisorLeadDetail({ lead, timeline, now, managerBrokers, tasks, documents }: {
  lead: { id: string; name: string; status: string; ownerId: string | null; ownerName: string | null; ownerImage: string | null; productName: string | null; assignedAt: Date | null; branchName: string | null };
  timeline: TimelineItem[];
  now: string;
  managerBrokers?: { id: string; name: string }[];
  /** Gestor Lite only: the lead's tasks and documents (the supervisor view leaves them out). */
  tasks?: TaskItem[];
  documents?: DocumentItem[];
}) {
  const since = lead.assignedAt ? new Intl.RelativeTimeFormat("pt-BR", { numeric: "auto" }).format(-Math.max(0, Math.floor((new Date(now).getTime() - lead.assignedAt.getTime()) / 86_400_000)), "day") : "sem atribuição";
  return <div className={`arc-venancor ${styles.page}`}>
    <Link href="/leads" className={styles.back}>{managerBrokers ? "← Leads da unidade" : "← Leads da equipe"}</Link>
    <header className={styles.header}><div><h1>{lead.name}</h1><p>{lead.productName ?? "Lead da equipe"} · {lead.branchName ?? "Unidade"}</p><Badge>{(LEAD_STATUS_LABELS as Record<string, string>)[lead.status] ?? lead.status.replaceAll("_", " ")}</Badge></div></header>
    <section className={styles.owner} aria-label="Corretor responsável">
      <Avatar name={lead.ownerName ?? "Corretor"} src={lead.ownerImage ?? undefined} size="lg" className={styles.avatar} />
      <div><span>Com o corretor</span><strong>{lead.ownerName ?? "Sem corretor"}</strong><small>{since}</small></div>
      {lead.ownerId && !managerBrokers ? <Link href={`/equipe/${encodeURIComponent(lead.ownerId)}`}>Ver corretor</Link> : null}
    </section>
    {managerBrokers ? <section className={styles.timeline} aria-label="Repassar lead"><h2>Repassar lead</h2><ManagerLeadTransferForm leadId={lead.id} leadName={lead.name} brokers={managerBrokers} /></section> : <div className={styles.actions}>
      <Button variant="outline" render={<Link href={`/equipe/repassar?lead=${encodeURIComponent(lead.id)}`} />}>Repassar</Button>
      {lead.ownerId ? <Button render={<Link href={`/relacionamento?brokerId=${encodeURIComponent(lead.ownerId)}&leadId=${encodeURIComponent(lead.id)}&action=reminder`} />}>Cobrar corretor</Button> : null}
    </div>}
    {tasks && documents ? <LeadTasksAndDocuments tasks={tasks} documents={documents} /> : null}
    <section className={styles.timeline} aria-labelledby="lead-timeline-title"><h2 id="lead-timeline-title">Linha do tempo</h2>
      {timeline.length ? <ol>{timeline.map((item) => <li key={item.id}><span className={styles.dot} /><div><strong>{item.tipo.replaceAll("_", " ")}</strong>{item.conteudo ? <p>{item.conteudo}</p> : null}<small>{item.userName ? `${item.userName} · ` : ""}{new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(item.createdAt))}</small></div></li>)}</ol> : <EmptyState title="Ainda não há atualizações neste lead" description="As próximas atividades aparecem aqui." />}
    </section>
  </div>;
}
