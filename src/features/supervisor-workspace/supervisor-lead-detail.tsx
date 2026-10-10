import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/arc/avatar/avatar";
import { Badge } from "@/components/arc/badge/badge";
import { EmptyState } from "@/components/arc/empty-state/empty-state";

import styles from "./supervisor-lead-detail.module.css";

type TimelineItem = { id: string; tipo: string; conteudo: string | null; userName: string | null; createdAt: Date | string };

export function SupervisorLeadDetail({ lead, timeline, now }: {
  lead: { id: string; name: string; status: string; ownerId: string | null; ownerName: string | null; ownerImage: string | null; productName: string | null; assignedAt: Date | null; branchName: string | null };
  timeline: TimelineItem[];
  now: string;
}) {
  const since = lead.assignedAt ? new Intl.RelativeTimeFormat("pt-BR", { numeric: "auto" }).format(-Math.max(0, Math.floor((new Date(now).getTime() - lead.assignedAt.getTime()) / 86_400_000)), "day") : "sem atribuição";
  return <div className={`arc-venancor ${styles.page}`}>
    <Link href="/leads" className={styles.back}>← Leads da equipe</Link>
    <header className={styles.header}><div><h1>{lead.name}</h1><p>{lead.productName ?? "Lead da equipe"} · {lead.branchName ?? "Unidade"}</p><Badge>{lead.status.replaceAll("_", " ")}</Badge></div></header>
    <section className={styles.owner} aria-label="Corretor responsável">
      <Avatar name={lead.ownerName ?? "Corretor"} src={lead.ownerImage ?? undefined} size="lg" className={styles.avatar} />
      <div><span>Com o corretor</span><strong>{lead.ownerName ?? "Sem corretor"}</strong><small>{since}</small></div>
      {lead.ownerId ? <Link href={`/equipe/${encodeURIComponent(lead.ownerId)}`}>Ver corretor</Link> : null}
    </section>
    <div className={styles.actions}>
      <Button variant="outline" render={<Link href={`/equipe/repassar?lead=${encodeURIComponent(lead.id)}`} />}>Repassar</Button>
      {lead.ownerId ? <Button render={<Link href={`/relacionamento?brokerId=${encodeURIComponent(lead.ownerId)}&leadId=${encodeURIComponent(lead.id)}&action=reminder`} />}>Cobrar corretor</Button> : null}
    </div>
    <section className={styles.timeline} aria-labelledby="lead-timeline-title"><h2 id="lead-timeline-title">Linha do tempo</h2>
      {timeline.length ? <ol>{timeline.map((item) => <li key={item.id}><span className={styles.dot} /><div><strong>{item.tipo.replaceAll("_", " ")}</strong>{item.conteudo ? <p>{item.conteudo}</p> : null}<small>{item.userName ? `${item.userName} · ` : ""}{new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(item.createdAt))}</small></div></li>)}</ol> : <EmptyState title="Ainda não há atualizações neste lead" description="As próximas atividades aparecem aqui." />}
    </section>
  </div>;
}
