import "server-only";

import type { TenantContext } from "@/shared/auth/types";

import { getLiveStatuses } from "../service";
import { LiveStatusHost } from "./live-status-host";

/**
 * A faixa "Agora na operação" pronta para a tela, ou null. Chave da empresa desligada, papel sem escopo ou nada para
 * mostrar: null, e a tela não ganha nenhum elemento (HTML igual ao de hoje). Erro de leitura também vira null.
 */
export async function loadLiveStatusSlot(context: TenantContext, options: { className?: string } = {}) {
  const payload = await getLiveStatuses(context).catch((error) => {
    console.warn("[live-status] strip unavailable", { message: error instanceof Error ? error.message.slice(0, 160) : "unknown" });
    return null;
  });
  if (!payload || (!payload.statuses.length && !payload.seals.length)) return null;
  return <LiveStatusHost initial={payload} className={options.className} />;
}
