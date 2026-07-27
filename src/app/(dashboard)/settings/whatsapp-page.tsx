"use client";

import { CheckCircle, ShieldWarning } from "@/components/huge-icons";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { WhatsAppConnectDialog } from "@/components/whatsapp/whatsapp-connect-dialog";
import { MetaCloudSetupCard } from "@/features/communication-channels/components/meta-cloud-setup-card";
import { getWhatsAppConnection } from "./whatsapp-actions";

type Connection = Awaited<ReturnType<typeof getWhatsAppConnection>>;
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

export function WhatsAppPage({ initial, returnTo, official }: { initial: Connection; returnTo?: string; official: OfficialSetup }) {
  const ready = initial.status === "ready";

  return <main className="flex min-h-full flex-col gap-6 bg-background p-4 lg:p-6">
    <div>
      <p className="text-xs font-medium text-primary">INTEGRAÇÕES</p>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight">Integração WhatsApp</h1>
      <p className="mt-1 max-w-2xl text-sm text-muted-foreground">Acompanhe a saúde da conta empresarial e mantenha o atendimento oficial da Meta sob controle.</p>
    </div>
    <Card className="border-warning/30 bg-accent/10 shadow-none"><CardContent className="flex items-start gap-3 p-5"><ShieldWarning className="mt-0.5 size-6 shrink-0 text-warning" /><div><p className="font-semibold text-warning-foreground">Privacidade por lead</p><p className="mt-1 text-sm leading-6 text-muted-foreground">Conversas pessoais, grupos e números sem vínculo são descartados antes de qualquer gravação.</p></div></CardContent></Card>
    <MetaCloudSetupCard companyAccount={official.companyAccount} configured={official.configured} enabled={official.enabled} missing={official.missing} />
    <Card className="border-border bg-card shadow-none"><CardHeader><CardTitle>Conexão pessoal legada (opcional)</CardTitle><CardDescription>Esta conexão é individual, não altera o status da conta empresarial e deve ser usada somente durante a transição.</CardDescription></CardHeader><CardContent className="flex flex-wrap items-center justify-between gap-4"><div><p className="text-sm font-semibold">{ready ? "QR legado conectado" : "QR legado não conectado"}</p><p className="mt-1 text-xs text-muted-foreground">{ready ? "O chat interno legado está pronto para os atendimentos." : "Use somente enquanto o canal oficial não estiver disponível."}</p></div><WhatsAppConnectDialog connectedLabel="QR legado conectado" initial={initial} returnTo={returnTo} triggerLabel="Abrir QR legado" /></CardContent></Card>
    <Card className="border-border bg-card shadow-none"><CardHeader><CardTitle className="flex items-center gap-2"><CheckCircle className="text-primary" /> Como o atendimento funciona</CardTitle></CardHeader><CardContent className="grid gap-3 text-sm text-muted-foreground md:grid-cols-3"><p><strong className="text-foreground">1. Conecte:</strong> o Diretor conecta o número oficial pela Meta.</p><p><strong className="text-foreground">2. Atenda:</strong> o corretor envia mensagens na tela do lead.</p><p><strong className="text-foreground">3. Proteja:</strong> apenas mensagens vinculadas a leads são importadas.</p></CardContent></Card>
  </main>;
}
