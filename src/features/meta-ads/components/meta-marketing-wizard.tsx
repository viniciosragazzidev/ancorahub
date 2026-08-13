"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { ArrowLeft, CheckCircle, Globe, Lightning, ListChecks, Megaphone, ShieldWarning, Target, Warning } from "@/components/huge-icons";
import { Button } from "@/components/ui/button";
import { Dialog, DialogDescription, DialogFooter, DialogHeader, DialogPopup, DialogTitle } from "@/components/ui/dialog";

import { confirmMetaConnection, getMetaMarketingAttemptAssets, recordMetaMarketingOnboardingStep } from "../actions";
import { createMetaMarketingOAuthUrl } from "../meta-marketing-oauth-url";
import type { MetaDiscoveredAssets } from "../types";
import { MetaAssetsReview } from "./meta-assets-modal";

type WizardStep = "intro" | "authorize" | "review" | "connecting" | "done";
type AuthState = "idle" | "starting" | "waiting" | "blocked" | "closed";

const STEP_ORDER: WizardStep[] = ["intro", "authorize", "review", "connecting", "done"];
const AUTH_ERRORS: Record<string, string> = {
  missing_parameters: "A Meta não retornou todos os dados da autorização. Tente novamente.",
  token_exchange_failed: "A Meta recusou a autorização. Confira as permissões da conta e tente novamente.",
  asset_discovery_failed: "A autorização foi aceita, mas não foi possível ler os ativos da Meta. Tente novamente.",
  authorization_persist_failed: "A autorização foi aceita, mas não foi possível salvá-la. Tente novamente.",
};
const WAITING_MESSAGES = [
  "Aguardando sua escolha no Facebook…",
  "Se você autorizar, buscamos páginas e contas de anúncios da corretora…",
  "Nenhuma publicação é feita sem a sua confirmação aqui.",
];
const CONNECTING_MESSAGES = [
  "Gravando a conexão da corretora…",
  "Assinando os formulários de Lead Ads nas páginas…",
  "Buscando campanhas, pixels e fontes na Meta…",
];

function trackOnboardingStep(event: string) {
  // Telemetria nunca deve bloquear o onboarding.
  try {
    void Promise.resolve(recordMetaMarketingOnboardingStep(event)).catch(() => {});
  } catch { /* ignora */ }
}

