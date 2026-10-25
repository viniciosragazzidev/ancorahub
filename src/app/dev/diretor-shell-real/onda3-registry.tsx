/** Telas da Onda 3 na moldura real: ?tela=<chave> escolhe a tela e a rota que o menu marca. Só desenvolvimento. */
import type { ReactNode } from "react";

import { DocumentosShellScreen, DrillShellScreen, IntegridadeShellScreen, PropostasShellScreen, TarefasShellScreen, VendaShellScreen, VendasShellScreen } from "./onda3-screens";

export const ONDA3_SCREENS: Record<string, { path: string; render: () => ReactNode }> = {
  vendas: { path: "/vendas", render: () => <VendasShellScreen /> },
  venda: { path: "/vendas/sale-1", render: () => <VendaShellScreen /> },
  propostas: { path: "/propostas", render: () => <PropostasShellScreen /> },
  documentos: { path: "/documentos", render: () => <DocumentosShellScreen /> },
  drill: { path: "/relatorios/drill/stale-negotiations", render: () => <DrillShellScreen /> },
  integridade: { path: "/integridade", render: () => <IntegridadeShellScreen /> },
  tarefas: { path: "/tarefas/dashboard", render: () => <TarefasShellScreen /> },
};
