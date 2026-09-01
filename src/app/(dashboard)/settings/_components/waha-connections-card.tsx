"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle, LockKey, QrCode, SpinnerGap, WarningCircle, X } from "@phosphor-icons/react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPopup,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  changeWahaConnectionAction,
  createWahaConnectionAction,
  refreshWahaConnectionAction,
  updateWahaCapabilitiesAction,
  updateInternalBrokerNotificationPolicyAction,
} from "../waha-connection-actions";

type Connection = {
  id: string;
  label: string | null;
  scope: string;
  status: string;
  displayPhoneNumber: string;
  capabilities: {
    inbound: boolean;
    cadence: boolean;
    ai: boolean;
    brokerFallback?: boolean;
    qualificationFallback?: boolean;
  };
};

type InternalNotificationPolicy = {
  enabled: boolean;
  deliveryMode: "meta_then_waha" | "waha_direct";
  wahaNumberId: string | null;
};

export function WahaConnectionsCard({
  connections,
  role,
  enabled,
  internalNotificationPolicy = null,
}: {
  connections: Connection[];
  role: "director" | "manager";
  enabled: boolean;
  internalNotificationPolicy?: InternalNotificationPolicy | null;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [activeConnectingId, setActiveConnectingId] = useState<string | null>(null);
  const [disconnectTarget, setDisconnectTarget] = useState<Connection | null>(null);
  const scopeCopy = role === "director" ? "toda a empresa" : "a sua unidade";

  // Polling para atualizar QR Code e detectar quando o número for pareado
  useEffect(() => {
    if (!activeConnectingId) return;

    const interval = setInterval(async () => {
      try {
        const result = await refreshWahaConnectionAction(activeConnectingId);
        if (!result.success) return;

        if (result.result.qrCode) {
          setQrCode(result.result.qrCode);
        }

        const rawStatus = String(result.result.status || "").toLowerCase();
        if (rawStatus === "active" || rawStatus === "working" || rawStatus === "ready" || rawStatus === "connected") {
          setActiveConnectingId(null);
          setQrCode(null);
          toast.success("WhatsApp corporativo conectado com sucesso!");
          router.refresh();
        }
      } catch {
        // Ignorar falhas transitórias de polling
      }
    }, 2500);

    return () => clearInterval(interval);
  }, [activeConnectingId, router]);

  async function create(formData: FormData): Promise<void> {
    setPending(true);
    const result = await createWahaConnectionAction(formData);
    setPending(false);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    setActiveConnectingId(result.result.id);
    if (result.result.qrCode) {
      setQrCode(result.result.qrCode);
    }
    toast.success("Sessão iniciada. Escaneie o QR Code.");
    router.refresh();
  }

  async function refresh(id: string) {
    setPending(true);
    setActiveConnectingId(id);
    const result = await refreshWahaConnectionAction(id);
    setPending(false);
    if (!result.success) return toast.error(result.error);
    if (result.result.qrCode) setQrCode(result.result.qrCode);
    toast.success(result.result.status === "active" ? "Número conectado." : "QR atualizado.");
  }

  async function change(id: string, operation: "pause" | "resume" | "disconnect") {
    setPending(true);
    const result = await changeWahaConnectionAction(id, operation);
    setPending(false);
    if (!result.success) return toast.error(result.error);
    if (result.result.qrCode) setQrCode(result.result.qrCode);
    toast.success(
      operation === "disconnect"
        ? "Número desconectado."
        : operation === "pause"
          ? "Número pausado."
          : "Número retomado.",
    );
    router.refresh();
  }

  async function confirmDisconnect() {
    if (!disconnectTarget) return;
    const target = disconnectTarget;
    setDisconnectTarget(null);
    await change(target.id, "disconnect");
  }

  async function saveCapabilities(id: string, formData: FormData): Promise<void> {
    setPending(true);
    const result = await updateWahaCapabilitiesAction(id, formData);
    setPending(false);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    toast.success("Funções do número atualizadas.");
  }

  async function saveInternalPolicy(formData: FormData): Promise<void> {
    setPending(true);
    const result = await updateInternalBrokerNotificationPolicyAction(formData);
    setPending(false);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    toast.success(
      result.result.deliveryMode === "waha_direct"
        ? "Avisos internos serão enviados direto pelo WAHA."
        : "Meta voltou a ser o canal prioritário dos avisos internos.",
    );
    router.refresh();
  }

  const tenantNumbers = connections.filter(
    (connection) =>
      connection.scope === "tenant" &&
      ["active", "working", "ready", "connected"].includes(String(connection.status || "").toLowerCase()),
  );

  return (
    <Card className="border-border bg-card shadow-none">
      <CardHeader>
        <CardTitle>WhatsApp — números controlados</CardTitle>
        <CardDescription>
          {enabled
            ? `Conecte números para ${scopeCopy}. Escolha abaixo quais funções cada número pode executar.`
            : "A conexão de WhatsApp está desativada pela plataforma."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {enabled ? (
          <form action={create} className="flex flex-col gap-2 sm:flex-row">
            <Input
              name="label"
              minLength={2}
              maxLength={80}
              required
              placeholder={role === "director" ? "Ex.: Atendimento geral" : "Ex.: Unidade Centro"}
            />
            <Button disabled={pending} type="submit">
              {pending ? "Iniciando..." : "Conectar número"}
            </Button>
          </form>
        ) : null}

        {role === "director" ? (
          <form action={saveInternalPolicy} className="space-y-3 rounded-lg border border-border bg-muted/20 p-4">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-sm font-semibold">Avisos internos aos corretores</p>
                <p className="text-xs leading-5 text-muted-foreground">
                  Esta regra afeta somente atribuições, reatribuições e alertas operacionais. Ela não altera o atendimento de leads.
                </p>
              </div>
              <label className="flex shrink-0 items-center gap-2 text-xs font-medium cursor-pointer">
                <input
                  defaultChecked={internalNotificationPolicy?.enabled ?? true}
                  name="enabled"
                  type="checkbox"
                  value="true"
                />
                Ativar WAHA interno
              </label>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1 text-xs font-medium">
                Número oficial de avisos
                <select
                  defaultValue={internalNotificationPolicy?.wahaNumberId ?? ""}
                  disabled={!enabled || pending}
                  name="wahaNumberId"
                  className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="">Não configurado</option>
                  {tenantNumbers.map((connection) => (
                    <option key={connection.id} value={connection.id}>
                      {connection.label ?? connection.displayPhoneNumber} · {connection.displayPhoneNumber}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1 text-xs font-medium">
                Entrega de avisos internos
                <select
                  defaultValue={internalNotificationPolicy?.deliveryMode ?? "meta_then_waha"}
                  disabled={!enabled || pending}
                  name="deliveryMode"
                  className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="meta_then_waha">Meta primeiro; WAHA se a Meta falhar</option>
                  <option value="waha_direct">WAHA direto — não enviar pela Meta</option>
                </select>
              </label>
            </div>
            <div className="flex flex-col gap-2 border-t border-border/60 pt-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-muted-foreground">
                O modo direto desativa a Meta apenas nestes avisos internos e exige um número WAHA ativo da empresa.
              </p>
              <Button disabled={!enabled || pending} size="sm" type="submit" variant="outline">
                {pending ? "Salvando..." : "Salvar avisos internos"}
              </Button>
            </div>
          </form>
        ) : null}

        {(activeConnectingId || qrCode) ? (
          <div className="relative rounded-xl border border-primary/30 bg-primary/5 p-6 text-center shadow-sm">
            <button
              onClick={() => {
                setActiveConnectingId(null);
                setQrCode(null);
              }}
              className="absolute right-3 top-3 rounded-full p-1 text-muted-foreground hover:bg-muted"
              title="Fechar QR Code"
              type="button"
            >
              <X className="size-4" />
            </button>

            <p className="mb-1 text-base font-semibold text-foreground">
              Escaneie o QR Code no WhatsApp
            </p>
            <p className="mb-4 text-xs text-muted-foreground">
              Abra o WhatsApp no celular &gt; Aparelhos conectados &gt; Conectar um aparelho
            </p>

            {qrCode ? (
              <div className="inline-block rounded-xl bg-white p-3 shadow-md">
                <img
                  alt="QR Code para conectar WhatsApp"
                  className="mx-auto size-56 rounded"
                  src={qrCode.startsWith("data:") ? qrCode : `data:image/png;base64,${qrCode}`}
                />
              </div>
            ) : (
              <div className="flex h-56 flex-col items-center justify-center gap-3 rounded-xl bg-white/60 p-6">
                <SpinnerGap className="size-8 animate-spin text-primary" />
                <p className="text-sm font-medium text-muted-foreground">
                  Iniciando sessão do WhatsApp e gerando QR Code…
                </p>
              </div>
            )}

            <div className="mt-4 flex items-center justify-center gap-3">
              {activeConnectingId ? (
                <Button
                  disabled={pending}
                  onClick={() => refresh(activeConnectingId)}
                  size="sm"
                  variant="outline"
                  className="gap-2"
                >
                  <QrCode className="size-4" />
                  {pending ? "Atualizando..." : "Atualizar QR Code"}
                </Button>
              ) : null}
              <Button
                onClick={() => {
                  setActiveConnectingId(null);
                  setQrCode(null);
                }}
                size="sm"
                variant="ghost"
              >
                Concluir / Fechar
              </Button>
            </div>
          </div>
        ) : null}

        <div className="divide-y rounded-lg border">
          {connections.length ? (
            connections.map((connection) => (
              <div className="grid gap-4 p-4" key={connection.id}>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-medium">
                      {connection.label ?? connection.displayPhoneNumber}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {connection.displayPhoneNumber} ·{" "}
                      {connection.scope === "tenant" ? "Empresa" : "Unidade"} ·{" "}
                      <span className="font-medium text-foreground">{connection.status}</span>
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      disabled={pending}
                      onClick={() => refresh(connection.id)}
                      size="sm"
                      variant="outline"
                    >
                      {connection.status === "active" || connection.status === "WORKING"
                        ? "Atualizar status"
                        : "Ver / Atualizar QR"}
                    </Button>
                    {connection.status === "paused" ? (
                      <Button
                        disabled={pending}
                        onClick={() => change(connection.id, "resume")}
                        size="sm"
                        variant="outline"
                      >
                        Retomar
                      </Button>
                    ) : (
                      <Button
                        disabled={pending || (connection.status !== "active" && connection.status !== "WORKING")}
                        onClick={() => change(connection.id, "pause")}
                        size="sm"
                        variant="outline"
                      >
                        Pausar
                      </Button>
                    )}
                    <Button
                      disabled={pending}
                      onClick={() => setDisconnectTarget(connection)}
                      size="sm"
                      variant="destructive"
                    >
                      Desconectar
                    </Button>
                  </div>
                </div>
                <form
                  action={(formData) => saveCapabilities(connection.id, formData)}
                  className="grid gap-2 rounded-lg bg-muted/30 p-3 text-xs sm:grid-cols-2 lg:grid-cols-3"
                >
                  <label className="flex items-center gap-2">
                    <input
                      defaultChecked={connection.capabilities.inbound}
                      name="inbound"
                      type="checkbox"
                      value="true"
                    />{" "}
                    Receber mensagens
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      defaultChecked={connection.capabilities.cadence}
                      name="cadence"
                      type="checkbox"
                      value="true"
                    />{" "}
                    Executar cadências
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      defaultChecked={connection.capabilities.ai}
                      name="ai"
                      type="checkbox"
                      value="true"
                    />{" "}
                    IA após inbound
                  </label>
                  <label className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-medium">
                    <input
                      defaultChecked={connection.capabilities.brokerFallback ?? true}
                      name="brokerFallback"
                      type="checkbox"
                      value="true"
                    />{" "}
                    Fallback: Notificar corretores
                  </label>
                  <label className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-medium">
                    <input
                      defaultChecked={connection.capabilities.qualificationFallback ?? true}
                      name="qualificationFallback"
                      type="checkbox"
                      value="true"
                    />{" "}
                    Fallback: Qualificação (IA)
                  </label>

                  <div className="sm:col-span-2 lg:col-span-3 flex items-center justify-between pt-2 border-t border-border/40 mt-1">
                    <p className="text-muted-foreground text-[11px]">
                      O fallback envia automaticamente pelo WAHA se o canal oficial Meta estiver indisponível ou falhar.
                    </p>
                    <Button disabled={pending} size="sm" type="submit" variant="outline">
                      Salvar funções
                    </Button>
                  </div>
                </form>
              </div>
            ))
          ) : (
            <p className="p-4 text-sm text-muted-foreground">
              Nenhum número conectado neste escopo.
            </p>
          )}
        </div>
        <Dialog
          open={disconnectTarget !== null}
          onOpenChange={(value) => {
            if (!value) setDisconnectTarget(null);
          }}
        >
          <DialogPopup className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Desconectar este número?</DialogTitle>
              <DialogDescription>
                A sessão do número {disconnectTarget?.displayPhoneNumber ?? ""} será desconectada do servidor e removida do CRM para que você possa gerar uma nova conexão limpa.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                disabled={pending}
                variant="outline"
                onClick={() => setDisconnectTarget(null)}
              >
                Cancelar
              </Button>
              <Button
                disabled={pending}
                variant="destructive"
                onClick={() => void confirmDisconnect()}
              >
                {pending ? "Desconectando…" : "Desconectar"}
              </Button>
            </DialogFooter>
          </DialogPopup>
        </Dialog>
      </CardContent>
    </Card>
  );
}
