"use client";

import { useActionState, useState, useTransition } from "react";
import { toast } from "sonner";

import { CheckCircle, Copy, Warning } from "@/components/huge-icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  confirmManualMetaLeadAdsAssetsAction,
  connectManualMetaConnectionAction,
  discoverManualMetaLeadAdsAssetsAction,
  pauseManualMetaLeadAdsSourceAction,
  reactivateManualMetaLeadAdsSourceAction,
  type ManualMetaActionState,
} from "../manual-meta-actions";

type Asset = { id: string; name?: string };
type Props = {
  leadAdsEnabled: boolean;
  leadAdsServerReady: boolean;
  leadAdsMissingServerConfig: string[];
  identity: { partnerName: string; businessId: string; supportWhatsApp: string };
  channel: { status: string; displayPhoneNumber: string | null; verifiedName: string | null } | null;
  leadAdSources: Array<{ id: string; pageId: string; status: string; lastWebhookAt: Date | null; lastLeadAt: Date | null; lastError: string | null }>;
};

const initialConnectionState: ManualMetaActionState = {};

function date(value: Date | null) {
  return value ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value)) : "Ainda não recebido";
}

function CopyValue({ label, value }: { label: string; value: string }) {
  return <div className="flex items-center gap-2 rounded-md border border-border bg-muted/30 px-3 py-2"><code className="min-w-0 flex-1 truncate text-sm">{value}</code><Button size="icon-sm" variant="ghost" type="button" aria-label={`Copiar ${label}`} onClick={() => navigator.clipboard.writeText(value).then(() => toast.success(`${label} copiado.`))}><Copy className="size-4" /></Button></div>;
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
    <Card className="border-border shadow-none"><CardHeader><Badge variant="info" className="w-fit">Passo 1</Badge><CardTitle className="mt-2">Compartilhe o acesso</CardTitle><CardDescription>Na Meta Business, adicione a Ancora Hub como parceiro e compartilhe as Páginas que enviam formulários. Garanta também que em <strong>Acesso a Leads (Lead Access)</strong> o CRM / parceiro esteja autorizado.</CardDescription></CardHeader><CardContent className="grid gap-4 sm:grid-cols-2"><div><p className="mb-2 text-sm font-medium">Parceiro</p><CopyValue label="nome do parceiro" value={props.identity.partnerName} /></div><div><p className="mb-2 text-sm font-medium">Business ID da Ancora Hub</p><CopyValue label="Business ID" value={props.identity.businessId} /></div><a className="text-sm text-primary underline-offset-4 hover:underline sm:col-span-2" href="https://business.facebook.com/settings/" target="_blank" rel="noreferrer">Abrir Configurações do negócio da Meta</a></CardContent></Card>
    <Card className="border-border shadow-none"><CardHeader><Badge variant="info" className="w-fit">Passo 2</Badge><CardTitle className="mt-2">Aguarde a confirmação técnica</CardTitle><CardDescription>A Ancora Hub confirma o acesso da credencial técnica e prepara o aplicativo para receber os formulários. Você não precisa informar token, App ID ou cadastrar um CRM manualmente na Meta.</CardDescription></CardHeader><CardContent><p className="text-sm text-muted-foreground">Quando a confirmação estiver pronta, siga para buscar os ativos autorizados.</p></CardContent></Card>
    <Card className="border-border shadow-none"><CardHeader><Badge variant="info" className="w-fit">Passo 3</Badge><CardTitle className="mt-2">Buscar ativos autorizados</CardTitle><CardDescription>A plataforma consulta a Meta com a credencial técnica da Ancora Hub. Somente ativos efetivamente compartilhados aparecem aqui.</CardDescription></CardHeader><CardContent><Button onClick={discover} disabled={pending}>{pending ? "Buscando…" : "Buscar ativos autorizados"}</Button>{discovery && !discovery.pages.length ? <div className="mt-4 rounded-md border border-warning/30 bg-warning/10 p-3 text-sm"><p className="font-medium">Nenhuma Página encontrada</p><p className="mt-1 text-muted-foreground">Se você redefiniu o Acesso a Leads no Meta Business Suite, acesse Integradores &gt; Acesso a Leads &gt; CRMs na Meta e autorize o aplicativo da Ancora Hub (ID {props.identity.businessId}). Se precisar de ajuda, fale com o suporte no WhatsApp {props.identity.supportWhatsApp}.</p></div> : null}</CardContent></Card>
    {discovery?.pages.length ? <Card className="border-border shadow-none"><CardHeader><Badge variant="info" className="w-fit">Passo 4</Badge><CardTitle className="mt-2">Escolha e ative</CardTitle><CardDescription>As Páginas selecionadas passam a enviar novos leads para a fila central da empresa. Conta, Pixel e Dataset são opcionais e apenas preparam relatórios futuros.</CardDescription></CardHeader><CardContent className="space-y-5"><fieldset className="space-y-2"><legend className="text-sm font-medium">Páginas para receber Lead Ads</legend>{discovery.pages.map((page) => <label key={page.id} className="flex items-center gap-3 rounded-md border border-border px-3 py-2 text-sm"><input type="checkbox" checked={selectedPages.includes(page.id)} onChange={(event) => setSelectedPages((current) => event.target.checked ? [...current, page.id] : current.filter((id) => id !== page.id))} /><span className="min-w-0 flex-1 truncate">{page.name || "Página sem nome"}</span><span className="text-xs text-muted-foreground">{page.id}</span></label>)}</fieldset><div className="grid gap-4 md:grid-cols-3"><AssetSelect label="Conta de anúncios" value={adAccountId} onChange={setAdAccountId} items={discovery.adAccounts} /><AssetSelect label="Pixel" value={pixelId} onChange={setPixelId} items={discovery.pixels} /><AssetSelect label="Dataset" value={datasetId} onChange={setDatasetId} items={discovery.datasets} /></div><Button onClick={confirm} disabled={pending || !selectedPages.length}>{pending ? "Ativando…" : `Ativar ${selectedPages.length || "as"} Página${selectedPages.length === 1 ? "" : "s"}`}</Button></CardContent></Card> : null}
  </div>;
}

