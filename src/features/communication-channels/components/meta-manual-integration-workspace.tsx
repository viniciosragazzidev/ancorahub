"use client";

import { useState, useTransition } from "react";
import type { ReactNode } from "react";
import { toast } from "@/components/ui/sonner";

import { ArrowSquareOut, CheckCircle, Copy, Warning } from "@/components/huge-icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { AppSelect } from "@/components/ui/select";
import {
  confirmManualMetaLeadAdsAssetsAction,
  discoverManualMetaLeadAdsAssetsAction,
  pauseManualMetaLeadAdsSourceAction,
  reactivateManualMetaLeadAdsSourceAction,
  updateMetaLeadAdSourceDistributionAction,
  updateMetaOperationalAssetsAction,
} from "../manual-meta-actions";

type Asset = { id: string; name?: string };
type Props = {
  leadAdsEnabled: boolean;
  leadAdsServerReady: boolean;
  leadAdsMissingServerConfig: string[];
  identity: { partnerName: string; businessId: string; supportWhatsApp: string };
  channel: { status: string; displayPhoneNumber: string | null; verifiedName: string | null } | null;
  branches: Array<{ id: string; name: string }>;
  leadAdSources: Array<{ id: string; pageId: string; status: string; distributionMode: string; branchId: string | null; lastWebhookAt: Date | null; lastLeadAt: Date | null; lastError: string | null }>;
  operationalSelection: { facebookPageId: string | null; adAccountId: string | null; pixelId: string | null; datasetId: string | null; lastSyncedAt: Date | null; lastError: string | null } | null;
  inventory: {
    adAccounts: Array<{ id: string; name: string; status: string }>;
    pixels: Array<{ id: string; name: string; status: string }>;
    datasets: Array<{ id: string; name: string; status: string }>;
    campaigns: Array<{ id: string; name: string; status: string }>;
    forms: Array<{ id: string; name: string; status: string; pageId: string }>;
  };
};


function date(value: Date | null) {
  return value ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value)) : "Ainda não recebido";
}

function SourceDistributionSelector({
  source,
  branches,
}: {
  source: Props["leadAdSources"][number];
  branches: Props["branches"];
}) {
  const [pending, startTransition] = useTransition();
  const [mode, setMode] = useState(source.distributionMode || "direct_leads");
  const [branchId, setBranchId] = useState(source.branchId || "");

  const handleUpdateMode = (newMode: string, newBranchId?: string | null) => {
    setMode(newMode);
    startTransition(async () => {
      try {
        await updateMetaLeadAdSourceDistributionAction({
          sourceId: source.id,
          distributionMode: newMode as "direct_leads" | "duty_plantao" | "unit_branch",
          branchId: newBranchId !== undefined ? newBranchId : branchId || null,
        });
        toast.success("Regra de distribuição atualizada com sucesso!");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Erro ao atualizar distribuição.");
      }
    });
  };

  return (
    <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-border/60 mt-2 w-full">
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <span>Destino dos Leads:</span>
        <AppSelect
          aria-label="Destino dos leads"
          className="w-64"
          disabled={pending}
          onValueChange={handleUpdateMode}
          options={[
            { value: "direct_leads", label: "Lista geral de leads — sem plantão" },
            { value: "duty_plantao", label: "Fila do plantão ao vivo" },
            { value: "unit_branch", label: "Plantão de unidade específica" },
          ]}
          size="sm"
          triggerClassName="h-8 bg-background text-xs font-normal"
          value={mode}
        />
      </div>

      {mode === "unit_branch" && (
        <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <span>Unidade:</span>
          <AppSelect
            aria-label="Unidade de destino"
            className="w-52"
            disabled={pending}
            onValueChange={(value) => {
              setBranchId(value);
              handleUpdateMode(mode, value || null);
            }}
            options={[
              { value: "", label: "Matriz / sem unidade" },
              ...branches.map((item) => ({ value: item.id, label: item.name })),
            ]}
            size="sm"
            triggerClassName="h-8 bg-background text-xs font-normal"
            value={branchId}
          />
        </div>
      )}
    </div>
  );
}

