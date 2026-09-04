"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle, LockKey, Monitor, WarningCircle, WhatsappLogo } from "@/components/huge-icons";
import { cn } from "@/lib/utils";
import { toast } from "@/components/ui/sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogDescription, DialogPopup, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { wahaActionErrorMessage } from "@/lib/waha-error-codes";
import {
  forceDisconnectWhatsAppSession,
  getWhatsAppConnection,
  getWhatsAppSessionStatus,
  recoverWhatsAppFailedSessionAction,
  refreshWhatsAppQr,
  resetWhatsAppSessionAction,
  startWhatsAppConnection,
  toggleWhatsAppChatAction,
} from "@/app/(dashboard)/settings/whatsapp-actions";

type Connection = Awaited<ReturnType<typeof getWhatsAppConnection>>;

function statusLabel(status: string): string {
  switch (status) {
    case "ready": return "Conectado";
    case "initializing": return "Conectando…";
    case "recovering": return "Recuperando…";
    case "error": return "Erro";
    default: return "Desconectado";
  }
}

/** Step indicator for the connection flow */
function ConnectionSteps({ status, hasQr }: { status: string; hasQr: boolean }) {
  const steps = [
    { label: "Iniciar", done: status !== "disconnected" },
    { label: "Escaneie", done: status === "ready" },
    { label: "Conectado", done: status === "ready" },
  ];
  // If we have a QR, step 2 is in progress
  const activeStep = status === "ready" ? 2 : hasQr ? 1 : status === "initializing" ? 0 : -1;

  return (
    <div className="flex items-center gap-1" role="list" aria-label="Progresso da conexão">
      {steps.map((step, i) => (
        <div key={step.label} className="flex items-center gap-1" role="listitem">
          <span
            className={cn(
              "flex size-5 items-center justify-center rounded-full text-[10px] font-semibold transition-all duration-300",
              step.done
                ? "bg-emerald-500 text-white"
                : i === activeStep
                  ? "bg-primary text-primary-foreground animate-pulse"
                  : "bg-muted text-muted-foreground",
            )}
          >
            {step.done ? "✓" : i + 1}
          </span>
          <span className={cn(
            "text-[11px] font-medium transition-colors duration-300",
            step.done ? "text-emerald-600" : i === activeStep ? "text-foreground" : "text-muted-foreground",
          )}>
            {step.label}
          </span>
          {i < steps.length - 1 && (
            <span className={cn(
              "mx-1 h-px w-4 transition-colors duration-300",
              step.done ? "bg-emerald-300" : "bg-border",
            )} />
          )}
        </div>
      ))}
    </div>
  );
}

function errorMessage(code?: string | null): string {
  return wahaActionErrorMessage(code);
}