function AssetSelect({ label, value, onChange, items }: { label: string; value: string; onChange(value: string): void; items: Asset[] }) {
  return <label className="grid gap-1.5 text-sm font-medium">{label}<select className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={value} onChange={(event) => onChange(event.target.value)}><option value="">Não selecionar agora</option>{items.map((item) => <option key={item.id} value={item.id}>{item.name || item.id}</option>)}</select></label>;
}

export function MetaManualIntegrationWorkspace(props: Props) {
  const [connection, connectAction, connecting] = useActionState(connectManualMetaConnectionAction, initialConnectionState);
  const [removing, startRemoving] = useTransition();
  const connected = props.channel?.status === "active";
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

  return <Tabs defaultValue="lead-ads" className="gap-5"><TabsList variant="line"><TabsTrigger value="lead-ads">Lead Ads</TabsTrigger><TabsTrigger value="whatsapp">WhatsApp</TabsTrigger><TabsTrigger value="status">Status</TabsTrigger></TabsList>
    <TabsContent value="lead-ads" className="pt-4">
      <LeadAdsWizard props={props} />
      <Card className="mt-4 border-border shadow-none">
        <CardHeader>
          <CardTitle className="text-base">Páginas conectadas</CardTitle>
          <CardDescription>Uma Página só pode pertencer a uma empresa. Remover interrompe novos recebimentos e preserva o histórico.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {props.leadAdSources.length ? props.leadAdSources.map((source) => (
            <div key={source.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-sm">
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
          )) : <p className="text-sm text-muted-foreground">Nenhuma Página ativa ainda.</p>}
        </CardContent>
      </Card>
    </TabsContent>
    <TabsContent value="whatsapp" className="pt-4"><Card className="border-border shadow-none"><CardHeader><CardTitle>WhatsApp oficial</CardTitle><CardDescription>Esta trilha permanece separada de Lead Ads e continua usando as credenciais do número oficial da empresa.</CardDescription></CardHeader><CardContent><form action={connectAction} className="grid gap-4 md:grid-cols-2"><Field name="businessId" label="Business Manager ID" /><Field name="wabaId" label="WhatsApp Business Account ID" /><Field name="phoneNumberId" label="Phone Number ID" /><Field name="accessToken" label="Access Token" secret />{connection.error ? <p className="text-sm text-destructive md:col-span-2">{connection.error}</p> : null}<Button className="w-fit" disabled={connecting} type="submit">{connecting ? "Validando…" : connected ? "Atualizar WhatsApp" : "Conectar WhatsApp"}</Button></form></CardContent></Card></TabsContent>
    <TabsContent value="status" className="pt-4"><Card className="border-border shadow-none"><CardContent className="grid gap-4 p-5 sm:grid-cols-2"><div><p className="text-xs text-muted-foreground">Lead Ads</p><p className="mt-1 font-medium">{props.leadAdSources.some((source) => source.status === "active") ? "Recebendo leads" : "Aguardando ativação"}</p></div><div><p className="text-xs text-muted-foreground">WhatsApp</p><p className="mt-1 font-medium">{connected ? `${props.channel?.verifiedName ?? "Número conectado"} • ${props.channel?.displayPhoneNumber ?? ""}` : "Não conectado"}</p></div></CardContent></Card></TabsContent>
  </Tabs>;
}

function Field({ name, label, secret = false }: { name: string; label: string; secret?: boolean }) {
  return <label className="grid gap-1.5 text-sm font-medium"><span>{label}</span><Input name={name} required type={secret ? "password" : "text"} autoComplete={secret ? "new-password" : undefined} /></label>;
}
