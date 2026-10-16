import Link from "next/link";

import { Badge } from "@/components/arc/badge/badge";
import { EmptyState } from "@/components/arc/empty-state/empty-state";
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
    <section aria-labelledby="team-on-duty-title" className="grid gap-3">
      <h2 id="team-on-duty-title" className="px-1 text-base font-medium">De plantão agora</h2>
      <ul className="grid gap-2">
        {duty.map((item) => (
          <li key={`${item.brokerId}-${item.scheduleName}`} className="flex items-center justify-between gap-3 rounded-2xl bg-(--surface-muted) px-3 py-3">
            <span className="grid min-w-0 gap-1">
              <span className="truncate text-sm font-medium">{item.brokerName}</span>
              <span className="truncate text-xs text-(--text-muted)">
                {item.scheduleName} · {item.startsAt.slice(0, 5)} às {item.endsAt.slice(0, 5)} · {PRESENCE_LABEL[item.presence]}
              </span>
            </span>
            <span className="flex shrink-0 items-center gap-2">
              {item.paused ? <Badge tone="neutral" size="sm">Pausado</Badge> : null}
              <Button render={<Link href={`/plantoes/corretor/${encodeURIComponent(item.brokerId)}`} />} size="sm" variant="outline">Ver plantão</Button>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