export function WhatsAppConnectDialog({ initial, returnTo, triggerLabel = "Conectar WhatsApp", connectedLabel = "WhatsApp conectado", onConnectionChanged }: { initial: Connection; returnTo?: string; triggerLabel?: string; connectedLabel?: string; onConnectionChanged?: (connection?: Connection) => void }) {
  const router = useRouter();
  const [connection, setConnection] = useState(initial);
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const previousStatus = useRef(initial.status);
  const polling = useRef(false);
  const ready = connection.status === "ready";
  const initializing = connection.status === "initializing" || connection.status === "recovering";
  const hasError = connection.status === "error";
  const label = statusLabel(connection.status);

  // Elapsed time since QR was shown
  const [elapsed, setElapsed] = useState(0);
  const qrShownAt = useRef<number | null>(null);

  useEffect(() => {
    if (initializing && connection.qrCode && !qrShownAt.current) {
      qrShownAt.current = Date.now();
    } else if (!initializing || !connection.qrCode) {
      qrShownAt.current = null;
      setElapsed(0);
    }
  }, [initializing, connection.qrCode]);

  useEffect(() => {
    if (!qrShownAt.current) return;
    const tick = () => {
      if (qrShownAt.current) setElapsed(Math.floor((Date.now() - qrShownAt.current) / 1000));
    };
    tick();
    const timer = window.setInterval(tick, 1_000);
    return () => window.clearInterval(timer);
  }, [!!qrShownAt.current]);

  useEffect(() => {
    setConnection((current) =>
      current.sessionId === initial.sessionId && current.status === initial.status
        ? current
        : initial,
    );
  }, [initial]);

  function recoverFromOutdatedAction(error: unknown): boolean {
    const message = error instanceof Error ? error.message : "";
    if (!/failed to find server action|older or newer deployment|fetch failed|failed to fetch/i.test(message)) return false;
    toast.info("O CorreTop foi atualizado. Carregando a versão atual da página...");
    window.setTimeout(() => window.location.reload(), 500);
    return true;
  }

  function showUnexpectedActionError(error: unknown) {
    if (!recoverFromOutdatedAction(error)) {
      const msg = error instanceof Error ? error.message : String(error);
      toast.error(msg || "Não foi possível conectar ao WhatsApp. Tente novamente.", { duration: 8000 });
    }
  }

  function updateStatus(status: string) {
    previousStatus.current = status;
    setConnection((current) => ({
      ...current,
      status,
      qrCode: status === "ready" ? null : current.qrCode,
      chatInternoAtivo: status === "ready" ? true : current.chatInternoAtivo,
    }));
  }

  async function pollStatus() {
    if (polling.current) return;
    polling.current = true;
    try {
      const result = await getWhatsAppSessionStatus();
      if (!result.success || !result.status) {
        // Se falhou ao consultar status, não atualizar UI — manter estado atual
        return;
      }
      if (result.status === "ready") {
        updateStatus("ready");
        // Notificar o parent ANTES de fechar — o parent faz fetch do server
        // para garantir dados frescos e exibe o toast.
        onConnectionChanged?.();
        setOpen(false);
        router.refresh();
        if (returnTo) router.replace(returnTo);
      } else {
        updateStatus(result.status);
        // Buscar QR code quando estiver aguardando pareamento
        if (result.status === "initializing") {
          const qr = await refreshWhatsAppQr();
          if (qr.success && qr.qrCode) {
            setConnection((current) => ({
              ...current,
              qrCode: qr.qrCode ?? current.qrCode,
              status: qr.status ?? current.status,
            }));
          }
        }
      }
    } catch (error) {
      showUnexpectedActionError(error);
    } finally {
      polling.current = false;
    }
  }

  // Polling adaptativo: 500ms durante tentativa de conexão, 1.5s em background
  useEffect(() => {
    if (!open || !connection.sessionId || connection.status === "ready") return;
    void pollStatus();
    const interval = connection.status === "initializing" ? 500 : 1_500;
    const timer = window.setInterval(() => startTransition(async () => pollStatus()), interval);
    return () => window.clearInterval(timer);
  }, [open, connection.sessionId, connection.status]);

  // Quando a aba voltar ao foco, refetch imediatamente (webhook pode ter atualizado o status)
  useEffect(() => {
    if (!open || !connection.sessionId || connection.status === "ready") return;
    function onVisibilityChange() {
      if (document.visibilityState === "visible") {
        startTransition(async () => {
          await pollStatus();
          router.refresh();
        });
      }
    }
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [open, connection.sessionId, connection.status]);

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen && connection.sessionId && connection.status !== "ready") {
      startTransition(async () => {
        await pollStatus();
        router.refresh();
      });
    }
  }

  function shouldBlockQrOnMobile() {
    if (!window.matchMedia("(max-width: 767px)").matches) return false;
    toast.info("Conecte o WhatsApp em um computador para gerar e ler o QR Code.");
    return true;
  }

  function openWhatsAppExternal() {
    const isMobile = window.matchMedia("(max-width: 767px)").matches;
    const destination = isMobile ? "whatsapp://send" : "https://web.whatsapp.com/";
    window.open(destination, "_blank", "noopener,noreferrer");
  }

  /**
   * Iniciar conexão WhatsApp.
   * 
   * CRÍTICO: NÃO destruir sessão existente antes de criar nova.
   * O endpoint Fastify /connections é idempotente — se a sessão já existe,
   * ele retorna o status atual sem recriar. Destruir antes causava:
   * 1. QR em pareamento era invalidado instantaneamente
   * 2. Erros de Server Component quando WAHA retornava erro durante destruição
   */
  function start() {
    if (shouldBlockQrOnMobile()) return;
    startTransition(async () => {
      try {
        // Chamada direta e idempotente: evita verificações de saúde redundantes antes do QR.
        // O Fastify devolve erro tipado caso WAHA/VPS esteja indisponível.
        // NÃO chamar resetWhatsAppSessionAction() antes!
        const result = await startWhatsAppConnection();
        if (!result.success) {
          const code = (result as { code?: string }).code;
          toast.error(errorMessage(code), { duration: 8000 });
          return;
        }
        // A action já busca o QR uma vez. Não repetir a mesma chamada antes do polling.
        const newQrCode = (result as { qrCode?: string | null }).qrCode ?? null;
        setConnection((current) => ({
          ...current,
          sessionId: result.sessionId ?? current.sessionId,
          qrCode: newQrCode ?? current.qrCode,
          status: result.status ?? "initializing",
        }));
        if (newQrCode) {
          toast.success("Escaneie o QR Code no WhatsApp.");
        } else {
          toast.info("Preparando conexão...");
        }
        await pollStatus();
      } catch (error) {
        showUnexpectedActionError(error);
      }
    });
  }

  function refresh() {
    if (shouldBlockQrOnMobile()) return;
    startTransition(async () => {
      try {
        const result = await refreshWhatsAppQr();
        if (!result.success) {
          const code = (result as { code?: string }).code;
          toast.error(errorMessage(code));
        } else {
          setConnection((current) => ({
            ...current,
            qrCode: result.qrCode ?? current.qrCode,
            status: result.status ?? current.status,
          }));
          await pollStatus();
        }
      } catch (error) {
        showUnexpectedActionError(error);
      }
    });
  }

  function toggle() {
    startTransition(async () => {
      try {
        const result = await toggleWhatsAppChatAction();
        if (!result.success) toast.error(result.error);
        else {
          setConnection((current) => ({ ...current, chatInternoAtivo: result.active ?? current.chatInternoAtivo }));
          toast.success(result.active ? "Chat interno ativado." : "Chat interno desativado.");
        }
      } catch (error) {
        showUnexpectedActionError(error);
      }
    });
  }

  function disconnect() {
    startTransition(async () => {
      try {
        const result = await resetWhatsAppSessionAction();
        if (!result.success) {
          // Se o VPS está inacessível, oferecer opção de forçar desconexão local
          if (result.code === "WAHA_UNREACHABLE" || result.code === "WAHA_TIMEOUT") {
            toast.error(
              "O servidor WhatsApp está inacessível. Você pode forçar a desconexão local, mas a sessão remota pode permanecer ativa até o timeout do servidor.",
              {
                duration: 10000,
                action: {
                  label: "Forçar desconexão",
                  onClick: () => forceDisconnect(),
                },
              },
            );
          } else {
            toast.error(errorMessage(result.code));
          }
          return;
        }
        setConnection((current) => ({
          ...current,
          sessionId: null,
          sessionName: null,
          qrCode: null,
          status: "disconnected",
          connectedAt: null,
        }));
        onConnectionChanged?.();
        toast.success("WhatsApp desconectado.");
        router.refresh();
      } catch (error) {
        showUnexpectedActionError(error);
      }
    });
  }

  function forceDisconnect() {
    startTransition(async () => {
      try {
        const result = await forceDisconnectWhatsAppSession();
        if (!result.success) {
          toast.error("Não foi possível limpar a sessão local.");
          return;
        }
        setConnection((current) => ({
          ...current,
          sessionId: null,
          sessionName: null,
          qrCode: null,
          status: "disconnected",
          connectedAt: null,
        }));
        onConnectionChanged?.();
        toast.success("Sessão desconectada localmente. A sessão remota será encerrada automaticamente pelo servidor.");
        router.refresh();
      } catch (error) {
        showUnexpectedActionError(error);
      }
    });
  }

  function resetAndRetry() {
    startTransition(async () => {
      try {
        updateStatus("recovering");
        const result = await recoverWhatsAppFailedSessionAction();
        if (!result.success) {
          updateStatus("error");
          toast.error(errorMessage(result.code));
          return;
        }
        setConnection((current) => ({
          ...current,
          sessionId: result.sessionId ?? current.sessionId,
          qrCode: result.qrCode ?? null,
          status: result.status ?? "initializing",
          connectedAt: result.status === "ready" ? current.connectedAt : null,
        }));
        if (result.qrCode) toast.success("Escaneie o novo QR Code no WhatsApp.");
        await pollStatus();
      } catch (error) {
        showUnexpectedActionError(error);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={<Button variant={ready ? "outline" : "default"}><WhatsappLogo /> {ready ? connectedLabel : triggerLabel}</Button>} />
      <DialogPopup className="max-w-2xl">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <DialogTitle className="flex items-center gap-2"><WhatsappLogo className="text-success" /> WhatsApp</DialogTitle>
            <DialogDescription className="mt-2">
              Conecte seu WhatsApp para iniciar seus atendimentos.
            </DialogDescription>
            {/* Step indicator */}
            {connection.sessionId && (
              <div className="mt-3">
                <ConnectionSteps status={connection.status} hasQr={!!connection.qrCode} />
              </div>
            )}
          </div>
          <Badge variant={ready ? "success" : "outline"} className="ct-status-badge shrink-0">{label}</Badge>
        </div>

        <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_15rem]">
          <div className="space-y-4">
            {/* Estado: Conectado */}
            {ready && (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-4 ct-connect-success">
                <div className="flex items-center gap-2">
                  <span className="ct-connected-pulse size-2 rounded-full bg-emerald-500" />
                  <p className="text-sm font-semibold text-emerald-700">Online</p>
                </div>
                <p className="mt-1 text-xs leading-5 text-emerald-600/80">
                  Seu WhatsApp está pronto para os atendimentos.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button disabled={pending} onClick={toggle} variant="outline" size="sm">
                    {connection.chatInternoAtivo ? "Desativar chat" : "Ativar chat"}
                  </Button>
                  <Button disabled={pending} onClick={disconnect} variant="outline" size="sm">
                    Desconectar
                  </Button>
                </div>
              </div>
            )}

            {/* Estado: Erro (FAILED / ERROR no WAHA) */}
            {!ready && hasError && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
                <div className="flex items-start gap-2">
                  <WarningCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
                  <div>
                    <p className="text-sm font-semibold text-destructive">Falha na conexão</p>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                      Não foi possível concluir o pareamento. Verifique se o WhatsApp está instalado e tente novamente.
                    </p>
                    <Button disabled={pending} onClick={resetAndRetry} variant="outline" size="sm" className="mt-3">
                      Tentar novamente
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Estado: Inicializando / Aguardando QR */}
            {!ready && !hasError && initializing && (
              <div className="rounded-lg border border-border bg-muted/30 p-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold">
                    {connection.qrCode ? "Escaneie o QR Code" : "Preparando sua conexão…"}
                  </p>
                  {connection.qrCode && elapsed > 0 && (
                    <span className="text-[11px] tabular-nums text-muted-foreground">
                      {elapsed}s
                    </span>
                  )}
                </div>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  {connection.qrCode
                    ? "Abra o WhatsApp no celular, vá em Dispositivos conectados e escaneie o código."
                    : "Gerando QR Code..."}
                </p>
                {connection.qrCode && elapsed > 30 && (
                  <p className="mt-2 text-[11px] text-amber-600">
                    QR Code pode expirar. Se não escanear em breve, gere um novo.
                  </p>
                )}
              </div>
            )}

            {/* Estado: Desconectado (sem sessão) */}
            {!ready && !hasError && !initializing && (
              <div className="rounded-lg border border-border bg-muted/30 p-4">
                <p className="text-sm font-semibold">Chat interno {connection.chatInternoAtivo ? "ativo" : "desativado"}</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Clique em Conectar para gerar um QR Code e vincular seu WhatsApp.
                </p>
              </div>
            )}

            {/* Aviso mobile */}
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 md:hidden" role="status">
              <div className="flex items-start gap-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary"><Monitor className="size-4" /></span>
                <div>
                  <p className="text-sm font-semibold">Conexão somente pelo computador</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">Para gerar e ler o QR Code, abra esta integração em um computador. Volte ao celular depois para acompanhar o status.</p>
                </div>
              </div>
            </div>

            {/* Botões de ação */}
            <div className="flex flex-wrap gap-2">
              <div className="hidden flex-wrap gap-2 md:flex">
                <Button disabled={pending} onClick={hasError ? resetAndRetry : start}>
                  {connection.sessionId ? "Conectar novamente" : "Conectar WhatsApp"}
                </Button>
                {initializing && connection.qrCode && (
                  <Button disabled={pending} onClick={refresh} variant="outline">
                    Gerar novo QR
                  </Button>
                )}
              </div>
            </div>
            <Button className="w-full md:w-auto" onClick={openWhatsAppExternal} size="sm" variant="outline">
              <WhatsappLogo className="size-4" /> Abrir WhatsApp Web ou app
            </Button>
          </div>

          {/* QR Code panel */}
          <div className="hidden min-h-56 items-center justify-center rounded-lg bg-white p-3 md:flex">
            {connection.qrCode && !ready ? (
              <img
                alt="QR Code para conectar o WhatsApp"
                className="ct-qr-enter size-48"
                src={connection.qrCode.startsWith("data:") ? connection.qrCode : `data:image/png;base64,${connection.qrCode}`}
              />
            ) : (
              <div className="text-center text-slate-600">
                {ready ? (
                  <CheckCircle className="ct-connect-success mx-auto size-9 text-emerald-600" />
                ) : hasError ? (
                  <WarningCircle className="mx-auto size-7 text-destructive" />
                ) : (
                  <LockKey className={"mx-auto size-7" + (initializing ? " ct-waiting-breathe" : "")} />
                )}
                <p className="mt-2 text-xs font-medium">
                  {ready ? (
                    <span className="ct-qr-enter">Dispositivo conectado</span>
                  ) : hasError ? (
                    "Pareamento falhou"
                  ) : initializing ? (
                    <span className="ct-shimmer-text" data-text="Gerando QR Code…">Gerando QR Code…</span>
                  ) : (
                    "Clique em Conectar"
                  )}
                </p>
              </div>
            )}
          </div>
        </div>
      </DialogPopup>
    </Dialog>
  );
}
