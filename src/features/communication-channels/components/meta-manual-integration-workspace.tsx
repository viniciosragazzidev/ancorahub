"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { CheckCircle, Copy, Gear, Warning, XCircle } from "@/components/huge-icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogClose, DialogFooter, DialogHeader, DialogPanel, DialogPopup, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input, type FormatType } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  completeManualMetaTutorialAction,
  configureManualMetaLeadAdsSourceAction,
  connectManualMetaConnectionAction,
  disconnectManualMetaConnectionAction,
  pauseManualMetaLeadAdsSourceAction,
  syncManualMetaConnectionAction,
  validateManualMetaConnectionAction,
  type ManualMetaActionState,
} from "../manual-meta-actions";

type Channel = {
  id: string;
  status: string;
  businessId: string | null;
  wabaId: string | null;
  phoneNumberId: string | null;
  displayPhoneNumber: string | null;
  verifiedName: string | null;
  qualityRating: string | null;
  messagingLimit: string | null;
  lastWebhookAt: Date | null;
  activatedAt: Date | null;
};

type Settings = {
  facebookPageId: string | null;
  adAccountId: string | null;
  pixelId: string | null;
  datasetId: string | null;
  tutorialCompletedAt: Date | null;
  lastSyncedAt: Date | null;
  lastError: string | null;
};

type Props = {
  enabled: boolean;
  serverReady: boolean;
  missingServerConfig: string[];
  leadAdsServerReady: boolean;
  leadAdsMissingServerConfig: string[];
  appId: string | null;
  webhookUrl: string;
  verifyTokenConfigured: boolean;
  channel: Channel | null;
  settings: Settings | null;
  logs: Array<{ id: string; action: string; createdAt: Date }>;
  branches: Array<{ id: string; name: string }>;
  leadAdSources: Array<{ id: string; pageId: string; adAccountId: string | null; branchId: string | null; status: string; lastWebhookAt: Date | null; lastLeadAt: Date | null; lastError: string | null }>;
};

const initialState: ManualMetaActionState = {};

function formatDate(value: Date | null) {
  return value ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "Ainda não sincronizado";
}

function CopyValue({ value, label }: { value: string; label: string }) {
  return <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/20 px-3 py-2">
    <code className="min-w-0 flex-1 truncate text-xs text-foreground">{value}</code>
    <Button type="button" variant="ghost" size="icon-sm" aria-label={`Copiar ${label}`} onClick={() => navigator.clipboard.writeText(value).then(() => toast.success(`${label} copiado.`))}>
      <Copy className="size-3.5" />
    </Button>
  </div>;
}

function Diagnostic({ label, status, detail }: { label: string; status: "ok" | "warning" | "error"; detail: string }) {
  const Icon = status === "ok" ? CheckCircle : status === "warning" ? Warning : XCircle;
  const variant = status === "ok" ? "success" : status === "warning" ? "warning" : "destructive";
  return <div className="flex items-center justify-between gap-4 rounded-lg border border-border bg-card px-4 py-3">
    <div className="flex min-w-0 items-center gap-3"><Icon className={status === "ok" ? "size-4 text-success" : status === "warning" ? "size-4 text-warning" : "size-4 text-destructive"} /><div><p className="text-sm font-medium">{label}</p><p className="text-xs text-muted-foreground">{detail}</p></div></div>
    <Badge variant={variant}>{status === "ok" ? "OK" : status === "warning" ? "Pendente" : "Atenção"}</Badge>
  </div>;
}

