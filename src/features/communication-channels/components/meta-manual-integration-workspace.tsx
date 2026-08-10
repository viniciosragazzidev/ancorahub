"use client";

import { useState, useTransition } from "react";
import type { ReactNode } from "react";
import { toast } from "sonner";

import { ArrowSquareOut, CheckCircle, Copy, Warning } from "@/components/huge-icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AppSelect } from "@/components/ui/select";
import {
  confirmManualMetaLeadAdsAssetsAction,
  discoverManualMetaLeadAdsAssetsAction,
  pauseManualMetaLeadAdsSourceAction,
  reactivateManualMetaLeadAdsSourceAction,
  updateMetaLeadAdSourceDistributionAction,
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

function MetaLink({ href, children }: { href: string; children: ReactNode }) {
  return <a className="inline-flex items-center gap-1 font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" href={href} rel="noreferrer" target="_blank">{children}<ArrowSquareOut aria-hidden="true" className="size-3.5" /></a>;
}

function LeadAdsWizard({ props }: { props: Props }) {
  const [discovery, setDiscovery] = useState<{ pages: Asset[]; adAccounts: Asset[]; pixels: Asset[]; datasets: Asset[] } | null>(null);
  const [selectedPages, setSelectedPages] = useState<string[]>([]);
  const [adAccountId, setAdAccountId] = useState("");
  const [pixelId, setPixelId] = useState("");
  const [datasetId, setDatasetId] = useState("");
  const [pending, startTransition] = useTransition();

  const discover = () => startTransition(async () => {
    const result = await discoverManualMetaLeadAdsAssetsAction();
    if (result.error) { toast.error(result.error); return; }
    setDiscovery(result.assets ?? null);
    setSelectedPages([]);
    toast.success(result.assets?.pages.length ? "Ativos autorizados encontrados." : "Nenhuma Página foi encontrada ainda.");
  });
  const confirm = () => startTransition(async () => {
    try {
      await confirmManualMetaLeadAdsAssetsAction({ pageIds: selectedPages, adAccountId, pixelId, datasetId });
      toast.success("Páginas ativadas. Novos leads entrarão na fila central.");
      setDiscovery(null);
      setSelectedPages([]);
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
    <Card className="border-border shadow-none"><CardHeader><Badge variant="info" className="w-fit">Passo 3 de 4</Badge><CardTitle className="mt-2">Busque a Página autorizada</CardTitle><CardDescription>O AncoraHub consulta a Meta com a credencial técnica central. Apenas Páginas efetivamente compartilhadas aparecem na lista.</CardDescription></CardHeader><CardContent><Button onClick={discover} disabled={pending}>{pending ? "Buscando…" : "Buscar ativos autorizados"}</Button>{discovery && !discovery.pages.length ? <div className="mt-4 rounded-md border border-warning/30 bg-warning/10 p-3 text-sm"><p className="font-medium">Nenhuma Página encontrada</p><p className="mt-1 leading-6 text-muted-foreground">Confira o parceiro, a Página compartilhada e o Acesso a leads. Se estiver tudo correto, aguarde a confirmação técnica e tente novamente. Não envie token ao suporte.</p></div> : null}</CardContent></Card>
    {discovery?.pages.length ? <Card className="border-border shadow-none"><CardHeader><Badge variant="info" className="w-fit">Passo 4 de 4</Badge><CardTitle className="mt-2">Escolha e ative</CardTitle><CardDescription>As Páginas selecionadas passam a enviar novos leads para a fila central. Conta, Pixel e Dataset são opcionais e só preparam relatórios futuros.</CardDescription></CardHeader><CardContent className="space-y-5"><fieldset className="space-y-2"><legend className="text-sm font-medium">Páginas para receber Lead Ads</legend>{discovery.pages.map((page) => <label key={page.id} className="flex items-center gap-3 rounded-md border border-border px-3 py-2 text-sm"><input type="checkbox" checked={selectedPages.includes(page.id)} onChange={(event) => setSelectedPages((current) => event.target.checked ? [...current, page.id] : current.filter((id) => id !== page.id))} /><span className="min-w-0 flex-1 truncate">{page.name || "Página sem nome"}</span><span className="text-xs text-muted-foreground">{page.id}</span></label>)}</fieldset><div className="grid gap-4 md:grid-cols-3"><AssetSelect label="Conta de anúncios" value={adAccountId} onChange={setAdAccountId} items={discovery.adAccounts} /><AssetSelect label="Pixel" value={pixelId} onChange={setPixelId} items={discovery.pixels} /><AssetSelect label="Dataset" value={datasetId} onChange={setDatasetId} items={discovery.datasets} /></div><Button onClick={confirm} disabled={pending || !selectedPages.length}>{pending ? "Ativando…" : `Ativar ${selectedPages.length || "as"} Página${selectedPages.length === 1 ? "" : "s"}`}</Button><p className="text-sm text-muted-foreground">Depois da ativação, envie um formulário fictício pela <MetaLink href="https://developers.facebook.com/tools/lead-ads-testing/">ferramenta de teste de Lead Ads</MetaLink> e confirme a origem Meta Lead Ads na lista de Leads.</p></CardContent></Card> : null}
  </div>;
}

function AssetSelect({ label, value, onChange, items }: { label: string; value: string; onChange(value: string): void; items: Asset[] }) {
  return (
    <label className="grid gap-1.5 text-sm font-medium">
      {label}
      <AppSelect
        value={value}
        onValueChange={onChange}
        options={[
          { value: "", label: "Não selecionar agora" },
          ...items.map((item) => ({ value: item.id, label: item.name || item.id })),
        ]}
      />
    </label>
  );
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
  </div>;
}
