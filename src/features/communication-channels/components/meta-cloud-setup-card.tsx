import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

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

function formatDate(value: Date | null) {
  if (!value) return "Ainda não sincronizado";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function accountStatus(account: Channel | null, enabled: boolean, configured: boolean) {
  if (!enabled) return { label: "Desativada pelo Super-admin", tone: "border-warning/30 bg-warning/10 text-warning-foreground" };
  if (!configured) return { label: "Configuração incompleta", tone: "border-warning/30 bg-warning/10 text-warning-foreground" };
  if (!account) return { label: "Não conectada", tone: "border-border bg-muted/30 text-muted-foreground" };
  if (account.status === "active") return { label: "Ativa", tone: "border-success/30 bg-success/10 text-success-foreground" };
  return { label: "Pausada", tone: "border-warning/30 bg-warning/10 text-warning-foreground" };
}

export function MetaCloudSetupCard({ enabled, configured, missing, companyAccount, showTechnicalDetails = false }: { enabled: boolean; configured: boolean; missing: string[]; companyAccount: Channel | null; showTechnicalDetails?: boolean }) {
  const status = accountStatus(companyAccount, enabled, configured);

  return <Card className="border-border bg-card shadow-none">
    <CardHeader>
      <CardTitle>Status da conta WhatsApp da empresa</CardTitle>
      <CardDescription>Uma visão única da conta oficial da Meta que atende todas as unidades. A configuração técnica é administrada pelo suporte do CorreTop.</CardDescription>
    </CardHeader>
    <CardContent className="space-y-4">
      <div aria-live="polite" className={`rounded-lg border p-4 ${status.tone}`}>
        <p className="text-xs font-medium uppercase tracking-wide opacity-80">Status operacional</p>
        <p className="mt-1 text-lg font-semibold">{status.label}</p>
      </div>
      {!enabled ? <p className="text-sm text-muted-foreground">A capacidade foi desativada globalmente pelo Super-admin.</p> : null}
      {enabled && !configured ? <div className="rounded-lg border border-warning/30 bg-warning/10 p-3 text-sm"><p className="font-medium">Configuração técnica indisponível</p><p className="mt-1 text-muted-foreground">O suporte precisa concluir as variáveis seguras do servidor: {missing.join(", ")}.</p></div> : null}
      {enabled && configured && !companyAccount ? <div className="rounded-lg border border-border bg-muted/20 p-3"><p className="text-sm font-medium">Nenhuma conta empresarial conectada</p><p className="mt-1 text-xs text-muted-foreground">A configuração do canal oficial é realizada pelo administrador da plataforma.</p></div> : null}
      {companyAccount ? <div className="grid gap-3 rounded-lg border border-border p-4 sm:grid-cols-2 lg:grid-cols-3">
        <div><p className="text-xs text-muted-foreground">Nome verificado</p><p className="mt-1 text-sm font-medium">{companyAccount.verifiedName ?? "Não informado"}</p></div>
        <div><p className="text-xs text-muted-foreground">Número oficial</p><p className="mt-1 text-sm font-medium">{companyAccount.displayPhoneNumber ?? "Não informado"}</p></div>
        <div><p className="text-xs text-muted-foreground">Qualidade</p><p className="mt-1 text-sm font-medium">{companyAccount.qualityRating ?? "Ainda não disponível"}</p></div>
        <div><p className="text-xs text-muted-foreground">Limite de mensagens</p><p className="mt-1 text-sm font-medium">{companyAccount.messagingLimit ?? "Não informado"}</p></div>
        <div><p className="text-xs text-muted-foreground">Último webhook</p><p className="mt-1 text-sm font-medium">{formatDate(companyAccount.lastWebhookAt)}</p></div>
        <div><p className="text-xs text-muted-foreground">Ativada em</p><p className="mt-1 text-sm font-medium">{formatDate(companyAccount.activatedAt)}</p></div>
        {showTechnicalDetails ? <>
          <div><p className="text-xs text-muted-foreground">Business ID</p><p className="mt-1 break-all font-mono text-xs">{companyAccount.businessId ?? "—"}</p></div>
          <div><p className="text-xs text-muted-foreground">WABA ID</p><p className="mt-1 break-all font-mono text-xs">{companyAccount.wabaId ?? "—"}</p></div>
          <div><p className="text-xs text-muted-foreground">Phone Number ID</p><p className="mt-1 break-all font-mono text-xs">{companyAccount.phoneNumberId ?? "—"}</p></div>
        </> : null}
      </div> : null}
      <p className="text-sm text-muted-foreground">A conexão, a troca e o status do canal oficial são administrados pelo suporte técnico do CorreTop.</p>
    </CardContent>
  </Card>;
}