function TutorialDialog({ webhookUrl, verifyTokenConfigured, onComplete, leadAdsWebhookUrl }: { webhookUrl: string; verifyTokenConfigured: boolean; onComplete: () => void; leadAdsWebhookUrl: string }) {
  const [checked, setChecked] = useState(false);
  const steps = [
    ["Acesse a Meta Developers", "Entre em developers.facebook.com, abra o aplicativo oficial do AncoraHub e escolha o produto WhatsApp."],
    ["Configure o número", "Crie ou selecione a WhatsApp Business Account, adicione o número da empresa e conclua a verificação por SMS."],
    ["Copie os identificadores", "Anote Business ID, WABA ID e Phone Number ID. Eles serão usados na aba Geral deste assistente."],
    ["Configure o webhook", "No produto WhatsApp da Meta, informe a URL e o Verify Token abaixo. Assine o evento messages."],
    ["Gere o token", "Gere um token com permissões de WhatsApp Business e prefira um token permanente quando a Meta disponibilizar essa opção."],
    ["Conecte e teste", "Volte ao AncoraHub, preencha os campos, valide a conexão e salve. O token é conferido antes da ativação."],
  ];
  return <Dialog>
    <DialogTrigger render={<Button variant="outline"><Gear className="size-4" /> Como configurar?</Button>} />
    <DialogPopup className="max-w-3xl p-0">
      <DialogHeader className="border-b border-border p-6"><DialogTitle>Assistente de configuração Meta</DialogTitle><p className="text-sm text-muted-foreground">A integração manual é temporária. Este guia mostra exatamente o que fazer na Meta e o que colar no AncoraHub.</p></DialogHeader>
      <ScrollArea className="max-h-[65dvh] px-6 py-5"><div className="space-y-5">
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm text-muted-foreground">O aplicativo do AncoraHub já existe. Você não precisa criar um novo app. O App Secret e o Verify Token ficam protegidos na infraestrutura da plataforma e não devem ser enviados por mensagem ou e-mail.</div>
        <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border p-4 text-sm"><input checked={checked} onChange={(event) => setChecked(event.target.checked)} type="checkbox" className="mt-0.5 size-4 accent-primary" /><span><strong className="text-foreground">Pré-requisitos confirmados</strong><br />Tenho Business Manager, acesso de administrador, número disponível e acesso ao Meta Developers.</span></label>
        {steps.map(([title, body], index) => <div key={title} className="flex gap-4"><Badge variant="info" className="mt-0.5 size-6 justify-center rounded-full p-0">{index + 1}</Badge><div><p className="font-semibold text-foreground">{title}</p><p className="mt-1 text-sm leading-6 text-muted-foreground">{body}</p>{index === 0 ? <Button render={<a href="https://developers.facebook.com/" rel="noreferrer" target="_blank" />} className="mt-2" size="sm" variant="outline">Abrir Meta Developers</Button> : null}{index === 3 ? <div className="mt-3 space-y-2"><CopyValue value={webhookUrl} label="Webhook URL" /><CopyValue value={verifyTokenConfigured ? "Configurado com segurança no AncoraHub" : "Aguardando configuração no ambiente AncoraHub"} label="Status do Verify Token" /></div> : null}</div></div>)}
        <div className="rounded-xl border border-border bg-muted/20 p-4 text-sm"><p className="font-semibold text-foreground">Captação de Lead Ads é uma etapa separada</p><p className="mt-1 leading-6 text-muted-foreground">Para receber formulários de anúncios, compartilhe a Página com o AncoraHub, libere o app em Acesso a Leads e assine <code>leadgen</code> no objeto <code>Page</code>. Depois cadastre a Página na aba Marketing.</p><div className="mt-3"><CopyValue value={leadAdsWebhookUrl} label="Webhook de Lead Ads" /></div></div>
      </div></ScrollArea>
      <DialogFooter className="border-t border-border px-6 py-4"><DialogClose render={<Button variant="outline">Fechar</Button>} /><Button disabled={!checked} onClick={() => { void onComplete(); }}>Concluir tutorial</Button></DialogFooter>
    </DialogPopup>
  </Dialog>;
}

