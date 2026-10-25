/** Telas da Onda 10 na moldura real: ?tela=<chave> escolhe a tela e a rota que o menu marca. Só desenvolvimento. */
import type { ReactNode } from "react";

import { DrillShellScreen } from "./onda3-screens";
import { ArquivadosShellScreen, ClientesShellScreen, VisaoConversasShellScreen, VisaoLeadsShellScreen } from "./onda10-screens";

export const ONDA10_SCREENS: Record<string, { path: string; render: () => ReactNode }> = {
  clientes: { path: "/clientes", render: () => <ClientesShellScreen /> },
  arquivados: { path: "/leads/arquivados", render: () => <ArquivadosShellScreen /> },
  "drill-painel": { path: "/dashboard/drill/stale-negotiations", render: () => <DrillShellScreen /> },
  "visao-conversas": { path: "/conversas/dashboard", render: () => <VisaoConversasShellScreen /> },
  "visao-leads": { path: "/leads/dashboard", render: () => <VisaoLeadsShellScreen /> },
};