function CopyValue({ label, value }: { label: string; value: string }) {
  return <div className="flex items-center gap-2 rounded-md border border-border bg-muted/30 px-3 py-2"><code className="min-w-0 flex-1 truncate text-sm">{value}</code><Button size="icon-sm" variant="ghost" type="button" aria-label={`Copiar ${label}`} onClick={() => navigator.clipboard.writeText(value).then(() => toast.success(`${label} copiado.`))}><Copy className="size-4" /></Button></div>;
}

function OperationalAssetsControl({ props }: { props: Props }) {
  const [pending, startTransition] = useTransition();
  const [sourceId, setSourceId] = useState(() => props.leadAdSources.find((source) => source.pageId === props.operationalSelection?.facebookPageId)?.id ?? "");
  const [adAccountId, setAdAccountId] = useState(props.operationalSelection?.adAccountId ?? "");
  const [pixelId, setPixelId] = useState(props.operationalSelection?.pixelId ?? "");
  const [datasetId, setDatasetId] = useState(props.operationalSelection?.datasetId ?? "");
  const hasInventory = props.inventory.adAccounts.length + props.inventory.pixels.length + props.inventory.datasets.length > 0;

  const save = () => startTransition(async () => {
    try {
      await updateMetaOperationalAssetsAction({ sourceId: sourceId || null, adAccountId: adAccountId || null, pixelId: pixelId || null, datasetId: datasetId || null });
      toast.success("Ativos operacionais atualizados. A distribuição continua centralizada nas filas.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível atualizar os ativos Meta.");
    }
  });

  return <Card className="border-border shadow-none">
    <CardHeader className="gap-2">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><CardTitle className="text-base">Ativos operacionais</CardTitle><CardDescription className="mt-1">Escolha quais ativos já sincronizados representam a operação desta empresa. Nenhuma escolha envia eventos para a Meta.</CardDescription></div>
        <Badge variant="outline">Configuração local</Badge>
      </div>
    </CardHeader>
    <CardContent className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <label className="grid gap-1.5 text-sm font-medium">Fonte de Página
          <AppSelect aria-label="Fonte de Página Meta" className="w-full" disabled={pending} onValueChange={setSourceId} options={[{ value: "", label: "Nenhuma página padrão" }, ...props.leadAdSources.filter((source) => source.status === "active").map((source) => ({ value: source.id, label: `Página ${source.pageId}` }))]} size="sm" triggerClassName="h-9 bg-background" value={sourceId} />
        </label>
        <label className="grid gap-1.5 text-sm font-medium">Conta de anúncios
          <AppSelect aria-label="Conta de anúncios Meta" className="w-full" disabled={pending || !props.inventory.adAccounts.length} onValueChange={setAdAccountId} options={[{ value: "", label: props.inventory.adAccounts.length ? "Nenhuma conta padrão" : "Sincronize uma conta primeiro" }, ...props.inventory.adAccounts.map((asset) => ({ value: asset.id, label: asset.name }))]} size="sm" triggerClassName="h-9 bg-background" value={adAccountId} />
        </label>
        <label className="grid gap-1.5 text-sm font-medium">Pixel
          <AppSelect aria-label="Pixel Meta" className="w-full" disabled={pending || !props.inventory.pixels.length} onValueChange={setPixelId} options={[{ value: "", label: props.inventory.pixels.length ? "Nenhum pixel padrão" : "Nenhum pixel sincronizado" }, ...props.inventory.pixels.map((asset) => ({ value: asset.id, label: asset.name }))]} size="sm" triggerClassName="h-9 bg-background" value={pixelId} />
        </label>
        <label className="grid gap-1.5 text-sm font-medium">Dataset
          <AppSelect aria-label="Dataset Meta" className="w-full" disabled={pending || !props.inventory.datasets.length} onValueChange={setDatasetId} options={[{ value: "", label: props.inventory.datasets.length ? "Nenhum dataset padrão" : "Nenhum dataset sincronizado" }, ...props.inventory.datasets.map((asset) => ({ value: asset.id, label: asset.name }))]} size="sm" triggerClassName="h-9 bg-background" value={datasetId} />
        </label>
      </div>
      {!hasInventory ? <p className="rounded-md border border-dashed border-border bg-muted/30 p-3 text-sm text-muted-foreground">As fontes de Página já podem receber leads. Campanhas, contas, pixels e datasets aparecerão aqui depois da sincronização da conexão Meta da empresa; o sistema não faz descoberta global de ativos.</p> : null}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3"><p className="text-xs text-muted-foreground">Rotas de campanha e formulário são configuradas em Filas de distribuição; elas nunca escolhem um corretor diretamente.</p><Button size="sm" onClick={save} disabled={pending}>{pending ? "Salvando…" : "Salvar ativos"}</Button></div>
    </CardContent>
  </Card>;
}

