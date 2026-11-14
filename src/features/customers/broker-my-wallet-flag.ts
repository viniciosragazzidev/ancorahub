import "server-only";

import { carteiraFichaLiteLigada } from "@/features/carteira/retorno-servico";
import { getFeatureFlag } from "@/features/system-settings/queries";
import { FEATURE_FLAGS } from "@/shared/feature-flags/catalog";

/**
 * "Minha carteira" (etapa 4a do plano do modo corretor): precisa do Início reorganizado
 * (`feature_broker_navigation_reorg_enabled`) e da carteira Lite (`feature_broker_client_wallet_lite_enabled`).
 * Qualquer uma desligada devolve a carteira de antes. Falha de leitura conta como desligada.
 */
export async function isBrokerMyWalletEnabled(): Promise<boolean> {
  const [navReorg, walletLite] = await Promise.all([
    getFeatureFlag(FEATURE_FLAGS.BROKER_NAV_REORG).catch(() => "false"),
    carteiraFichaLiteLigada().catch(() => false),
  ]);
  return navReorg === "true" && walletLite;
}
