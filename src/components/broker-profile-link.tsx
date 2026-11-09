"use client";

import Link from "next/link";
import { createContext, useContext, type MouseEvent, type ReactNode } from "react";

import { cn } from "@/lib/utils";

/** Quem abre /equipe/[id]: diretor, gestor (unidade) e supervisor (equipe). A própria página confere o escopo. */
const PROFILE_VIEWER_ROLES = new Set(["director", "manager", "supervisor"]);

/** Id sintético dos contatos sem lead em /conversas: não é um corretor. */
const NIL_ID = "00000000-0000-0000-0000-000000000000";

export function canOpenBrokerProfile(viewerRole: string | null | undefined, brokerId: string | null | undefined): brokerId is string {
  return Boolean(brokerId && brokerId !== NIL_ID && viewerRole && PROFILE_VIEWER_ROLES.has(viewerRole));
}

export function brokerProfileHref(brokerId: string) {
  return `/equipe/${encodeURIComponent(brokerId)}`;
}

const ViewerRoleContext = createContext<string | null | undefined>(undefined);

/** Papel de quem vê a tela, para os nomes de corretor lá dentro sem passar a prop em cada nível. */
export function BrokerProfileViewerProvider({ viewerRole, children }: { viewerRole: string | null | undefined; children: ReactNode }) {
  return <ViewerRoleContext.Provider value={viewerRole}>{children}</ViewerRoleContext.Provider>;
}

function stopRowClick(event: MouseEvent<HTMLAnchorElement>) {
  // Dentro de linha ou card clicável: abre o perfil sem abrir a linha também.
  event.stopPropagation();
}

/**
 * Nome do corretor responsável. Vira link para o perfil dele quando quem vê pode abrir perfis;
 * senão (corretor, sem id, contato sem dono) fica texto puro. Herda o estilo do texto em volta.
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
  const contextRole = useContext(ViewerRoleContext);
  const role = viewerRole === undefined ? contextRole : viewerRole;
  const content = children ?? name;
  if (!canOpenBrokerProfile(role, brokerId) || !name) {
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
