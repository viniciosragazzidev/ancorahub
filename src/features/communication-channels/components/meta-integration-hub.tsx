import Link from "next/link";

import { ArrowRight, CheckCircle, Globe, ShieldWarning } from "@/components/huge-icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MetaIntegrationView } from "@/features/meta-ads/components/meta-integration-view";
import type { MetaConnectionAssets, MetaConnectionInfo, MetaSyncLogItem } from "@/features/meta-ads/types";

export function MetaIntegrationHub({
  marketing,
  canConfigure,
}: {
  marketing: { connection: MetaConnectionInfo | null; assets: MetaConnectionAssets | null; logs: MetaSyncLogItem[] };
  canConfigure: boolean;
}) {
  const marketingConnected = marketing.connection?.status === "connected";

  return <div className="space-y-6">
    <Card className="border-primary/20 bg-primary/5 shadow-none">
      <CardContent className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex gap-3">
          <Globe className="mt-0.5 size-6 shrink-0 text-primary" />
          <div>
            <p className="text-sm font-semibold">Marketing Meta</p>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">Conecte exclusivamente os ativos de aquisição: páginas, campanhas, formulários, pixels e fontes. O número oficial do WhatsApp é configurado em uma área separada.</p>
          </div>
        </div>
        <Badge variant={marketingConnected ? "success" : "outline"}>Marketing {marketingConnected ? "conectado" : "pendente"}</Badge>
      </CardContent>
    </Card>

    {!canConfigure ? <Card className="border-warning/30 bg-warning/5 shadow-none"><CardContent className="flex items-start gap-3 p-4"><ShieldWarning className="mt-0.5 size-5 shrink-0 text-warning" /><div><p className="font-medium">Visualização operacional</p><p className="mt-1 text-sm text-muted-foreground">Somente o Diretor ou time de Marketing pode iniciar, alterar ou desconectar a integração de Marketing Meta desta corretora.</p></div></CardContent></Card> : null}

    <MetaIntegrationView connection={marketing.connection} assets={marketing.assets} logs={marketing.logs} canConfigure={canConfigure} />

    <Card className="border-border bg-card shadow-none">
      <CardHeader><CardTitle>Precisa conectar o número corporativo?</CardTitle><CardDescription>O WhatsApp oficial é independente desta autorização. Conecte-o, pause-o ou desconecte-o sem alterar páginas, campanhas ou Lead Ads.</CardDescription></CardHeader>
      <CardContent><Button variant="outline" render={<Link href="/integrations/whatsapp" />}>Gerenciar número oficial <ArrowRight className="size-4" /></Button></CardContent>
    </Card>

    <Card className="border-border/80 bg-muted/20 shadow-none"><CardContent className="flex items-start gap-3 p-4"><CheckCircle className="mt-0.5 size-5 shrink-0 text-primary" /><p className="text-sm leading-6 text-muted-foreground">As fontes de Lead Ads só entram na operação após a assinatura <code>leadgen</code> confirmada pela Meta. A escolha de campanhas e filas continua em Distribuição de Leads.</p></CardContent></Card>
  </div>;
}