export function MetaManualIntegrationWorkspace(props: Props) {
  const formRef = useRef<HTMLFormElement>(null);
  const [validateState, validateAction, validating] = useActionState(validateManualMetaConnectionAction, initialState);
  const [connectState, connectAction, connecting] = useActionState(connectManualMetaConnectionAction, initialState);
  const [syncing, startSync] = useTransition();
  const [disconnecting, startDisconnect] = useTransition();
  const connected = props.channel?.status === "active";
  const leadAdsWebhookUrl = props.webhookUrl.replace(/\/whatsapp$/, "/lead-ads");
  const lastResult = connectState.result ?? validateState.result;
  const formError = connectState.error ?? validateState.error;
  const diagnostics = [
    ["Aplicativo AncoraHub", props.serverReady ? "ok" : "error", props.serverReady ? "Configuração privada disponível no servidor" : `Faltam: ${props.missingServerConfig.join(", ")}`],
    ["Business e WABA", connected ? "ok" : "warning", connected ? "Conta empresarial conectada" : "Conecte a conta pela aba Geral"],
    ["Token", connected ? "ok" : "warning", connected ? "Validado e salvo somente de forma cifrada" : "Será validado antes de salvar"],
    ["Webhook", props.verifyTokenConfigured ? "ok" : "warning", props.verifyTokenConfigured ? "Token de verificação configurado" : "Aguardando configuração do ambiente"],
    ["Número WhatsApp", connected ? "ok" : "warning", connected ? props.channel?.displayPhoneNumber ?? "Número validado" : "Aguardando conexão"],
    ["Captação Lead Ads", props.leadAdSources.some((source) => source.status === "active") ? "ok" : "warning", props.leadAdSources.some((source) => source.status === "active") ? "Página mapeada para receber leads" : "Ainda não configurada"],
    ["Credencial técnica Lead Ads", props.leadAdsServerReady ? "ok" : "error", props.leadAdsServerReady ? "Configurada somente no ambiente da plataforma" : `Faltam: ${props.leadAdsMissingServerConfig.join(", ")}`],
  ] as const;

  return <TooltipProvider><main className="flex min-h-full flex-col gap-6 bg-background p-4 lg:p-6">
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start"><div><p className="text-xs font-medium text-primary">CONFIGURAÇÕES • INTEGRAÇÕES</p><h1 className="mt-1 text-2xl font-semibold tracking-tight">Meta Business</h1><p className="mt-1 max-w-3xl text-sm text-muted-foreground">WhatsApp e captação por anúncios são configurados em trilhas separadas, com diagnóstico e segurança por empresa.</p></div><TutorialDialog webhookUrl={props.webhookUrl} leadAdsWebhookUrl={leadAdsWebhookUrl} verifyTokenConfigured={props.verifyTokenConfigured} onComplete={() => void completeManualMetaTutorialAction().then(() => toast.success("Tutorial marcado como concluído."))} /></div>

    <Card className="border-border bg-card shadow-none"><CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-start gap-3"><div className={connected ? "rounded-lg bg-success/10 p-2 text-success" : "rounded-lg bg-muted p-2 text-muted-foreground"}>{connected ? <CheckCircle className="size-5" /> : <Gear className="size-5" />}</div><div><p className="font-semibold">{connected ? "Meta Business conectado" : "Meta Business não conectado"}</p><p className="mt-1 text-sm text-muted-foreground">{connected ? `${props.channel?.verifiedName ?? "Conta empresarial"} • ${props.channel?.displayPhoneNumber ?? "Número validado"}` : "Siga o assistente para conectar os dados da conta da empresa."}</p></div></div><Badge variant={connected ? "success" : "outline"}>{connected ? "Conectado" : "Não conectado"}</Badge></CardContent></Card>

    {!props.enabled ? <Card className="border-warning/30 bg-warning/10 shadow-none"><CardContent className="flex items-start gap-3 p-4"><Warning className="mt-0.5 size-5 text-warning" /><div><p className="font-medium">Integração desativada pela plataforma</p><p className="mt-1 text-sm text-muted-foreground">Peça ao Super-admin para habilitar o WhatsApp oficial da Meta antes de conectar uma empresa.</p></div></CardContent></Card> : null}

    <Tabs defaultValue="general">
      <div className="overflow-x-auto"><TabsList variant="line" className="min-w-max"><TabsTrigger value="general">Geral</TabsTrigger><TabsTrigger value="tutorial">Tutorial</TabsTrigger><TabsTrigger value="whatsapp">WhatsApp</TabsTrigger><TabsTrigger value="webhooks">Webhooks</TabsTrigger><TabsTrigger value="marketing">Marketing</TabsTrigger><TabsTrigger value="diagnostics">Diagnóstico</TabsTrigger><TabsTrigger value="logs">Logs</TabsTrigger></TabsList></div>
      <TabsContent value="general" className="pt-6"><div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]"><Card className="border-border shadow-none"><CardHeader><CardTitle>{connected ? "Gerenciar conexão" : "Configurar integração"}</CardTitle><CardDescription>Preencha apenas os dados da conta do cliente. O App ID usado é o da plataforma e o App Secret não é exposto.</CardDescription></CardHeader><CardContent><form ref={formRef} action={connectAction} className="space-y-5"><div className="grid gap-4 sm:grid-cols-2"><Field href="https://business.facebook.com/settings/" name="businessId" label="Business Manager ID" defaultValue={props.channel?.businessId} required help="Encontrado em Configurações do negócio da Meta." /><Field href="https://developers.facebook.com/apps/" name="wabaId" label="WhatsApp Business Account ID" defaultValue={props.channel?.wabaId} required help="Identificador da conta WhatsApp empresarial." /><Field format="none" href="https://developers.facebook.com/apps/" name="phoneNumberId" label="Phone Number ID" defaultValue={props.channel?.phoneNumberId} required help="Identificador técnico do número, não o telefone exibido." /><Field autoComplete="new-password" description="Validado no servidor, cifrado em repouso e nunca exibido novamente." help="Gere na Meta Developers em WhatsApp &gt; API Setup. Use um token de acesso com permissões de WhatsApp Business." href="https://developers.facebook.com/apps/" inputMode="text" name="accessToken" label="Access Token" placeholder={connected ? "Cole um novo token apenas para atualizar" : "Cole o token gerado na Meta"} required={!connected} type="password" /></div><div className="rounded-lg border border-border bg-muted/20 p-4"><p className="text-sm font-medium">Dados opcionais de marketing</p><p className="mt-1 text-xs text-muted-foreground">Deixe vazio se ainda não usa esse recurso. Eles ficam preparados para sincronização futura.</p><div className="mt-4 grid gap-4 sm:grid-cols-2"><Field href="https://www.facebook.com/" name="facebookPageId" label="Facebook Page ID" defaultValue={props.settings?.facebookPageId} help="Página vinculada à empresa." /><Field href="https://adsmanager.facebook.com/adsmanager" name="adAccountId" label="Ad Account ID" defaultValue={props.settings?.adAccountId} help="Conta de anúncios da Meta." /><Field href="https://business.facebook.com/events_manager2/" name="pixelId" label="Pixel ID" defaultValue={props.settings?.pixelId} help="Pixel utilizado para conversões." /><Field href="https://business.facebook.com/events_manager2/manage/datasets" name="datasetId" label="Dataset ID" defaultValue={props.settings?.datasetId} help="Dataset de conversões, quando aplicável." /></div></div>{formError ? <p className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{formError}</p> : null}{lastResult ? <p className="rounded-lg border border-success/30 bg-success/10 p-3 text-sm text-success-foreground">Meta confirmou: {lastResult.verifiedName ?? lastResult.businessName ?? "conta validada"}{lastResult.displayPhoneNumber ? ` • ${lastResult.displayPhoneNumber}` : ""}.{lastResult.validatedMarketingResources.length ? ` Também validou: ${lastResult.validatedMarketingResources.join(", ")}.` : ""}</p> : null}<div className="flex flex-wrap gap-3"><Button disabled={!props.enabled || !props.serverReady || validating} type="button" variant="outline" onClick={() => { if (formRef.current) validateAction(new FormData(formRef.current)); }}>{validating ? "Validando…" : "Testar conexão"}</Button><Button disabled={!props.enabled || !props.serverReady || connecting} type="submit">{connecting ? "Conectando…" : connected ? "Atualizar conexão" : "Conectar Meta"}</Button></div></form></CardContent></Card><Card className="h-fit border-border shadow-none"><CardHeader><CardTitle className="text-base">Resumo da conta</CardTitle></CardHeader><CardContent className="space-y-4 text-sm"><KeyValue label="App ID" value={props.appId ?? "Aguardando configuração do servidor"} /><KeyValue label="Última sincronização" value={formatDate(props.settings?.lastSyncedAt ?? null)} /><KeyValue label="Último erro" value={props.settings?.lastError ?? "Nenhum erro registrado"} /><KeyValue label="Tutorial" value={props.settings?.tutorialCompletedAt ? "Concluído" : "Pendente"} /></CardContent></Card></div></TabsContent>
      <TabsContent value="tutorial" className="pt-6"><Card className="border-border shadow-none"><CardHeader><CardTitle>Configuração guiada</CardTitle><CardDescription>Abra o passo a passo, use os botões de cópia e só avance quando cada dado estiver confirmado na Meta.</CardDescription></CardHeader><CardContent><TutorialDialog webhookUrl={props.webhookUrl} leadAdsWebhookUrl={leadAdsWebhookUrl} verifyTokenConfigured={props.verifyTokenConfigured} onComplete={() => void completeManualMetaTutorialAction().then(() => toast.success("Tutorial marcado como concluído."))} /></CardContent></Card></TabsContent>
      <TabsContent value="whatsapp" className="pt-6"><Card className="border-border shadow-none"><CardHeader><CardTitle>WhatsApp oficial</CardTitle><CardDescription>Informações confirmadas pela Meta na última validação.</CardDescription></CardHeader><CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"><KeyValue label="Nome verificado" value={props.channel?.verifiedName ?? "Não conectado"} /><KeyValue label="Número" value={props.channel?.displayPhoneNumber ?? "Não conectado"} /><KeyValue label="Qualidade" value={props.channel?.qualityRating ?? "Ainda não disponível"} /><KeyValue label="WABA" value={props.channel?.wabaId ?? "—"} /><KeyValue label="Phone Number ID" value={props.channel?.phoneNumberId ?? "—"} /><KeyValue label="Último webhook" value={formatDate(props.channel?.lastWebhookAt ?? null)} /></CardContent></Card></TabsContent>
      <TabsContent value="webhooks" className="pt-6"><Card className="border-border shadow-none"><CardHeader><CardTitle>Webhook da Meta</CardTitle><CardDescription>Copie estes dados para o produto WhatsApp dentro da Meta Developers.</CardDescription></CardHeader><CardContent className="space-y-4"><div><p className="mb-2 text-sm font-medium">Callback URL</p><CopyValue value={props.webhookUrl} label="Callback URL" /></div><div><p className="mb-2 text-sm font-medium">Verify Token</p><p className="rounded-lg border border-border bg-muted/20 p-3 text-sm text-muted-foreground">{props.verifyTokenConfigured ? "Configurado com segurança no ambiente AncoraHub. Copie o valor entregue pelo administrador técnico." : "Ainda não configurado no ambiente da plataforma."}</p></div><p className="text-xs text-muted-foreground">Assine o evento <code>messages</code>. O webhook não recebe tenant pelo navegador: ele reconhece a empresa pelo número previamente conectado.</p></CardContent></Card></TabsContent>
      <TabsContent value="marketing" className="pt-6"><div className="space-y-4"><Card className="border-border shadow-none"><CardHeader><CardTitle>Captação manual de Lead Ads</CardTitle><CardDescription>O token técnico é mantido pela plataforma. Você só mapeia a Página compartilhada pelo cliente para a unidade que receberá os leads.</CardDescription></CardHeader><CardContent><form action={configureManualMetaLeadAdsSourceAction} className="grid gap-4 sm:grid-cols-2"><Field href="https://business.facebook.com/settings/" name="pageId" label="Facebook Page ID" help="Página que enviará os formulários Lead Ads." required /><Field href="https://adsmanager.facebook.com/adsmanager" name="adAccountId" label="Ad Account ID" help="Opcional: útil para diagnóstico e campanhas." /><div className="space-y-1.5"><Label htmlFor="branchId">Unidade de destino</Label><select id="branchId" name="branchId" className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 text-sm" defaultValue=""><option value="">Fila geral da empresa</option>{props.branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select><p className="text-xs text-muted-foreground">Sem unidade, o lead entra na fila geral central.</p></div><div className="flex items-end"><Button disabled={!props.leadAdsServerReady} type="submit">Ativar captação desta Página</Button></div></form>{!props.leadAdsServerReady ? <p className="mt-4 rounded-lg border border-warning/30 bg-warning/10 p-3 text-sm text-muted-foreground">A plataforma ainda precisa configurar: {props.leadAdsMissingServerConfig.join(", ")}.</p> : null}</CardContent></Card><Card className="border-border shadow-none"><CardHeader><CardTitle className="text-base">Páginas conectadas</CardTitle><CardDescription>Uma Página pertence a uma única empresa no AncoraHub. Pausar preserva o histórico e interrompe novas captações.</CardDescription></CardHeader><CardContent className="space-y-3">{props.leadAdSources.length ? props.leadAdSources.map((source) => <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border px-4 py-3" key={source.id}><div><p className="text-sm font-medium">Página {source.pageId}</p><p className="text-xs text-muted-foreground">Último lead: {formatDate(source.lastLeadAt)} · Último webhook: {formatDate(source.lastWebhookAt)}{source.lastError ? " · requer atenção" : ""}</p></div><form action={pauseManualMetaLeadAdsSourceAction}><input type="hidden" name="sourceId" value={source.id} /><Button type="submit" size="sm" variant="outline" disabled={source.status !== "active"}>{source.status === "active" ? "Pausar" : "Pausada"}</Button></form></div>) : <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">Nenhuma Página está recebendo Lead Ads ainda.</p>}</CardContent></Card><Card className="border-border shadow-none"><CardHeader><CardTitle className="text-base">Outros dados de marketing</CardTitle><CardDescription>Pixel e Dataset continuam opcionais, reservados para conversões e atribuição futura.</CardDescription></CardHeader><CardContent className="grid gap-4 sm:grid-cols-2"><KeyValue label="Pixel" value={props.settings?.pixelId ?? "Não configurado"} /><KeyValue label="Dataset" value={props.settings?.datasetId ?? "Não configurado"} /></CardContent></Card></div></TabsContent>
      <TabsContent value="diagnostics" className="pt-6"><div className="space-y-3">{diagnostics.map(([label, status, detail]) => <Diagnostic key={label} label={label} status={status} detail={detail} />)}<div className="flex flex-wrap gap-3 pt-3"><Button disabled={!connected || syncing} onClick={() => startSync(async () => { const result = await syncManualMetaConnectionAction(); if (result.error) toast.error(result.error); else toast.success("Informações da Meta sincronizadas."); })}>{syncing ? "Sincronizando…" : "Sincronizar agora"}</Button><Dialog><DialogTrigger render={<Button disabled={!connected} variant="destructive">Desconectar</Button>} /><DialogPopup><DialogPanel><DialogHeader><DialogTitle>Desconectar conta Meta?</DialogTitle><p className="text-sm text-muted-foreground">O canal será pausado e novos envios oficiais deixarão de usar este número. O histórico permanecerá disponível.</p></DialogHeader><DialogFooter><DialogClose render={<Button variant="outline">Cancelar</Button>} /><DialogClose render={<Button variant="destructive" disabled={disconnecting} onClick={() => startDisconnect(async () => { const result = await disconnectManualMetaConnectionAction(); if (result.error) toast.error(result.error); else toast.success("Conta Meta desconectada."); })}>{disconnecting ? "Desconectando…" : "Confirmar desconexão"}</Button>} /></DialogFooter></DialogPanel></DialogPopup></Dialog></div></div></TabsContent>
      <TabsContent value="logs" className="pt-6"><Card className="border-border shadow-none"><CardHeader><CardTitle>Histórico da integração</CardTitle><CardDescription>Eventos auditados sem expor token, segredo ou dados pessoais.</CardDescription></CardHeader><CardContent className="space-y-3">{props.logs.length ? props.logs.map((log) => <div className="flex items-center justify-between gap-4 rounded-lg border border-border px-4 py-3" key={log.id}><p className="text-sm font-medium">{log.action.replace("meta_manual.", "").replaceAll("_", " ")}</p><p className="text-xs text-muted-foreground">{formatDate(log.createdAt)}</p></div>) : <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">Nenhum evento registrado ainda.</p>}</CardContent></Card></TabsContent>
    </Tabs>
  </main></TooltipProvider>;
}

