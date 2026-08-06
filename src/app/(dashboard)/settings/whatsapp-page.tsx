import type { ReactNode } from "react";

import { CheckCircle, ShieldWarning } from "@/components/huge-icons";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MetaCloudSetupCard } from "@/features/communication-channels/components/meta-cloud-setup-card";

type Channel = {
  id: string;
  branchId: string | null;
  displayPhoneNumber: string | null;
  verifiedName: string | null;
  branchName: string | null;
  status: string;
  qualityRating: string | null;
  messagingLimit: string | null;
  businessId: string | null;
  wabaId: string | null;
  phoneNumberId: string | null;
  lastWebhookAt: Date | null;
  activatedAt: Date | null;
  tokenExpiresAt: Date | null;
  isDefault: boolean;
};
type OfficialSetup = {
  enabled: boolean;
  configured: boolean;
  missing: string[];
  appId: string | null;
  embeddedSignupConfigId: string | null;
  canConfigure: boolean;
  branches: { id: string; name: string }[];
  channels: Channel[];
  companyAccount: Channel | null;
};

export function WhatsAppPage({ official, waha }: { official: OfficialSetup; waha: ReactNode }) {
  const officialReady = official.enabled && official.configured && Boolean(official.companyAccount);
  return <main className="flex min-h-full flex-col gap-6 bg-background p-4 antialiased lg:p-6">
    <header className="max-w-3xl">
      <p className="text-xs font-medium text-primary">CANAIS DE ATENDIMENTO</p>
      <h1 className="mt-1 text-balance text-2xl font-semibold tracking-tight">WhatsApp da operação</h1>
      <p className="mt-1 text-pretty text-sm leading-6 text-muted-foreground">Configure o canal certo para cada tipo de atendimento. A Meta é o canal oficial; o WAHA atende automações controladas por empresa ou unidade.</p>
    </header>

    <Card className="border-warning/30 bg-warning/5 shadow-none">
      <CardContent className="flex items-start gap-3 p-4">
        <ShieldWarning className="mt-0.5 size-5 shrink-0 text-warning" />
        <div><p className="text-sm font-semibold">Proteção de dados</p><p className="mt-1 text-sm leading-6 text-muted-foreground">Use apenas números autorizados. Conversas, grupos e contatos sem vínculo com um lead são descartados antes de entrar no CRM.</p></div>
      </CardContent>
    </Card>

    <section className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(20rem,0.8fr)]">
      <div className="space-y-4">
        <Card className="border-border bg-card shadow-none">
          <CardHeader className="flex-row items-start justify-between gap-4">
            <div><CardTitle>WhatsApp Oficial</CardTitle><CardDescription className="mt-1">Canal da Meta para atendimento comercial rastreável e integração com os recursos oficiais.</CardDescription></div>
            <Badge variant={officialReady ? "default" : "secondary"}>{officialReady ? "Pronto" : "Configuração pendente"}</Badge>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-3 rounded-lg border border-border bg-muted/20 p-4 text-sm md:grid-cols-3">
              <p><strong className="block text-foreground">Atendimento</strong><span className="text-muted-foreground">Conversas vinculadas ao lead e histórico no CRM.</span></p>
              <p><strong className="block text-foreground">Captação</strong><span className="text-muted-foreground">Lead Ads e webhooks oficiais da Meta.</span></p>
              <p><strong className="block text-foreground">Governança</strong><span className="text-muted-foreground">Templates, janela e políticas da Meta.</span></p>
            </div>
            <MetaCloudSetupCard companyAccount={official.companyAccount} configured={official.configured} enabled={official.enabled} missing={official.missing} />
          </CardContent>
        </Card>
        {waha}
      </div>

      <Card className="h-fit border-border bg-card shadow-none">
        <CardHeader><CardTitle className="flex items-center gap-2"><CheckCircle className="size-5 text-primary" /> Qual método usar?</CardTitle><CardDescription>Os dois canais coexistem, mas cada um tem uma finalidade definida.</CardDescription></CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div className="rounded-lg border border-border p-3"><p className="font-medium">Use o WhatsApp Oficial para</p><ul className="mt-2 space-y-1 text-muted-foreground"><li>• Atendimento e respostas comerciais.</li><li>• Campanhas e templates aprovados.</li><li>• Leads vindos da Meta.</li></ul></div>
          <div className="rounded-lg border border-border p-3"><p className="font-medium">Use WAHA para</p><ul className="mt-2 space-y-1 text-muted-foreground"><li>• Cadências internas controladas.</li><li>• Número da empresa ou da unidade.</li><li>• IA somente após mensagem recebida.</li></ul></div>
          <p className="rounded-lg bg-muted/50 p-3 text-xs leading-5 text-muted-foreground">Nenhum canal envia conteúdo sensível. Pausar uma conexão interrompe novos envios sem apagar o histórico.</p>
        </CardContent>
      </Card>
    </section>
  </main>;
}
