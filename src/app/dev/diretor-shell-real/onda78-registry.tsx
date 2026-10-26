/** Telas das Ondas 7 e 8 na moldura real: ?tela=<chave> escolhe a tela e a rota que o menu marca. Só desenvolvimento. */
import type { ReactNode } from "react";

import {
  AssinaturaShellScreen,
  BoasVindasShellScreen,
  GestaoEquipeShellScreen,
  GestaoShellScreen,
  CampanhaShellScreen,
  CampanhasShellScreen,
  GuiaShellScreen,
  ImportacoesShellScreen,
  MateriaisShellScreen,
  MetaShellScreen,
  ValidadorShellScreen,
  WebhookShellScreen,
} from "./onda78-screens";

export const ONDA78_SCREENS: Record<string, { path: string; render: () => ReactNode }> = {
  campanhas: { path: "/marketing/campanhas", render: () => <CampanhasShellScreen /> },
  campanha: { path: "/marketing/campanhas/camp-1", render: () => <CampanhaShellScreen /> },
  importacoes: { path: "/marketing/importacoes", render: () => <ImportacoesShellScreen /> },
  meta: { path: "/integrations/meta", render: () => <MetaShellScreen /> },
  validador: { path: "/ferramentas/validador-comprovante", render: () => <ValidadorShellScreen withResult={false} /> },
  "validador-resultado": { path: "/ferramentas/validador-comprovante", render: () => <ValidadorShellScreen withResult /> },
  materiais: { path: "/ferramentas/materiais-operadoras", render: () => <MateriaisShellScreen /> },
  assinatura: { path: "/assinatura", render: () => <AssinaturaShellScreen /> },
  guia: { path: "/guia", render: () => <GuiaShellScreen /> },
  webhook: { path: "/guia/webhook", render: () => <WebhookShellScreen /> },
  "boas-vindas": { path: "/welcome", render: () => <BoasVindasShellScreen /> },
  gestao: { path: "/gestao", render: () => <GestaoShellScreen /> },
  "gestao-equipe": { path: "/gestao/equipes/sup-ana", render: () => <GestaoEquipeShellScreen /> },
};
