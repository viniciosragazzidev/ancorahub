"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle, LockKey, Monitor, WhatsappLogo } from "@/components/huge-icons";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogDescription, DialogPopup, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  getWhatsAppConnection,
  getWhatsAppSessionStatus,
  refreshWhatsAppQr,
  resetWhatsAppSessionAction,
  startWhatsAppConnection,
  toggleWhatsAppChatAction,
} from "@/app/(dashboard)/settings/whatsapp-actions";

type Connection = Awaited<ReturnType<typeof getWhatsAppConnection>>;

export function WhatsAppConnectDialog({ initial, returnTo, triggerLabel = "Conectar WhatsApp", connectedLabel = "WhatsApp conectado" }: { initial: Connection; returnTo?: string; triggerLabel?: string; connectedLabel?: string }) {
  const router = useRouter();
  const [connection, setConnection] = useState(initial);
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const previousStatus = useRef(initial.status);
  const polling = useRef(false);
  const ready = connection.status === "ready";
  const statusLabel = ready ? "Conectado" : connection.status === "initializing" ? "Iniciando" : connection.status === "qr_ready" ? "Aguardando leitura" : "Desconectado";

  function recoverFromOutdatedAction(error: unknown): boolean {
    const message = error instanceof Error ? error.message : "";
    if (!/failed to find server action|older or newer deployment|fetch failed|failed to fetch/i.test(message)) return false;
    toast.info("O CorreTop foi atualizado. Carregando a versão atual da página...");
    window.setTimeout(() => window.location.reload(), 500);
    return true;
  }

  function showUnexpectedActionError(error: unknown) {
    if (!recoverFromOutdatedAction(error)) toast.error("Não foi possível atualizar a conexão por QR. Tente novamente.");
  }

  function updateStatus(status: string) {
    previousStatus.current = status;
    setConnection((current) => ({ ...current, status, qrCode: status === "ready" ? null : current.qrCode, chatInternoAtivo: status === "ready" ? true : current.chatInternoAtivo }));
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
        if (!wasReady) toast.success("WhatsApp conectado. O chat interno está ativo.");
        setOpen(false);
        router.refresh();
        if (returnTo) router.replace(returnTo);
      } else updateStatus(result.status);
    } catch (error) {
      showUnexpectedActionError(error);
    } finally {
      polling.current = false;
    }
  }

  useEffect(() => {
    if (!open || !connection.sessionId || connection.status === "ready") return;
    void pollStatus();
    const timer = window.setInterval(() => startTransition(async () => pollStatus()), 700);
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
        if (connection.sessionId) {
          await resetWhatsAppSessionAction();
          setConnection((current) => ({ ...current, sessionId: null, qrCode: null, status: "disconnected" }));
        }
        const result = await startWhatsAppConnection();
        if (!result.success) {
          toast.error(result.error);
          return;
        }
        toast.success("Sessão iniciada. Escaneie o QR Code.");
        const qr = await refreshWhatsAppQr();
        if (qr.success) setConnection((current) => ({ ...current, qrCode: qr.qrCode ?? current.qrCode, status: qr.status ?? "initializing" }));
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
          setConnection((current) => ({ ...current, qrCode: result.qrCode ?? current.qrCode, status: result.status ?? current.status }));
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

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={<Button variant={ready ? "outline" : "default"}><WhatsappLogo /> {ready ? connectedLabel : triggerLabel}</Button>} />
      <DialogPopup className="max-w-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <DialogTitle className="flex items-center gap-2"><WhatsappLogo className="text-success" /> Conexão QR legada</DialogTitle>
            <DialogDescription className="mt-2">Alternativa temporária à Meta Cloud. Leia o QR Code no WhatsApp; o status é verificado em tempo real.</DialogDescription>
          </div>
          <Badge variant={ready ? "success" : "outline"}>{statusLabel}</Badge>
        </div>

        <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_15rem]">
          <div className="space-y-4">
            <div className="rounded-lg border border-border bg-muted/30 p-4">
              <p className="text-sm font-semibold">Chat interno {connection.chatInternoAtivo ? "ativo" : "desativado"}</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">Se o pareamento for interrompido, use “Nova sessão” para gerar um QR Code limpo.</p>
            </div>

            <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 md:hidden" role="status">
              <div className="flex items-start gap-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary"><Monitor className="size-4" /></span>
                <div>
                  <p className="text-sm font-semibold">Conexão somente pelo computador</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">Para gerar e ler o QR Code, abra esta integração em um computador. Volte ao celular depois para acompanhar o status.</p>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <div className="hidden flex-wrap gap-2 md:flex">
                <Button disabled={pending} onClick={start}>{connection.sessionId ? "Nova sessão" : "Gerar sessão"}</Button>
                <Button disabled={pending || !connection.sessionId} onClick={refresh} variant="outline">Atualizar QR</Button>
              </div>
              <Button disabled={pending || !ready} onClick={toggle} variant="outline">{connection.chatInternoAtivo ? "Desativar chat" : "Ativar chat"}</Button>
            </div>
          </div>

          <div className="hidden min-h-56 items-center justify-center rounded-lg bg-white p-3 md:flex">
            {connection.qrCode && !ready ? <img alt="QR Code para conectar o WhatsApp" className="size-48" src={connection.qrCode} /> : <div className="text-center text-slate-600">{ready ? <CheckCircle className="mx-auto size-9 text-emerald-600" /> : <LockKey className="mx-auto size-7" />}<p className="mt-2 text-xs font-medium">{ready ? "Dispositivo conectado" : connection.sessionId ? "Aguardando QR Code..." : "Gere uma sessão"}</p></div>}
          </div>
        </div>
      </DialogPopup>
    </Dialog>
  );
}
