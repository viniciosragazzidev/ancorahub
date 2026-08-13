import type { ReactNode } from "react";

import { ArrowSquareOut, CheckCircle, ShieldWarning } from "@/components/huge-icons";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MetaCloudSetupCard } from "@/features/communication-channels/components/meta-cloud-setup-card";
import { MetaEmbeddedSignupCard } from "@/features/communication-channels/components/meta-embedded-signup-card";

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
  const officialReady = official.enabled && official.configured && official.companyAccount?.status === "active";
  const canConnectNumber = official.canConfigure && official.enabled && official.configured && official.appId && official.embeddedSignupConfigId && official.companyAccount?.status !== "active";
  return <main className="flex min-h-full flex-col gap-6 bg-background p-4 antialiased lg:p-6">
    <header className="max-w-3xl">
      <p className="text-xs font-medium text-primary">CANAIS DE ATENDIMENTO</p>
      <h1 className="mt-1 text-balance text-2xl font-semibold tracking-tight">WhatsApp da operação</h1>
      <p className="mt-1 text-pretty text-sm leading-6 text-muted-foreground">Conecte o número oficial da corretora com a Meta. Essa conexão é independente de páginas, campanhas e contas de anúncios.</p>
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
          <CardHeader className="flex flex-row items-start justify-between gap-4">
            <div><CardTitle>Número oficial</CardTitle><CardDescription className="mt-1">Canal corporativo da Meta para atendimento comercial e mensagens oficiais.</CardDescription></div>
            <Badge variant={officialReady ? "default" : "secondary"}>{officialReady ? "Pronto" : "Configuração pendente"}</Badge>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-3 rounded-lg border border-border bg-muted/20 p-4 text-sm md:grid-cols-3">
              <p><strong className="block text-foreground">Número</strong><span className="text-muted-foreground">Um canal corporativo oficial por corretora.</span></p>
              <p><strong className="block text-foreground">Atendimento</strong><span className="text-muted-foreground">Conversas vinculadas ao lead e histórico no CRM.</span></p>
              <p><strong className="block text-foreground">Governança</strong><span className="text-muted-foreground">Pausar, reativar ou desconectar sem apagar histórico.</span></p>
            </div>
            <MetaCloudSetupCard companyAccount={official.companyAccount} configured={official.configured} enabled={official.enabled} missing={official.missing} canManage={official.canConfigure} />
            {canConnectNumber ? <MetaEmbeddedSignupCard appId={official.appId!} configId={official.embeddedSignupConfigId!} /> : null}
          </CardContent>
        </Card>
        <Card className="border-border bg-card shadow-none">
          <CardHeader><CardTitle>Como conectar o número oficial</CardTitle><CardDescription>O Diretor abre o cadastro seguro abaixo, escolhe a conta WhatsApp Business e confirma o número corporativo. Nenhum token ou ID técnico precisa ser copiado para o CRM.</CardDescription></CardHeader>
          <CardContent className="space-y-4 text-sm leading-6 text-muted-foreground">
            <ol className="list-decimal space-y-2 pl-5"><li>Confirme na Meta que você administra o Portfólio Empresarial, a conta WhatsApp Business e o número corporativo.</li><li>Clique em <strong>Conectar número com Facebook</strong> e conclua a seleção no ambiente seguro da Meta.</li><li>Ao voltar, o CRM valida o número e apresenta o status. Para trocar de número, desconecte o atual e conecte o novo.</li></ol>
            <a className="inline-flex items-center gap-1 font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" href="https://business.facebook.com/wa/manage/" rel="noreferrer" target="_blank">Abrir WhatsApp Manager da Meta <ArrowSquareOut aria-hidden="true" className="size-3.5" /></a>
          </CardContent>
        </Card>
        {waha}
      </div>

      <Card className="h-fit border-border bg-card shadow-none">
        <CardHeader><CardTitle className="flex items-center gap-2"><CheckCircle className="size-5 text-primary" /> O que esta conexão controla?</CardTitle><CardDescription>O número oficial é uma integração separada e não muda sua configuração de Marketing Meta.</CardDescription></CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div className="rounded-lg border border-border p-3"><p className="font-medium">Conectar</p><p className="mt-2 text-muted-foreground">Vincula a conta WhatsApp Business e um único número corporativo ao tenant atual.</p></div>
          <div className="rounded-lg border border-border p-3"><p className="font-medium">Pausar ou reativar</p><p className="mt-2 text-muted-foreground">Interrompe ou retoma novos envios e recebimentos oficiais sem remover a configuração.</p></div>
          <div className="rounded-lg border border-border p-3"><p className="font-medium">Desconectar</p><p className="mt-2 text-muted-foreground">Remove as credenciais do CRM, preserva histórico e auditoria, e libera a conexão de um novo número.</p></div>
          <p className="rounded-lg bg-muted/50 p-3 text-xs leading-5 text-muted-foreground">Páginas, campanhas, pixels, formulários e filas são configurados em <strong>Marketing Meta</strong>. Esta tela não altera nenhum desses ativos.</p>
        </CardContent>
      </Card>
    </section>
  </main>;
}
