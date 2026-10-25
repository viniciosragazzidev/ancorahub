/** Telas da Onda 6 (configuração) na moldura real: ?tela=<chave> escolhe a tela e a rota que o menu marca. Só desenvolvimento. */
import type { ReactNode } from "react";

import {
  ChecklistsShellScreen,
  ComissoesShellScreen,
  ExtensaoShellScreen,
  FluxoShellScreen,
  FluxosWhatsappShellScreen,
  IntegracoesShellScreen,
  MensagensShellScreen,
  QualificacaoShellScreen,
  SituacoesShellScreen,
  TurboShellScreen,
  WahaShellScreen,
  WhatsappDiretoriaShellScreen,
  WhatsappMateriaisShellScreen,
  WhatsappShellScreen,
} from "./onda6-config-screens";
import { SettingsShellScreen } from "./onda6-settings-screens";

export const ONDA6_SCREENS: Record<string, { path: string; render: () => ReactNode }> = {
  configuracoes: { path: "/settings", render: () => <SettingsShellScreen /> },
  checklists: { path: "/settings/feedback-templates", render: () => <ChecklistsShellScreen /> },
  extensao: { path: "/settings/extension", render: () => <ExtensaoShellScreen /> },
  waha: { path: "/settings/waha-diagnostic", render: () => <WahaShellScreen /> },
  integracoes: { path: "/integrations", render: () => <IntegracoesShellScreen /> },
  whatsapp: { path: "/integrations/whatsapp", render: () => <WhatsappShellScreen /> },
  "whatsapp-diretoria": { path: "/integrations/whatsapp", render: () => <WhatsappDiretoriaShellScreen /> },
  "whatsapp-materiais": { path: "/integrations/whatsapp", render: () => <WhatsappMateriaisShellScreen /> },
  comissoes: { path: "/configuracoes/comissoes", render: () => <ComissoesShellScreen /> },
  situacoes: { path: "/atendimento/situacoes", render: () => <SituacoesShellScreen /> },
  mensagens: { path: "/atendimento/mensagens", render: () => <MensagensShellScreen /> },
  fluxo: { path: "/atendimento/fluxo", render: () => <FluxoShellScreen /> },
  qualificacao: { path: "/qualificacao", render: () => <QualificacaoShellScreen /> },
  turbo: { path: "/qualificacao/turbo", render: () => <TurboShellScreen /> },
  "fluxos-whatsapp": { path: "/fluxos-whatsapp", render: () => <FluxosWhatsappShellScreen /> },
};
