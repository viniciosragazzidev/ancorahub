"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { Avatar } from "@/components/arc/avatar/avatar";
import { Badge } from "@/components/arc/badge/badge";
import { BottomSheet } from "@/components/arc/bottom-sheet/bottom-sheet";
import { EmptyState } from "@/components/arc/empty-state/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { revokeInviteAction, resendInviteAction } from "@/app/(dashboard)/equipe/actions";
import type { ManagerLiteTeamData } from "./manager-lite-team-queries";
import styles from "@/features/supervisor-workspace/my-team-page.module.css";

export function ManagerLiteTeam({ initialData }: { initialData: ManagerLiteTeamData }) {
  const [query, setQuery] = useState("");
  const [feedback, setFeedback] = useState("");
  const [pending, startTransition] = useTransition();
  const members = useMemo(() => initialData.members.filter((member) => member.name.toLocaleLowerCase("pt-BR").includes(query.trim().toLocaleLowerCase("pt-BR"))), [initialData.members, query]);

  function invoke(action: typeof resendInviteAction, invitationId: string) {
    setFeedback("");
    const form = new FormData();
    form.set("invitationId", invitationId);
    startTransition(async () => {
      const result = await action({}, form);
      setFeedback(result.error ?? result.message ?? (result.success ? "Ação concluída." : "Não foi possível concluir a ação."));
      if (result.success) window.location.reload();
    });
  }

  return <div className={`arc-venancor ${styles.page}`}>
    <div className={styles.inner}>
      <header className={styles.pageHeader}><div><h1>Minha unidade</h1><p className={styles.muted}>{initialData.unitName ?? "Unidade não configurada"}</p></div></header>
      <section className={styles.teamHero} aria-label="Resumo dos corretores">
        <div className={styles.heroText}><h2>Corretores da unidade</h2><p>Consulte a operação e abra o perfil de cada corretor.</p></div>
        <div className={styles.overview}>
          <span><strong>{initialData.counts.brokers}</strong> corretores</span>
          <span><strong>{initialData.counts.inService}</strong> em atendimento</span>
          <span data-alert={initialData.counts.late > 0}><strong>{initialData.counts.late || "·"}</strong> atrasados</span>
        </div>
      </section>
      <Input aria-label="Buscar corretor por nome" placeholder="Buscar corretor" value={query} onChange={(event) => setQuery(event.target.value)} />
      {feedback ? <p className={styles.feedback} role="status" aria-live="polite">{feedback}</p> : null}
      {members.length ? <ul className={styles.list}>{members.map((member) => <li key={member.id} className={styles.memberCard} data-attention={member.late > 0}>
        {member.status === "pending" ? <div className={styles.memberLink}><Avatar name={member.name} src={member.image ?? undefined} size="lg" className={styles.avatar} /><span>{member.name}<small><Badge size="sm">Convite pendente</Badge></small></span></div> : <Link className={styles.memberLink} href={`/equipe/${encodeURIComponent(member.userId ?? member.id)}`}>
          <Avatar name={member.name} src={member.image ?? undefined} size="lg" status={member.availability === "available" || member.availability === "on_duty" ? "online" : "offline"} className={styles.avatar} />
          <span>{member.name}<small><Badge tone={member.status === "disabled" ? "danger" : member.availability === "available" || member.availability === "on_duty" ? "success" : "neutral"} size="sm">{member.status === "disabled" ? "Desativado" : member.availability === "available" ? "Disponível" : member.availability === "on_duty" ? "Em plantão" : member.availability === "paused" ? "Pausado" : "Fora do ar"}</Badge></small></span>
        </Link>}
        <div className={styles.memberNumbers}><span><strong>{member.inService || "·"}</strong> em atendimento</span>{member.late > 0 ? <Badge tone="danger" size="sm">Atrasado · {member.late}</Badge> : null}</div>
        <BottomSheet className="arc-venancor" trigger={<button type="button" className={styles.memberMenuTrigger} aria-label={`Ações de ${member.name}`}>•••</button>} title={`Ações de ${member.name}`} description="Escolha uma ação para este corretor." closeLabel="Fechar" detents={[0.38, 0.7]}>
          <nav className={styles.sheetList} aria-label="Ações do corretor">
            {member.status !== "pending" ? <Link href={`/equipe/${encodeURIComponent(member.userId ?? member.id)}`} className={styles.sheetRow}><span>Ver perfil</span><small>Informações e operação</small></Link> : null}
            {member.userId ? <Link href={`/relacionamento?brokerId=${encodeURIComponent(member.userId)}`} className={styles.sheetRow}><span>Mandar recado</span><small>Pela Central de relacionamento</small></Link> : null}
            {member.status === "pending" && member.inviteId ? <div className={styles.sheetRow}>
              <Button variant="outline" size="sm" disabled={pending} onClick={() => invoke(resendInviteAction, member.inviteId!)}>Reenviar convite</Button>
              <Button variant="ghost" size="sm" disabled={pending} onClick={() => invoke(revokeInviteAction, member.inviteId!)}>Cancelar convite</Button>
            </div> : null}
          </nav>
        </BottomSheet>
      </li>)}</ul> : <EmptyState title={query ? "Nenhum corretor encontrado" : initialData.unitName ? "Sua unidade ainda não tem corretores" : "Sua unidade ainda não está configurada"} description={query ? "Tente buscar por outro nome." : initialData.unitName ? "Os corretores da unidade aparecerão aqui." : "Peça ao administrador para vincular seu acesso a uma unidade."} />}
    </div>
  </div>;
}
