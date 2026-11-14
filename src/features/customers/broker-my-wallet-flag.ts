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

/**
 * "Cliente que já possuo" (DEC-187, etapa 4b): a chave `feature_broker_prior_clients_enabled` (desligada por padrão)
 * sobre a Minha carteira. A migration 0231 é conferida à parte (`isPriorPortfolioSchemaReady`).
 */
export async function isBrokerPriorClientsFlagOn(): Promise<boolean> {
  const [wallet, prior] = await Promise.all([
    isBrokerMyWalletEnabled(),
    getFeatureFlag(FEATURE_FLAGS.BROKER_PRIOR_CLIENTS).catch(() => "false"),
  ]);
  return wallet && prior === "true";
}
