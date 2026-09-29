import { ShieldWarning } from "@/components/huge-icons";
import { Card, CardContent } from "@/components/ui/card";
import { MetaIntegrationView } from "@/features/meta-ads/components/meta-integration-view";
import type { MetaConnectionAssets, MetaConnectionInfo, MetaSyncLogItem } from "@/features/meta-ads/types";

export function MetaIntegrationHub({
  marketing,
  canConfigure,
}: {
  marketing: { connection: MetaConnectionInfo | null; assets: MetaConnectionAssets | null; logs: MetaSyncLogItem[] };
  canConfigure: boolean;
}) {
  return <div className="space-y-6">
    {!canConfigure ? <Card className="border-warning/30 bg-warning/5 shadow-none"><CardContent className="flex items-start gap-3 p-4"><ShieldWarning className="mt-0.5 size-5 shrink-0 text-warning" /><div><p className="font-medium">Visualização operacional</p><p className="mt-1 text-sm text-muted-foreground">Somente o Diretor ou time de Marketing pode iniciar, alterar ou desconectar a integração de Marketing Meta desta corretora.</p></div></CardContent></Card> : null}

    <MetaIntegrationView connection={marketing.connection} assets={marketing.assets} logs={marketing.logs} canConfigure={canConfigure} />
  </div>;
}
