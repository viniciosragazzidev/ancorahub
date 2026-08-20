"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle, LockKey, Monitor, WhatsappLogo } from "@/components/huge-icons";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogDescription, DialogPopup, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  diagnoseWahaConnection,
  getWhatsAppConnection,
  getWhatsAppSessionStatus,
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
    case "error": return "Erro";
    default: return "Desconectado";
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
  const initializing = connection.status === "initializing";
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
      if (!result.success || !result.status) return;
      if (result.status === "ready") {
        const wasReady = previousStatus.current === "ready";
        updateStatus("ready");
        if (!wasReady) toast.success("WhatsApp conectado com sucesso.");
        setOpen(false);
        router.refresh();
        if (returnTo) router.replace(returnTo);
      } else {
        updateStatus(result.status);
      }
    } catch (error) {
      showUnexpectedActionError(error);
    } finally {
      polling.current = false;
    }
  }

  // Polling durante WAITING_QR / STARTING — intervalo progressivo
  useEffect(() => {
    if (!open || !connection.sessionId || connection.status === "ready") return;
    void pollStatus();
    const timer = window.setInterval(() => startTransition(async () => pollStatus()), 1500);
    return () => window.clearInterval(timer);
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

  function start() {
    if (shouldBlockQrOnMobile()) return;
    startTransition(async () => {
      try {
        // Diagnóstico rápido: verificar se o VPS está acessível
        const diag = await diagnoseWahaConnection();
        if (!diag.ok) {
          toast.error(`Falha na conexão com o servidor: ${diag.error}`, { duration: 10000 });
          return;
        }
        // Se já existe sessão, resetar primeiro
        if (connection.sessionId) {
          await resetWhatsAppSessionAction();
          setConnection((current) => ({ ...current, sessionId: null, qrCode: null, status: "disconnected" }));
        }
        const result = await startWhatsAppConnection();
        if (!result.success) {
          toast.error(result.error, { duration: 8000 });
          return;
        }
        toast.success("Sessão iniciada. Escaneie o QR Code.");
        // Buscar QR imediatamente
        const qr = await refreshWhatsAppQr();
        if (qr.success) {
          setConnection((current) => ({
            ...current,
            sessionId: result.sessionId ?? current.sessionId,
            qrCode: qr.qrCode ?? current.qrCode,
            status: qr.status ?? "initializing",
          }));
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
        if (!result.success) toast.error(result.error);
        else {
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
        await resetWhatsAppSessionAction();
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
          <Badge variant={ready ? "success" : "outline"}>{label}</Badge>
        </div>

        <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_15rem]">
          <div className="space-y-4">
            {/* Estado: Conectado */}
            {ready && (
              <div className="rounded-lg border border-border bg-muted/30 p-4">
                <div className="flex items-center gap-2">
                  <span className="size-2 rounded-full bg-emerald-500" />
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

            {/* Estado: Inicializando / Aguardando QR */}
            {!ready && initializing && (
              <div className="rounded-lg border border-border bg-muted/30 p-4">
                <p className="text-sm font-semibold">Preparando sua conexão…</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Aguardando o QR Code do WhatsApp.
                </p>
              </div>
            )}

            {/* Estado: Desconectado */}
            {!ready && !initializing && (
              <div className="rounded-lg border border-border bg-muted/30 p-4">
                <p className="text-sm font-semibold">Chat interno {connection.chatInternoAtivo ? "ativo" : "desativado"}</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Se o pareamento for interrompido, use "Conectar" para gerar um QR Code limpo.
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
                <Button disabled={pending} onClick={start}>
                  {connection.sessionId ? "Conectar novamente" : "Conectar WhatsApp"}
                </Button>
                {initializing && (
                  <Button disabled={pending} onClick={refresh} variant="outline">
                    Gerar novo QR
                  </Button>
                )}
              </div>
            </div>

            {/* Diagnóstico: mostrar quando houver erro de conexão */}
            {!ready && connection.status === "error" && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                <p className="text-xs font-medium text-destructive">
                  Erro de conexão — verifique se o servidor WAHA está rodando no VPS.
                </p>
              </div>
            )}
          </div>

          {/* QR Code panel */}
          <div className="hidden min-h-56 items-center justify-center rounded-lg bg-white p-3 md:flex">
            {connection.qrCode && !ready ? (
              <img alt="QR Code para conectar o WhatsApp" className="size-48" src={connection.qrCode} />
            ) : (
              <div className="text-center text-slate-600">
                {ready ? (
                  <CheckCircle className="mx-auto size-9 text-emerald-600" />
                ) : (
                  <LockKey className="mx-auto size-7" />
                )}
                <p className="mt-2 text-xs font-medium">
                  {ready
                    ? "Dispositivo conectado"
                    : initializing
                      ? "Aguardando QR Code…"
                      : "Clique em Conectar"}
                </p>
              </div>
            )}
          </div>
        </div>
      </DialogPopup>
    </Dialog>
  );
}
