import Link from "next/link";

import { ArrowRight, CheckCircle, Globe, ShieldWarning } from "@/components/huge-icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MetaIntegrationView } from "@/features/meta-ads/components/meta-integration-view";
import type { MetaConnectionInfo, MetaSyncLogItem } from "@/features/meta-ads/types";

import { MetaCloudSetupCard } from "./meta-cloud-setup-card";
import { MetaEmbeddedSignupCard } from "./meta-embedded-signup-card";

type Channel = {
  displayPhoneNumber: string | null;
  verifiedName: string | null;
  status: string;
  qualityRating: string | null;
  messagingLimit: string | null;
  businessId: string | null;
  wabaId: string | null;
  phoneNumberId: string | null;
  lastWebhookAt: Date | null;
  activatedAt: Date | null;
};

export function MetaIntegrationHub({
  marketing,
  whatsapp,
  canConfigure,
}: {
  marketing: { connection: MetaConnectionInfo | null; logs: MetaSyncLogItem[] };
  whatsapp: { enabled: boolean; configured: boolean; missing: string[]; appId: string | null; configId: string | null; companyAccount: Channel | null };
  canConfigure: boolean;
}) {
  const whatsappReady = whatsapp.enabled && whatsapp.configured && Boolean(whatsapp.companyAccount);
  return <div className="space-y-6">
    <Card className="border-primary/20 bg-primary/5 shadow-none">
      <CardContent className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex gap-3"><Globe className="mt-0.5 size-6 shrink-0 text-primary" /><div><p className="text-sm font-semibold">Central Meta da corretora</p><p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">Conecte Marketing, Lead Ads e WhatsApp no mesmo lugar. Cada produto mantém autorização, credenciais e controles próprios — sem token manual e sem cruzar dados entre corretoras.</p></div></div>
        <div className="flex flex-wrap gap-2"><Badge variant={marketing.connection?.status === "connected" ? "success" : "outline"}>Marketing {marketing.connection?.status === "connected" ? "conectado" : "pendente"}</Badge><Badge variant={whatsappReady ? "success" : "outline"}>WhatsApp {whatsappReady ? "conectado" : "pendente"}</Badge></div>
      </CardContent>
    </Card>

    {!canConfigure ? <Card className="border-warning/30 bg-warning/5 shadow-none"><CardContent className="flex items-start gap-3 p-4"><ShieldWarning className="mt-0.5 size-5 shrink-0 text-warning" /><div><p className="font-medium">Visualização operacional</p><p className="mt-1 text-sm text-muted-foreground">Somente o Diretor pode iniciar, alterar ou desconectar as integrações Meta desta corretora.</p></div></CardContent></Card> : null}

    <section className="grid gap-6 xl:grid-cols-2">
      <div className="min-w-0"><MetaIntegrationView connection={marketing.connection} logs={marketing.logs} canConfigure={canConfigure} /></div>
      <div className="space-y-4"><Card className="border-border bg-card shadow-none"><CardHeader><CardTitle>WhatsApp oficial</CardTitle><CardDescription>Cadastro incorporado da Meta para selecionar a conta e o número corporativo da corretora.</CardDescription></CardHeader><CardContent className="space-y-4"><MetaCloudSetupCard companyAccount={whatsapp.companyAccount} configured={whatsapp.configured} enabled={whatsapp.enabled} missing={whatsapp.missing} />{canConfigure && whatsapp.enabled && whatsapp.configured && whatsapp.appId && whatsapp.configId ? <MetaEmbeddedSignupCard appId={whatsapp.appId} configId={whatsapp.configId} /> : null}</CardContent></Card><Card className="border-border bg-card shadow-none"><CardHeader><CardTitle>Depois de conectar</CardTitle><CardDescription>O hub controla a conexão. As decisões comerciais continuam nos módulos operacionais.</CardDescription></CardHeader><CardContent className="flex flex-wrap gap-2"><Button variant="outline" size="sm" render={<Link href="/marketing/campanhas" />}>Ver campanhas <ArrowRight className="size-4" /></Button><Button variant="outline" size="sm" render={<Link href="/leads/distribuicao" />}>Definir filas <ArrowRight className="size-4" /></Button><Button variant="outline" size="sm" render={<Link href="/integrations/whatsapp" />}>Canais e WAHA <ArrowRight className="size-4" /></Button></CardContent></Card></div>
    </section>

    <Card className="border-border/80 bg-muted/20 shadow-none"><CardContent className="flex items-start gap-3 p-4"><CheckCircle className="mt-0.5 size-5 shrink-0 text-primary" /><p className="text-sm leading-6 text-muted-foreground">A página antiga de validação manual de Facebook Lead Ads não é mais o fluxo principal. Novas páginas são autorizadas pelo OAuth de Marketing e entram no intake somente após a assinatura `leadgen` confirmada pela Meta.</p></CardContent></Card>
  </div>;
}
