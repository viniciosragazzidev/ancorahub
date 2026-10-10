"use client";

import Image from "next/image";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { acceptSupervisorTeamInviteAction, declineSupervisorTeamInviteAction } from "@/features/supervisor-workspace/my-team-actions";

type Invite = { id: string; teamName: string | null; teamImageUrl: string | null; createdAt: string; message: string | null };
type TeamIdentity = { name: string; imageUrl: string | null };

export function SupervisorTeamInvites({ initialInvites, teamIdentity = null, unavailable = false }: { initialInvites: Invite[]; teamIdentity?: TeamIdentity | null; unavailable?: boolean }) {
  const [invites, setInvites] = useState(initialInvites);
  const [feedback, setFeedback] = useState("");
  const [pending, startTransition] = useTransition();

  function respond(inviteId: string, decision: "accept" | "decline") {
    setFeedback("");
    startTransition(async () => {
      const result = decision === "accept"
        ? await acceptSupervisorTeamInviteAction(inviteId)
        : await declineSupervisorTeamInviteAction(inviteId);
      setFeedback(result.message);
      if (result.ok) setInvites((current) => current.filter((invite) => invite.id !== inviteId));
    });
  }

  if (unavailable) return <section className="mx-auto mb-4 w-full max-w-3xl rounded-[var(--radius-panel)] bg-[var(--surface-muted)] p-4 text-[var(--foreground)]" role="status"><h2 className="text-base font-medium">Convites da equipe indisponíveis</h2><p className="mt-1 text-sm text-[var(--text-muted)]">Tente novamente quando a estrutura de equipes estiver disponível.</p></section>;
  if (!invites.length && !teamIdentity && !feedback) return null;

  return (
    <section className="mx-auto mb-4 grid w-full max-w-3xl gap-3 rounded-[var(--radius-panel)] bg-[var(--surface-muted)] p-4 text-[var(--foreground)]" aria-labelledby="supervisor-team-invites-title">
      {teamIdentity ? <div className="flex items-center gap-3 border-b border-[var(--border-subtle)] pb-3">
        {teamIdentity.imageUrl ? <Image src={teamIdentity.imageUrl} alt="" width={40} height={40} unoptimized className="h-10 w-10 rounded-full object-cover" /> : <span aria-hidden="true" className="grid h-10 w-10 place-items-center rounded-full bg-[var(--surface)] text-sm font-medium">{teamIdentity.name.slice(0, 1).toLocaleUpperCase("pt-BR")}</span>}
        <div><h2 className="text-base font-medium">Sua equipe</h2><p className="text-sm text-[var(--text-muted)]">{teamIdentity.name}</p></div>
      </div> : null}
      {invites.length ? <div><h2 id="supervisor-team-invites-title" className="text-base font-medium">Convites para equipe</h2><p className="mt-1 text-sm text-[var(--text-muted)]">Aceite para entrar na equipe ou recuse para continuar livre.</p></div> : null}
      {invites.length ? <ul className="grid gap-2">
        {invites.map((invite) => (
          <li key={invite.id} className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-panel)] bg-[var(--surface)] p-3">
            <div className="flex min-w-0 items-center gap-3">
              {invite.teamImageUrl ? <Image src={invite.teamImageUrl} alt="" width={40} height={40} unoptimized className="h-10 w-10 rounded-full object-cover" /> : <span aria-hidden="true" className="grid h-10 w-10 place-items-center rounded-full bg-[var(--surface-muted)] text-sm font-medium">{invite.teamName?.slice(0, 1).toLocaleUpperCase("pt-BR") ?? "E"}</span>}
              <span className="min-w-0"><strong className="block truncate text-sm font-medium">{invite.teamName ? `Equipe ${invite.teamName}` : "Convite para equipe"}</strong>{invite.message ? <span className="mt-1 block text-xs text-[var(--text-muted)]">{invite.message}</span> : null}<span className="mt-1 block text-xs text-[var(--text-muted)]">Enviado em {new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(new Date(invite.createdAt))}</span></span>
            </div>
            <div className="flex gap-2"><Button disabled={pending} onClick={() => respond(invite.id, "accept")}>Aceitar</Button><Button variant="outline" disabled={pending} onClick={() => respond(invite.id, "decline")}>Recusar</Button></div>
          </li>
        ))}
      </ul> : null}
      {feedback ? <p className="text-sm text-[var(--text-muted)]" role="status">{feedback}</p> : null}
    </section>
  );
}
