"use client";

/**
 * Chave de página do Diretor Lite: o provider fica ligado no app inteiro quando a chave está ativa, mas cada tela só
 * troca para o Lite depois de sair do opt-out (`director-lite-routes.ts`). Toda troca de página usa este hook, para
 * não haver tela meio convertida numa rota ainda em opt-out.
 */
import { usePathname } from "next/navigation";

import { useArcScopeEnabled } from "./arc-scope-context";
import { isDirectorLiteRouteOptedOut } from "./director-lite-routes";

export function useDirectorLitePage() {
  const enabled = useArcScopeEnabled();
  const pathname = usePathname();
  return enabled && !isDirectorLiteRouteOptedOut(pathname ?? "/");
}
