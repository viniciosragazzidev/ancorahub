"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle, LockKey, Monitor, WarningCircle, WhatsappLogo } from "@/components/huge-icons";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogDescription, DialogPopup, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  diagnoseWahaConnection,
  getWhatsAppConnection,
  getWhatsAppSessionStatus,
  recoverWhatsAppFailedSessionAction,
  refreshWhatsAppQr,
  resetWhatsAppSessionAction,
  startWhatsAppConnection,
  toggleWhatsAppChatAction,
} from "@/app/(dashboard)/settings/whatsapp-actions";

type Connection = Awaited<ReturnType<typeof getWhatsAppConnection>>;

type ErrorCode = "WAHA_TIMEOUT" | "WAHA_UNAVAILABLE" | "WAHA_ERROR" | "SESSION_EXISTS" | "QR_ERROR" | "NO_SESSION";

function statusLabel(status: string): string {
  switch (status) {
    case "ready": return "Conectado";
    case "initializing": return "Conectando…";
    case "recovering": return "Recuperando…";
    case "error": return "Erro";
    default: return "Desconectado";
  }
}

function errorMessage(code?: string | null): string {
  switch (code) {
    case "WAHA_TIMEOUT": return "O servidor WhatsApp demorou para responder. Tente novamente.";
    case "WAHA_UNAVAILABLE": return "Serviço de WhatsApp temporariamente indisponível.";
    case "SESSION_EXISTS": return "Sessão já existe. Reconectando…";
    case "QR_ERROR": return "QR Code expirou ou indisponível. Gere um novo.";
    case "NO_SESSION": return "Nenhuma sessão ativa. Inicie uma nova conexão.";
    default: return "Não foi possível completar a operação. Tente novamente.";
  }
}

export function WhatsAppConnectDialog({ initial, returnTo, triggerLabel = "Conectar WhatsApp", connectedLabel = "WhatsApp conectado" }: { initial: Connection; returnTo?: string; triggerLabel?: string; connectedLabel?: string }) {
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
        const wasReady = previousStatus.current === "ready";
        updateStatus("ready");
        if (!wasReady) toast.success("WhatsApp conectado com sucesso.");
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
        // Diagnóstico rápido: verificar se o VPS está acessível
        const diag = await diagnoseWahaConnection();
        if (!diag.ok) {
          toast.error(`Serviço indisponível: ${diag.error}`, { duration: 10000 });
          return;
        }
        // IDEMPOTENTE: chamar start direto — Fastify decide reutilizar ou criar
        // NÃO chamar resetWhatsAppSessionAction() antes!
        const result = await startWhatsAppConnection();
        if (!result.success) {
          const code = (result as { code?: string }).code;
          toast.error(errorMessage(code), { duration: 8000 });
          return;
        }
        // Usar QR retornado pelo start e/ou buscar atualizado
        const qr = await refreshWhatsAppQr();
        const newQrCode = (qr.success ? qr.qrCode : null) ?? (result as { qrCode?: string | null }).qrCode ?? null;
        setConnection((current) => ({
          ...current,
          sessionId: result.sessionId ?? current.sessionId,
          qrCode: newQrCode ?? current.qrCode,
          status: (qr.success ? qr.status : null) ?? "initializing",
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
          toast.error(errorMessage(result.code));
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
        toast.success("WhatsApp desconectado.");
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
          <div>
            <DialogTitle className="flex items-center gap-2"><WhatsappLogo className="text-success" /> WhatsApp</DialogTitle>
            <DialogDescription className="mt-2">
              Conecte seu WhatsApp para iniciar seus atendimentos.
            </DialogDescription>
          </div>
          <Badge variant={ready ? "success" : "outline"} className="ct-status-badge">{label}</Badge>
        </div>

        <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_15rem]">
          <div className="space-y-4">
            {/* Estado: Conectado */}
            {ready && (
              <div className="rounded-lg border border-border bg-muted/30 p-4">
                <div className="flex items-center gap-2">
                  <span className="ct-connected-pulse size-2 rounded-full bg-emerald-500" />
                  <p className="text-sm font-semibold">Online</p>
                </div>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
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
                <p className="text-sm font-semibold">
                  {connection.qrCode ? "Escaneie o QR Code" : "Preparando sua conexão…"}
                </p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  {connection.qrCode
                    ? "Abra o WhatsApp no celular, vá em Dispositivos conectados e escaneie o código."
                    : "Gerando QR Code..."}
                </p>
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
                  <CheckCircle className="ct-qr-enter mx-auto size-9 text-emerald-600" />
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
