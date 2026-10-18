import Link from "next/link";

import { Badge } from "@/components/arc/badge/badge";
import { EmptyState } from "@/components/arc/empty-state/empty-state";
import { PeopleRow, PeopleSection } from "@/components/light/people-list/people-list";
import { Button } from "@/components/ui/button";

import type { TeamDuty } from "./queries";

const PRESENCE_LABEL: Record<TeamDuty["presence"], string> = {
  confirmed: "presença confirmada",
  pending: "aguardando confirmação",
  absent: "ausente",
  expired: "plantão encerrado",
  not_required: "sem confirmação",
};

/** Quem da equipe está de plantão agora, com o atalho para ver o plantão de cada um (mesma tela que o corretor vê). */
export function TeamOnDutyList({ duty }: { duty: TeamDuty[] }) {
  if (!duty.length) {
    return <EmptyState title="Ninguém de plantão agora" description="Os corretores da equipe que estiverem de plantão aparecem aqui." />;
  }
  return (
    <PeopleSection id="team-on-duty-title" title="De plantão agora" count={duty.length}>
      {duty.map((item, index) => (
        <PeopleRow
          key={`${item.brokerId}-${item.scheduleName}`}
          index={index}
          href={`/plantoes/corretor/${encodeURIComponent(item.brokerId)}`}
          name={item.brokerName}
          chip={item.paused ? <Badge tone="neutral" size="sm">Pausado</Badge> : item.scheduleName}
          preview={`${item.paused ? `${item.scheduleName} · ` : ""}${item.startsAt.slice(0, 5)} às ${item.endsAt.slice(0, 5)} · ${PRESENCE_LABEL[item.presence]}`}
          previewTone={item.presence === "absent" ? "alert" : item.presence === "pending" ? "waiting" : "muted"}
          dot={item.presence === "pending" ? "waiting" : item.presence === "absent" ? "alert" : null}
          dotLabel={item.presence === "pending" ? "Aguardando confirmação" : item.presence === "absent" ? "Ausente" : undefined}
          action={<Button render={<Link href={`/plantoes/corretor/${encodeURIComponent(item.brokerId)}`} />} size="sm" variant="outline">Ver plantão</Button>}
        />
      ))}
    </PeopleSection>
  );
}
