"use client";

import Link from "next/link";
import { createContext, useContext, type ComponentProps, type ReactNode } from "react";

import { isManagerRouteAllowed } from "@/features/manager-scope/manager-routes";

/**
 * Links do Painel que respeitam a lista de rotas do gestor de unidade (19/11). O gestor usa o mesmo Painel do
 * diretor; atalho para uma área que ele não abre (distribuição, lista de leads, conversas, vendas, relatórios) some
 * ou vira texto, em vez de levar para um redirecionamento. Plano: docs/implementations/active/2026-11-19-modo-gestor.md
 */
const HrefCheck = createContext<((href: string) => boolean) | null>(null);

export function UnitManagerLinks({ active, children }: { active: boolean; children: ReactNode }) {
  return <HrefCheck.Provider value={active ? isManagerRouteAllowed : null}>{children}</HrefCheck.Provider>;
}

/** O endereço abre para quem está vendo? Fora do gestor de unidade, sempre. */
export function useHrefAllowed() {
  const check = useContext(HrefCheck);
  return (href: string) => !check || check(href);
}

/**
 * Link que só vira link quando o destino abre. Bloqueado: `hideWhenBlocked` some (atalhos e "Ver mais");
 * sem ele, o conteúdo fica no lugar como texto (cartões com números).
 */
export function AllowedLink({ href, hideWhenBlocked = false, className, children, ...rest }: ComponentProps<typeof Link> & { href: string; hideWhenBlocked?: boolean }) {
  const allowed = useHrefAllowed();
  if (allowed(href)) return <Link href={href} className={className} {...rest}>{children}</Link>;
  if (hideWhenBlocked) return null;
  return <div className={className}>{children}</div>;
}