function Field({ name, label, defaultValue, help, required = false, format, href, type, autoComplete, placeholder, inputMode, description }: { name: string; label: string; defaultValue?: string | null; help: string; required?: boolean; format?: FormatType; href?: string; type?: string; autoComplete?: string; placeholder?: string; inputMode?: React.InputHTMLAttributes<HTMLInputElement>['inputMode']; description?: string }) {
  const guidance: Record<string, string> = {
    businessId: "Identifica a empresa dentro da Meta. Abra Configurações do negócio, selecione a empresa e copie o ID exibido em Informações da empresa.",
    wabaId: "É a conta que administra o WhatsApp Business. Encontre em Meta Developers, WhatsApp, API Setup.",
    phoneNumberId: "É o identificador técnico do número conectado, não é o telefone. Em Meta Developers, WhatsApp, API Setup, copie Phone number ID sem espaços.",
    accessToken: "Cole um token com acesso ao WhatsApp Business e à Página, quando houver. Ele é validado no servidor, cifrado e nunca é exibido novamente.",
    facebookPageId: "Opcional. Necessário no futuro para Lead Ads, comentários e Messenger. Encontre em Sobre, Transparência da Página ou Business Settings.",
    adAccountId: "Opcional. Usado para campanhas e Lead Ads. No Gerenciador de Anúncios, copie o ID da conta; o prefixo act_ é aceito.",
    pixelId: "Opcional por enquanto. Será usado em Conversões API, atribuição e análises.",
    datasetId: "Opcional por enquanto. Será usado quando a empresa enviar eventos de conversão à Meta.",
  };
  return <div className="space-y-1.5"><div className="flex items-center gap-1.5"><Label htmlFor={name}>{label}{required ? <span className="ml-1 text-destructive">*</span> : <span className="ml-1 text-xs font-normal text-muted-foreground">(opcional)</span>}</Label><Tooltip>{href ? <TooltipTrigger aria-label={`Ajuda sobre ${label}`} render={<a href={href} target="_blank" rel="noreferrer" />}><Warning className="size-3 text-muted-foreground hover:text-foreground transition-colors cursor-pointer" /></TooltipTrigger> : <TooltipTrigger aria-label={`Ajuda sobre ${label}`}><Warning className="size-3 text-muted-foreground" /></TooltipTrigger>}<TooltipContent>{guidance[name] ?? help}</TooltipContent></Tooltip></div><Input autoComplete={autoComplete} defaultValue={defaultValue ?? ""} format={format} id={name} inputMode={inputMode ?? "numeric"} name={name} placeholder={placeholder ?? "Ex.: 1234567890"} required={required} type={type} /><p className="text-xs leading-5 text-muted-foreground">{description ?? guidance[name] ?? help}</p></div>;
}

function KeyValue({ label, value }: { label: string; value: string }) {
  return <div><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 break-words text-sm font-medium text-foreground">{value}</p></div>;
}