function InventorySummary({ inventory }: { inventory: Props["inventory"] }) {
  const groups = [
    ["Campanhas", inventory.campaigns.length], ["Formulários", inventory.forms.length], ["Contas", inventory.adAccounts.length], ["Pixels", inventory.pixels.length],
  ] as const;
  return <Card className="border-border shadow-none"><CardHeader><CardTitle className="text-base">Inventário sincronizado</CardTitle><CardDescription>Leitura local dos ativos autorizados para esta empresa. Campanhas e formulários chegam aqui para consulta e são encaminhados para filas na Central de distribuição.</CardDescription></CardHeader><CardContent className="space-y-4"><div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{groups.map(([label, total]) => <div className="rounded-lg border border-border bg-muted/20 p-3" key={label}><p className="text-2xl font-semibold tabular-nums">{total}</p><p className="mt-1 text-xs text-muted-foreground">{label}</p></div>)}</div><div className="grid gap-3 md:grid-cols-2"><div className="rounded-lg border border-border p-3"><div className="flex items-center justify-between gap-2"><p className="text-sm font-medium">Campanhas disponíveis</p><Button size="sm" variant="ghost" render={<a href="/leads/distribuicao" />}>Escolher fila</Button></div><div className="mt-2 space-y-1">{inventory.campaigns.slice(0, 5).map((item) => <div className="flex items-center justify-between gap-2 rounded-md bg-muted/40 px-2 py-1.5 text-xs" key={item.id}><span className="truncate font-medium">{item.name}</span><Badge variant="outline">{item.status}</Badge></div>)}{!inventory.campaigns.length ? <p className="text-xs text-muted-foreground">Nenhuma campanha sincronizada.</p> : null}</div></div><div className="rounded-lg border border-border p-3"><p className="text-sm font-medium">Formulários de Lead Ads</p><div className="mt-2 space-y-1">{inventory.forms.slice(0, 5).map((item) => <div className="flex items-center justify-between gap-2 rounded-md bg-muted/40 px-2 py-1.5 text-xs" key={item.id}><span className="truncate font-medium">{item.name}</span><Badge variant="outline">{item.status}</Badge></div>)}{!inventory.forms.length ? <p className="text-xs text-muted-foreground">Nenhum formulário sincronizado.</p> : null}</div></div></div></CardContent></Card>;
}

function MetaLink({ href, children }: { href: string; children: ReactNode }) {
  return <a className="inline-flex items-center gap-1 font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" href={href} rel="noreferrer" target="_blank">{children}<ArrowSquareOut aria-hidden="true" className="size-3.5" /></a>;
}

