import { PERMISSIONS, hasCapability, type PermissionKey } from "@/shared/auth/permissions";

import { isRoutePermission, routeCatalog, routePermissionKey, type RouteDefinition } from "./routes";

/**
 * Acesso efetivo (04/11, plano docs/implementations/active/2026-11-04-cargos-e-permissoes.md).
 *
 * - Sem cargo: vale o papel (com os extras do jobTitle), como sempre foi.
 * - Com cargo: efetivo = papel ∩ cargo. O cargo só corta, nunca dá o que o papel não tem.
 * - Cargo que não está ativo não libera nada (fail closed).
 * - Para quem tem cargo, rota só abre com a chave `route:<rota>` no cargo (e o papel precisa ter a permissão
 *   base da rota); rota fora do catálogo fica negada.
 */
export type CargoAtribuido = { status: string; permissions: readonly string[] } | null;

export type EffectiveAccess = {
  hasCargo: boolean;
  /** O que o papel permite (piso de segurança). */
  roleCapabilities: ReadonlySet<PermissionKey>;
  /** O que vale de fato: papel, ou papel ∩ cargo. */
  capabilities: ReadonlySet<PermissionKey>;
  routes: ReadonlySet<string>;
};

/** Caminhos que qualquer membro com sessão abre, com ou sem cargo (sem dados do negócio). */
const SEMPRE_LIBERADOS = ["/access-denied", "/welcome"];

export function resolveEffectiveAccess(input: {
  role: string;
  jobTitle?: string | null;
  cargo: CargoAtribuido;
}): EffectiveAccess {
  const doPapel = (Object.keys(PERMISSIONS) as PermissionKey[]).filter((permission) =>
    hasCapability(input.role, permission, input.jobTitle),
  );
  const roleCapabilities = new Set(doPapel);
  if (!input.cargo) return { hasCargo: false, roleCapabilities, capabilities: roleCapabilities, routes: new Set() };
  if (input.cargo.status !== "active")
    return { hasCargo: true, roleCapabilities, capabilities: new Set(), routes: new Set() };
  const doCargo = new Set(input.cargo.permissions);
  return {
    hasCargo: true,
    roleCapabilities,
    capabilities: new Set(doPapel.filter((permission) => doCargo.has(permission))),
    routes: new Set(input.cargo.permissions.filter(isRoutePermission)),
  };
}

export function isAlwaysAllowedPath(pathname: string) {
  return SEMPRE_LIBERADOS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

/**
 * Decide uma rota de primeiro nível. `definition` vem de `getRouteDefinition(pathname)`; `undefined` quer
 * dizer fora do catálogo: aberta para quem não tem cargo (comportamento de sempre), negada para quem tem.
 */
export function canAccessRoute(access: EffectiveAccess, definition: RouteDefinition | undefined): boolean {
  if (!access.hasCargo) {
    if (!definition || definition.legacyOpen) return true;
    return access.capabilities.has(definition.fallbackPermission);
  }
  if (!definition) return false;
  if (!access.routes.has(routePermissionKey(definition.key))) return false;
  // A chave da rota é a concessão do cargo; o papel continua sendo o piso.
  return access.roleCapabilities.has(definition.fallbackPermission);
}

/** Primeira tela liberada, na ordem do catálogo: para onde vai quem tem cargo sem acesso ao Painel. */
export function firstAllowedPath(access: EffectiveAccess): string | null {
  const rota = (routeCatalog as readonly RouteDefinition[]).find((route) => canAccessRoute(access, route));
  return rota?.path ?? null;
}
