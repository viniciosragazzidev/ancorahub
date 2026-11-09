"use client";

import Link from "next/link";
import { createContext, useContext, useMemo, type MouseEvent, type ReactNode } from "react";

import { cn } from "@/lib/utils";

/** Quem abre /equipe/[id]: diretor, gestor (unidade) e supervisor (equipe). A própria página confere o escopo. */
const PROFILE_VIEWER_ROLES = new Set(["director", "manager", "supervisor"]);

/** Id sintético dos contatos sem lead em /conversas: não é um corretor. */
const NIL_ID = "00000000-0000-0000-0000-000000000000";

/** Ids dos corretores da equipe do supervisor: só esses perfis ele abre em /equipe/[id]. */
export type BrokerProfileTeam = ReadonlySet<string> | readonly string[] | null | undefined;

function inTeam(team: BrokerProfileTeam, brokerId: string) {
  if (!team) return false;
  return team instanceof Set ? team.has(brokerId) : (team as readonly string[]).includes(brokerId);
}

/**
 * Diretor e gestor: qualquer corretor (a página confere unidade). Supervisor: só corretor da equipe dele;
 * sem a lista da equipe, nada vira link (melhor texto puro do que link para "não é da sua equipe").
 */
export function canOpenBrokerProfile(viewerRole: string | null | undefined, brokerId: string | null | undefined, teamBrokerIds?: BrokerProfileTeam): brokerId is string {
  if (!brokerId || brokerId === NIL_ID || !viewerRole || !PROFILE_VIEWER_ROLES.has(viewerRole)) return false;
  return viewerRole !== "supervisor" || inTeam(teamBrokerIds, brokerId);
}

export function brokerProfileHref(brokerId: string) {
  return `/equipe/${encodeURIComponent(brokerId)}`;
}

type ViewerContextValue = { viewerRole: string | null | undefined; teamBrokerIds: ReadonlySet<string> | null | undefined };

const ViewerRoleContext = createContext<ViewerContextValue>({ viewerRole: undefined, teamBrokerIds: undefined });

/**
 * Papel de quem vê a tela (e, para supervisor, os corretores da equipe dele), para os nomes de corretor lá dentro
 * sem passar a prop em cada nível. Sem `teamBrokerIds`, herda a equipe do provider de fora (o layout do dashboard).
 */
export function BrokerProfileViewerProvider({ viewerRole, teamBrokerIds, children }: { viewerRole: string | null | undefined; teamBrokerIds?: readonly string[] | null; children: ReactNode }) {
  const parent = useContext(ViewerRoleContext);
  const value = useMemo<ViewerContextValue>(() => ({
    viewerRole,
    teamBrokerIds: teamBrokerIds === undefined ? parent.teamBrokerIds : teamBrokerIds ? new Set(teamBrokerIds) : null,
  }), [viewerRole, teamBrokerIds, parent.teamBrokerIds]);
  return <ViewerRoleContext.Provider value={value}>{children}</ViewerRoleContext.Provider>;
}

function stopRowClick(event: MouseEvent<HTMLAnchorElement>) {
  // Dentro de linha ou card clicável: abre o perfil sem abrir a linha também.
  event.stopPropagation();
}

/**
 * Nome do corretor responsável. Vira link para o perfil dele quando quem vê pode abrir esse perfil;
 * senão (corretor, sem id, contato sem dono, supervisor vendo corretor de outra equipe) fica texto puro.
 * Herda o estilo do texto em volta. A equipe do supervisor vem sempre do provider.
 */
export function BrokerProfileLink({
  brokerId,
  name,
  viewerRole,
  className,
  children,
  title,
}: {
  brokerId: string | null | undefined;
  name: string | null | undefined;
  /** Sem a prop, vale o papel do BrokerProfileViewerProvider mais próximo. */
  viewerRole?: string | null;
  className?: string;
  /** Conteúdo exibido; padrão é o próprio nome. */
  children?: ReactNode;
  title?: string;
}) {
  const viewer = useContext(ViewerRoleContext);
  const role = viewerRole === undefined ? viewer.viewerRole : viewerRole;
  const content = children ?? name;
  if (!canOpenBrokerProfile(role, brokerId, viewer.teamBrokerIds) || !name) {
    return className || title ? <span className={className} title={title}>{content}</span> : <>{content}</>;
  }
  return (
    <Link
      href={brokerProfileHref(brokerId)}
      aria-label={`Ver perfil de ${name}`}
      title={title}
      onClick={stopRowClick}
      onKeyDown={(event) => event.stopPropagation()}
      className={cn("text-inherit underline-offset-2 hover:underline focus-visible:underline focus-visible:outline-none", className)}
    >
      {content}
    </Link>
  );
}