export function MetaMarketingWizard({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [step, setStep] = useState<WizardStep>("intro");
  const [authState, setAuthState] = useState<AuthState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [assets, setAssets] = useState<MetaDiscoveredAssets | null>(null);
  const [waitingIndex, setWaitingIndex] = useState(0);
  const [connectingIndex, setConnectingIndex] = useState(0);
  const popupRef = useRef<Window | null>(null);
  const attemptIdRef = useRef<string | null>(null);

  // Escuta o retorno do popup OAuth enquanto o assistente estiver montado.
  useEffect(() => {
    const listener = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type === "META_MARKETING_AUTH_ERROR") {
        setAuthState("idle");
        setError(AUTH_ERRORS[event.data.errorCode] || "A Meta não concluiu a autorização. Tente novamente.");
        popupRef.current?.close();
        popupRef.current = null;
        trackOnboardingStep("oauth_fail");
      }
      if (event.data?.type === "META_MARKETING_AUTH_SUCCESS" && typeof event.data.attemptId === "string") {
        attemptIdRef.current = event.data.attemptId;
        void getMetaMarketingAttemptAssets(event.data.attemptId)
          .then((result) => {
            setAssets(result);
            setAuthState("idle");
            setStep("review");
            trackOnboardingStep("oauth_success");
          })
          .catch(() => {
            setError("A autorização expirou. Recomece a conexão.");
            setAuthState("idle");
          });
      }
    };
    window.addEventListener("message", listener);
    return () => window.removeEventListener("message", listener);
  }, []);

  // Detecta popup fechado sem concluir a autorização.
  useEffect(() => {
    if (authState !== "waiting") return;
    const interval = window.setInterval(() => {
      const popup = popupRef.current;
      if (popup && popup.closed) {
        popupRef.current = null;
        setAuthState("closed");
        setError("Você fechou a janela do Facebook sem concluir a autorização. Tente novamente.");
      }
    }, 600);
    return () => window.clearInterval(interval);
  }, [authState]);

  // Microcopy rotativa enquanto espera o popup.
  useEffect(() => {
    if (authState !== "waiting") return;
    const interval = window.setInterval(() => setWaitingIndex((i) => (i + 1) % WAITING_MESSAGES.length), 2600);
    return () => window.clearInterval(interval);
  }, [authState]);

  // Microcopy rotativa durante a conexão.
  useEffect(() => {
    if (step !== "connecting") return;
    const interval = window.setInterval(() => setConnectingIndex((i) => (i + 1) % CONNECTING_MESSAGES.length), 900);
    return () => window.clearInterval(interval);
  }, [step]);

  const go = (next: WizardStep) => {
    setError(null);
    setStep(next);
  };

  const authorize = async () => {
    setError(null);
    setAuthState("starting");
    trackOnboardingStep("oauth_start");
    try {
      const response = await fetch("/api/integrations/meta/marketing/attempt", { method: "POST", cache: "no-store" });
      const payload = (await response.json().catch(() => null)) as { state?: string; message?: string } | null;
      if (!response.ok || !payload?.state) {
        throw new Error(payload?.message || "Não foi possível iniciar a conexão com a Meta.");
      }
      const redirectUri = `${window.location.origin}/api/integrations/meta/lead-ads/callback`;
      const oauthUrl = createMetaMarketingOAuthUrl({
        appId: process.env.NEXT_PUBLIC_META_LEAD_ADS_APP_ID || process.env.NEXT_PUBLIC_META_APP_ID,
        redirectUri,
        state: payload.state,
      });
      const popup = window.open(oauthUrl, "MetaMarketingOAuth", "width=600,height=700,scrollbars=yes,status=yes");
      if (!popup) {
        setAuthState("blocked");
        setError("Permita popups para conectar a Meta e tente novamente.");
        return;
      }
      popupRef.current = popup;
      setAuthState("waiting");
    } catch (cause) {
      setAuthState("idle");
      setError(cause instanceof Error ? cause.message : "Não foi possível iniciar a conexão com a Meta.");
    }
  };

  const confirm = async () => {
    if (!assets || !attemptIdRef.current) {
      setError("A autorização expirou. Recomece a conexão.");
      setStep("authorize");
      return;
    }
    setError(null);
    setStep("connecting");
    trackOnboardingStep("assets_confirm");
    try {
      await confirmMetaConnection({
        attemptId: attemptIdRef.current,
        businessId: assets.business.id,
        businessName: assets.business.name,
        pages: assets.pages.map(({ id, name }) => ({ id, name })),
        adAccounts: assets.adAccounts.map(({ id, name, currency }) => ({ id, name, currency })),
      });
      setStep("done");
      trackOnboardingStep("complete");
      router.refresh();
    } catch (cause) {
      setStep("review");
      setError(cause instanceof Error ? cause.message : "Não foi possível concluir a conexão com a Meta.");
    }
  };

  const close = (finished: boolean) => {
    if (!finished) trackOnboardingStep("abandon");
    onClose();
  };

  const stepIndex = Math.max(0, STEP_ORDER.indexOf(step));
  const progress = Math.round((stepIndex / (STEP_ORDER.length - 1)) * 100);

  return <Dialog open onOpenChange={(value) => { if (!value) close(step === "done"); }}><DialogPopup className="max-h-[88vh] max-w-2xl overflow-y-auto">
    <DialogHeader className="gap-1">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Globe className="size-5 text-primary" />
          <DialogTitle className="text-lg">Conectar Marketing da Meta</DialogTitle>
        </div>
        <span className="shrink-0 font-mono text-xs text-muted-foreground">{step === "done" ? "Concluído" : `Passo ${stepIndex} de 4`}</span>
      </div>
      <div className="h-1 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary transition-[width] duration-300" style={{ width: `${progress}%` }} />
      </div>
    </DialogHeader>

    {step === "intro" ? <div className="space-y-4 py-2">
      <DialogDescription>Vamos conectar os ativos de aquisição da corretora à Meta em alguns passos. Nada é publicado sem a sua confirmação.</DialogDescription>
      <div className="grid gap-3 sm:grid-cols-3">
        <IntroCard icon={<Megaphone className="size-5 text-primary" />} title="Páginas e campanhas" copy="Sincroniza páginas, contas de anúncios e campanhas existentes." />
        <IntroCard icon={<Target className="size-5 text-primary" />} title="Formulários e leads" copy="Captura formulários de Lead Ads e os leva para a fila do CRM." />
        <IntroCard icon={<ListChecks className="size-5 text-primary" />} title="Pixels e fontes" copy="Importa pixels, fontes e eventos para medir as conversões." />
      </div>
      <div className="flex items-start gap-2 rounded-lg border border-border bg-muted/30 p-3 text-sm">
        <ShieldWarning className="mt-0.5 size-4 shrink-0 text-warning" />
        <p className="text-muted-foreground">O WhatsApp oficial é uma conexão separada desta autorização. Você pode conectá-lo depois em <Link className="font-medium text-primary underline-offset-4 hover:underline" href="/integrations/whatsapp">Integrações › WhatsApp</Link>.</p>
      </div>
      <p className="rounded-lg bg-muted/50 p-3 text-xs leading-5 text-muted-foreground">Acesso de somente leitura para campanhas e formulários. Nenhum token fica visível nesta tela; credenciais são salvas cifradas.</p>
    </div> : null}

    {step === "authorize" ? <div className="space-y-4 py-2">
      <DialogDescription>Autorize com a conta de Facebook que administra o Business Manager da corretora. A Meta vai pedir as permissões abaixo — você só confirma no Facebook.</DialogDescription>
      <div className="space-y-2">
        <PermissionRow icon={<Megaphone className="size-4 text-primary" />} label="Páginas e engajamento" copy="Ler as páginas da corretora e o público." />
        <PermissionRow icon={<Target className="size-4 text-primary" />} label="Formulários de leads" copy="Ler os leads enviados pelos formulários de Lead Ads." />
        <PermissionRow icon={<ListChecks className="size-4 text-primary" />} label="Campanhas e anúncios" copy="Importar campanhas e métricas (somente leitura)." />
      </div>
      {authState === "waiting" ? <p role="status" className="flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm text-muted-foreground"><Loader />{WAITING_MESSAGES[waitingIndex]}</p> : null}
      {error ? <p role="alert" className="flex items-start gap-2 text-sm text-destructive"><Warning className="mt-0.5 size-4 shrink-0" />{error}</p> : null}
    </div> : null}

    {step === "review" && assets ? <div className="py-2">
      <DialogDescription>Confirme os ativos da corretora. Esta etapa grava a conexão e ativa a sincronização; o WhatsApp possui um conector independente.</DialogDescription>
      <MetaAssetsReview assets={assets} error={error} />
    </div> : null}

    {step === "connecting" ? <div className="space-y-4 py-6">
      <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-primary/10"><Loader className="size-6 text-primary" /></div>
      <p role="status" className="text-center text-sm font-medium text-foreground">{CONNECTING_MESSAGES[connectingIndex]}</p>
      <p className="text-center text-xs text-muted-foreground">A primeira sincronização pode levar alguns segundos. Não feche esta janela.</p>
    </div> : null}

    {step === "done" ? <div className="space-y-4 py-2">
      <div className="flex items-center gap-3 rounded-lg border border-success/30 bg-success/10 p-4">
        <CheckCircle className="size-6 shrink-0 text-success" />
        <div>
          <p className="font-semibold text-foreground">Marketing da Meta conectado!</p>
          <p className="text-sm text-muted-foreground">A primeira sincronização terminou: {assets ? `${assets.pages.length} página${assets.pages.length === 1 ? "" : "s"} e ${assets.adAccounts.length} conta${assets.adAccounts.length === 1 ? "" : "s"} de anúncios.` : "campanhas e leads disponíveis."}</p>
        </div>
      </div>
      <div className="rounded-lg border border-border">
        <p className="border-b border-border px-4 py-3 text-sm font-semibold">Próximos passos</p>
        <ul className="divide-y divide-border">
          <NextStep href="/integrations/whatsapp" label="Conectar o número oficial do WhatsApp" hint="O canal corporativo é independente do Marketing." />
          <NextStep href="/marketing" label="Conferir campanhas e formulários" hint="Veja o que já veio da Meta na primeira sincronização." />
          <NextStep href="/leads/distribuicao" label="Configurar as filas de distribuição" hint="Decida como os novos leads são distribuídos à equipe." />
          <li className="flex flex-col gap-0.5 px-4 py-3 text-sm"><span className="font-medium">Testar um lead de verdade</span><span className="text-xs text-muted-foreground">Envie um lead de teste na Meta e veja chegar em Conversas.</span></li>
        </ul>
      </div>
    </div> : null}

    <DialogFooter>
      {step === "intro" ? <>
        <Button variant="outline" onClick={() => close(false)}>Cancelar</Button>
        <Button onClick={() => { trackOnboardingStep("start"); go("authorize"); }}><Lightning className="size-4" />Começar</Button>
      </> : null}

      {step === "authorize" ? <>
        <Button variant="outline" disabled={authState === "starting"} onClick={() => go("intro")}><ArrowLeft className="size-4" />Voltar</Button>
        {authState === "blocked" || authState === "closed" ? <Button onClick={() => void authorize()}>Tentar novamente</Button>
          : <Button disabled={authState === "starting" || authState === "waiting"} onClick={() => void authorize()}>{authState === "starting" ? "Preparando conexão…" : authState === "waiting" ? "Aguardando Facebook…" : "Continuar com Facebook"}</Button>}
      </> : null}

      {step === "review" ? <>
        <Button variant="outline" onClick={() => go("authorize")}><ArrowLeft className="size-4" />Voltar</Button>
        <Button onClick={() => void confirm()}><CheckCircle className="size-4" />Confirmar e conectar</Button>
      </> : null}

      {step === "done" ? <>
        <Button variant="outline" render={<Link href="/marketing" />}>Ir para campanhas</Button>
        <Button onClick={() => close(true)}>Concluir</Button>
      </> : null}
    </DialogFooter>
  </DialogPopup></Dialog>;
}

function IntroCard({ icon, title, copy }: { icon: ReactNode; title: string; copy: string }) {
  return <div className="rounded-lg border border-border bg-card p-3"><div className="flex items-center gap-2">{icon}<p className="text-sm font-semibold">{title}</p></div><p className="mt-1.5 text-xs leading-5 text-muted-foreground">{copy}</p></div>;
}

function PermissionRow({ icon, label, copy }: { icon: ReactNode; label: string; copy: string }) {
  return <div className="flex items-start gap-2 rounded-lg border border-border bg-muted/20 p-3 text-sm">{icon}<div><p className="font-medium">{label}</p><p className="text-xs text-muted-foreground">{copy}</p></div></div>;
}

function NextStep({ href, label, hint }: { href: string; label: string; hint: string }) {
  return <li><Link className="flex flex-col gap-0.5 px-4 py-3 text-sm transition-colors hover:bg-muted/40" href={href}><span className="font-medium text-foreground">{label}</span><span className="text-xs text-muted-foreground">{hint}</span></Link></li>;
}

function Loader({ className = "size-4" }: { className?: string }) {
  return <span aria-hidden className={`animate-spin rounded-full border-2 border-current border-t-transparent ${className}`} />;
}
