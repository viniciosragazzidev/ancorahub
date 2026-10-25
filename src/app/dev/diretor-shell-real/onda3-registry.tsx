/** Telas da Onda 3 na moldura real: ?tela=<chave> escolhe a tela e a rota que o menu marca. Só desenvolvimento. */
import type { ReactNode } from "react";

import { AssistenteShellScreen, DocumentosShellScreen, DrillShellScreen, IntegridadeShellScreen, NocShellScreen, PropostasShellScreen, TarefasShellScreen, VendaShellScreen, VendasShellScreen } from "./onda3-screens";
import { CargosShellScreen, ConvidarShellScreen, EquipeShellScreen, MembroShellScreen, RecuperacoesShellScreen, UnidadeShellScreen, UnidadesShellScreen } from "./onda4-screens";

export const ONDA3_SCREENS: Record<string, { path: string; render: () => ReactNode }> = {
  // Onda 4: equipe e unidades.
  convidar: { path: "/equipe/convidar", render: () => <ConvidarShellScreen /> },
  equipe: { path: "/equipe", render: () => <EquipeShellScreen /> },
  cargos: { path: "/equipe/cargos", render: () => <CargosShellScreen /> },
  membro: { path: "/equipe/user-4", render: () => <MembroShellScreen /> },
  unidades: { path: "/equipe", render: () => <UnidadesShellScreen /> },
  unidade: { path: "/unidades/22222222-2222-4222-8222-222222222222", render: () => <UnidadeShellScreen /> },
  recuperacoes: { path: "/equipe/recuperacoes", render: () => <RecuperacoesShellScreen /> },
  vendas: { path: "/vendas", render: () => <VendasShellScreen /> },
  venda: { path: "/vendas/sale-1", render: () => <VendaShellScreen /> },
  propostas: { path: "/propostas", render: () => <PropostasShellScreen /> },
  documentos: { path: "/documentos", render: () => <DocumentosShellScreen /> },
  drill: { path: "/relatorios/drill/stale-negotiations", render: () => <DrillShellScreen /> },
  integridade: { path: "/integridade", render: () => <IntegridadeShellScreen /> },
  assistente: { path: "/assistente", render: () => <AssistenteShellScreen /> },
  noc: { path: "/noc", render: () => <NocShellScreen /> },
  tarefas: { path: "/tarefas/dashboard", render: () => <TarefasShellScreen /> },
};