function LeadAdsWizard({ props }: { props: Props }) {
  const [discovery, setDiscovery] = useState<{ pages: Asset[] } | null>(null);
  const [pageId, setPageId] = useState("");
  const [pending, startTransition] = useTransition();

  const discover = () => startTransition(async () => {
    const result = await discoverManualMetaLeadAdsAssetsAction({ pageId });
    if (result.error) { toast.error(result.error); return; }
    setDiscovery(result.assets ?? null);
    toast.success(result.assets?.pages.length ? "Página autorizada encontrada." : "Esta Página não foi autorizada para esta empresa.");
  });
  const confirm = () => startTransition(async () => {
    try {
      await confirmManualMetaLeadAdsAssetsAction({ pageId });
      toast.success("Página ativada. Novos leads entrarão na fila central desta empresa.");
      setDiscovery(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível ativar os ativos.");
    }
  });

  if (!props.leadAdsEnabled) return <Card className="border-warning/30 bg-warning/10 shadow-none"><CardContent className="flex gap-3 p-4"><Warning className="mt-0.5 size-5 text-warning" /><div><p className="font-medium">Piloto ainda não liberado para esta empresa</p><p className="mt-1 text-sm text-muted-foreground">O Super Admin precisa habilitar a empresa no piloto de Lead Ads. Nenhum dado será solicitado até lá.</p></div></CardContent></Card>;
  if (!props.leadAdsServerReady) return <Card className="border-warning/30 bg-warning/10 shadow-none"><CardContent className="flex gap-3 p-4"><Warning className="mt-0.5 size-5 text-warning" /><div><p className="font-medium">A plataforma ainda não está pronta</p><p className="mt-1 text-sm text-muted-foreground">O administrador técnico precisa concluir a credencial privada da Meta: {props.leadAdsMissingServerConfig.join(", ")}.</p></div></CardContent></Card>;

  return <div className="space-y-4">
    <Card className="border-primary/20 bg-primary/5 shadow-none"><CardContent className="flex gap-3 p-4"><CheckCircle className="mt-0.5 size-5 shrink-0 text-primary" /><div><p className="text-sm font-semibold">O resultado esperado</p><p className="mt-1 text-sm leading-6 text-muted-foreground">Ao terminar, cada novo formulário Meta cria um lead na fila central desta empresa. WhatsApp não é necessário para esta integração.</p></div></CardContent></Card>
    <Card className="border-border shadow-none"><CardHeader><Badge variant="info" className="w-fit">Passo 1 de 4</Badge><CardTitle className="mt-2">Compartilhe a Página com a Ancora Hub</CardTitle><CardDescription>Faça isso no Portfólio Empresarial que é dono da Página dos anúncios — não no portfólio da Ancora Hub.</CardDescription></CardHeader><CardContent className="grid gap-4"><ol className="list-decimal space-y-2 pl-5 text-sm leading-6 text-muted-foreground"><li>Abra as configurações do negócio da Meta.</li><li>Vá em <strong className="text-foreground">Usuários → Parceiros</strong> e escolha adicionar um parceiro.</li><li>Informe o Business ID da Ancora Hub, selecione a Página que recebe formulários e confirme o acesso.</li><li>Em <strong className="text-foreground">Integrações → Acesso a leads</strong>, mantenha o acesso à Página liberado.</li></ol><div className="grid gap-4 sm:grid-cols-2"><div><p className="mb-2 text-sm font-medium">Parceiro</p><CopyValue label="nome do parceiro" value={props.identity.partnerName} /></div><div><p className="mb-2 text-sm font-medium">Business ID da Ancora Hub</p><CopyValue label="Business ID" value={props.identity.businessId} /></div></div><MetaLink href="https://business.facebook.com/settings/">Abrir Configurações do negócio da Meta</MetaLink></CardContent></Card>
    <Card className="border-border shadow-none"><CardHeader><Badge variant="info" className="w-fit">Passo 2 de 4</Badge><CardTitle className="mt-2">Aguarde a confirmação técnica</CardTitle><CardDescription>A Ancora Hub confirma que a Página foi compartilhada e que a credencial técnica consegue ler os formulários.</CardDescription></CardHeader><CardContent className="space-y-2 text-sm text-muted-foreground"><p>Não cole token, App ID, segredo do aplicativo ou o nome do CRM em uma tela da Meta. Esta parte é feita pela plataforma.</p><p>Quando o suporte confirmar, volte aqui para buscar a Página. Se precisar, informe apenas o nome e o ID da Página pelo WhatsApp {props.identity.supportWhatsApp}.</p></CardContent></Card>
    <Card className="border-border shadow-none">
      <CardHeader>
        <Badge variant="info" className="w-fit">Passo 3 de 4</Badge>
        <CardTitle className="mt-2">Informe a Página desta empresa</CardTitle>
        <CardDescription>Por segurança, o sistema valida somente o ID da Página que você informar. A lista de ativos de outras empresas nunca é exibida.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <label className="grid max-w-xl gap-1.5 text-sm font-medium" htmlFor="meta-lead-ads-page-id">
          ID da Página do Facebook
          <Input id="meta-lead-ads-page-id" inputMode="numeric" onChange={(event) => setPageId(event.target.value)} placeholder="Ex.: 123456789012345" value={pageId} />
        </label>
        <p className="max-w-2xl text-sm text-muted-foreground">Use o ID da Página compartilhada com a Ancora Hub. Este campo não pede o ID da sua empresa no AncoraHub: a empresa é identificada automaticamente pela sua sessão.</p>
        <Button onClick={discover} disabled={pending || !pageId.trim()}>{pending ? "Validando…" : "Validar Página"}</Button>
        {discovery && !discovery.pages.length ? <div className="rounded-md border border-warning/30 bg-warning/10 p-3 text-sm"><p className="font-medium">Página não autorizada</p><p className="mt-1 leading-6 text-muted-foreground">Confira o ID informado, o compartilhamento com a Ancora Hub e o Acesso a leads. Depois, tente novamente.</p></div> : null}
      </CardContent>
    </Card>
    {discovery?.pages.length ? <Card className="border-border shadow-none"><CardHeader><Badge variant="info" className="w-fit">Passo 4 de 4</Badge><CardTitle className="mt-2">Ative esta Página</CardTitle><CardDescription>A Página abaixo foi validada para esta empresa. Ao ativar, novos formulários entram na fila central.</CardDescription></CardHeader><CardContent className="space-y-5"><div className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2 text-sm"><span className="min-w-0 flex-1 truncate font-medium">{discovery.pages[0].name || "Página sem nome"}</span><span className="text-xs text-muted-foreground">{discovery.pages[0].id}</span></div><Button onClick={confirm} disabled={pending}>{pending ? "Ativando…" : "Ativar Página"}</Button><p className="text-sm text-muted-foreground">Depois da ativação, envie um formulário fictício pela <MetaLink href="https://developers.facebook.com/tools/lead-ads-testing/">ferramenta de teste de Lead Ads</MetaLink> e confirme a origem Meta Lead Ads na lista de Leads.</p></CardContent></Card> : null}
  </div>;
}

export function MetaManualIntegrationWorkspace(props: Props) {
  const [removing, startRemoving] = useTransition();
  const removeSource = (sourceId: string) => startRemoving(async () => {
    try {
      const formData = new FormData();
      formData.set("sourceId", sourceId);
      await pauseManualMetaLeadAdsSourceAction(formData);
      toast.success("Página removida. O histórico de leads foi preservado.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível remover esta Página.");
    }
  });

  const reactivateSource = (pageId: string) => startRemoving(async () => {
    try {
      const formData = new FormData();
      formData.set("pageId", pageId);
      await reactivateManualMetaLeadAdsSourceAction(formData);
      toast.success("Página reativada com sucesso!");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível reativar esta Página.");
    }
  });

  return <div className="space-y-4">
    <Card className="border-primary/20 bg-primary/5 shadow-none"><CardContent className="flex flex-col justify-between gap-3 p-4 sm:flex-row sm:items-center"><div><p className="text-sm font-semibold">Central Meta da corretora</p><p className="mt-1 text-sm text-muted-foreground">Conecte páginas, acompanhe ativos e encaminhe cada origem para a fila certa — sem ponto solto e sem expor ativos de outras empresas.</p></div><Button variant="outline" size="sm" render={<a href="/leads/distribuicao" />}>Abrir filas e regras</Button></CardContent></Card>
    <LeadAdsWizard props={props} />
    <Card className="border-border shadow-none">
        <CardHeader>
          <CardTitle className="text-base">Páginas conectadas</CardTitle>
          <CardDescription>Uma Página só pode pertencer a uma empresa. Remover interrompe novos recebimentos e preserva o histórico.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {props.leadAdSources.length ? props.leadAdSources.map((source) => (
            <div key={source.id} className="flex flex-col gap-2 rounded-md border border-border px-3 py-2 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2 w-full">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">Página {source.pageId}</span>
                  <Badge variant={source.status === "active" ? "success" : "outline"}>{source.status === "active" ? "Ativa" : "Removida"}</Badge>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground">Último lead: {date(source.lastLeadAt)}</span>
                  {source.status === "active" ? (
                    <Button variant="outline" size="sm" type="button" disabled={removing} onClick={() => removeSource(source.id)}>{removing ? "Removendo…" : "Remover"}</Button>
                  ) : (
                    <Button variant="default" size="sm" type="button" disabled={removing} onClick={() => reactivateSource(source.pageId)}>{removing ? "Reativando…" : "Reativar"}</Button>
                  )}
                </div>
              </div>
              {source.status === "active" ? (
                <SourceDistributionSelector source={source} branches={props.branches} />
              ) : null}
            </div>
          )) : <p className="text-sm text-muted-foreground">Nenhuma Página ativa ainda.</p>}
        </CardContent>
    </Card>
    <OperationalAssetsControl props={props} />
    <InventorySummary inventory={props.inventory} />
  </div>;
}
