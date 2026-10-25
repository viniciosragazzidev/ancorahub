/** Telas da Onda 6 (configuração) na moldura real: ?tela=<chave> escolhe a tela e a rota que o menu marca. Só desenvolvimento. */
import type { ReactNode } from "react";

import { SettingsShellScreen } from "./onda6-settings-screens";

export const ONDA6_SCREENS: Record<string, { path: string; render: () => ReactNode }> = {
  configuracoes: { path: "/settings", render: () => <SettingsShellScreen /> },
};
