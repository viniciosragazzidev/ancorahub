"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { WhatsappLogo } from "@/components/huge-icons";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DsStatusBadge, type DsStatusBadgeStatus } from "@/components/ui/ds-status-badge";
import { toast } from "@/components/ui/sonner";
import { PairingQrPanel, PairingStepper } from "@/components/whatsapp/whatsapp-pairing-panel";
import {
  derivePairingPhase,
  FIRST_QR_LIFETIME_SECONDS,
  ROTATED_QR_LIFETIME_SECONDS,
} from "@/features/waha-cadence/pairing-phase";
import type { WahaUiStatus } from "@/features/waha-cadence/status";
import type { TenantChannelView } from "@/features/waha-cadence/tenant-channel";
import {
  disconnectTenantChannelAction,
  pollTenantChannelAction,
  startTenantChannelAction,
} from "../actions";

const POLL_MS = 2_500;

const STATUS_BADGE: Record<WahaUiStatus, { status: DsStatusBadgeStatus; label: string }> = {
  ready: { status: "success", label: "Conectado" },
  initializing: { status: "info", label: "Pareando" },
  error: { status: "destructive", label: "Falhou" },
  disconnected: { status: "secondary", label: "Desconectado" },
};

function formatPhone(digits: string | null) {
  if (!digits) return null;
  const national = digits.startsWith("55") && digits.length >= 12 ? digits.slice(2) : digits;
  if (national.length === 11) return `+55 (${national.slice(0, 2)}) ${national.slice(2, 7)}-${national.slice(7)}`;
  if (national.length === 10) return `+55 (${national.slice(0, 2)}) ${national.slice(2, 6)}-${national.slice(6)}`;
  return `+${digits}`;
}

export function TenantChannelCard({ initialChannel }: { initialChannel: TenantChannelView | null }) {
  const router = useRouter();
  const [status, setStatus] = useState<WahaUiStatus>(initialChannel?.status ?? "disconnected");
  const [phone, setPhone] = useState<string | null>(initialChannel?.phone ?? null);
  const [pairing, setPairing] = useState(initialChannel?.status === "initializing");
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [providerStatus, setProviderStatus] = useState<string | null>(null);
  const [qrShownAt, setQrShownAt] = useState<number | null>(null);
  const [qrLifetime, setQrLifetime] = useState(FIRST_QR_LIFETIME_SECONDS);
  const [qrKey, setQrKey] = useState(0);
  const [sawQr, setSawQr] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [confirmingDisconnect, setConfirmingDisconnect] = useState(false);
  const [isPending, startTransition] = useTransition();
  const lastQr = useRef<string | null>(null);

  const showQr = useCallback((next: string | null) => {
    if (!next || next === lastQr.current) return;
    setQrLifetime(lastQr.current ? ROTATED_QR_LIFETIME_SECONDS : FIRST_QR_LIFETIME_SECONDS);
    lastQr.current = next;
    setQrCode(next);
    setQrShownAt(Date.now());
    setQrKey((key) => key + 1);
    setSawQr(true);
  }, []);

  const resetPairing = () => {
    lastQr.current = null;
    setQrCode(null);
    setQrShownAt(null);
    setSawQr(false);
    setProviderStatus(null);
  };

  // Self-scheduled polling (never stacks a slow read on top of another).
  useEffect(() => {
    if (!pairing) return;
    let cancelled = false;
    let timer: number | undefined;
    const tick = async () => {
      const result = await pollTenantChannelAction();
      if (cancelled) return;
      if (result.success) {
        setStatus(result.status);
        setProviderStatus(result.providerStatus);
        if (result.phone) setPhone(result.phone);
        if (result.qrCode) showQr(result.qrCode);
        if (result.status === "ready") {
          setPairing(false);
          resetPairing();
          toast.success("Número da empresa conectado.");
          router.refresh();
          return;
        }
        if (result.status === "error") {
          setPairing(false);
          toast.error("O pareamento falhou. Gere um novo QR para tentar de novo.");
          return;
        }
      }
      timer = window.setTimeout(tick, POLL_MS);
    };
    timer = window.setTimeout(tick, POLL_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [pairing, router, showQr]);

  useEffect(() => {
    if (!pairing) return;
    const clock = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(clock);
  }, [pairing]);

  const secondsLeft = qrShownAt ? Math.min(qrLifetime, Math.ceil(qrLifetime - (now - qrShownAt) / 1_000)) : qrLifetime;
  const phase = derivePairingPhase({ status, providerStatus, hasQr: Boolean(qrCode), sawQr });

  function connect(fresh: boolean) {
    resetPairing();
    startTransition(async () => {
      const result = await startTenantChannelAction({ fresh });
      if (!result.success) {
        setStatus("error");
        toast.error(result.error);
        return;
      }
      setStatus(result.status);
      setProviderStatus(result.providerStatus);
      if (result.status === "ready") {
        setPhone(result.phone);
        setPairing(false);
        router.refresh();
        return;
      }
      showQr(result.qrCode);
      setPairing(true);
    });
  }

  function disconnect() {
    startTransition(async () => {
      const result = await disconnectTenantChannelAction();
      setConfirmingDisconnect(false);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      setStatus("disconnected");
      setPhone(null);
      setPairing(false);
      resetPairing();
      toast.success("Número da empresa desconectado.");
      router.refresh();
    });
  }

  const badge = STATUS_BADGE[pairing ? "initializing" : status];
  const connected = status === "ready" && !pairing;

  return (
    <Card variant="overview" className="shadow-sm">
      <CardHeader className="gap-2 border-b border-border/70 px-5 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-border/70 text-primary">
              <WhatsappLogo className="size-5" aria-hidden />
            </span>
            <div className="min-w-0">
              <CardTitle>Número da empresa</CardTitle>
              <CardDescription className="mt-1 max-w-2xl leading-5">
                WhatsApp da diretoria para falar com os corretores. Separado dos números pessoais dos
                corretores e das notificações oficiais, que seguem pela API da Meta.
              </CardDescription>
            </div>
          </div>
          <DsStatusBadge status={badge.status} label={badge.label} />
        </div>
      </CardHeader>

      <CardContent className="grid gap-4 px-5 py-4">
        {connected ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/70 p-3">
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Número conectado</p>
              <p className="text-sm font-medium tabular-nums text-foreground">{formatPhone(phone) ?? "Número confirmado pelo WhatsApp"}</p>
            </div>
            {confirmingDisconnect ? (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-muted-foreground">Desconectar e sair do WhatsApp neste número?</span>
                <Button size="sm" variant="outline" disabled={isPending} onClick={() => setConfirmingDisconnect(false)}>Cancelar</Button>
                <Button size="sm" variant="destructive" disabled={isPending} onClick={disconnect}>
                  {isPending ? "Desconectando…" : "Desconectar"}
                </Button>
              </div>
            ) : (
              <Button size="sm" variant="outline" onClick={() => setConfirmingDisconnect(true)}>Desconectar</Button>
            )}
          </div>
        ) : pairing ? (
          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-start">
            <div className="grid content-start gap-3">
              <PairingStepper phase={phase} />
              <ol className="list-decimal space-y-1 pl-4 text-xs leading-5 text-muted-foreground">
                <li>No celular do número da empresa, abra o WhatsApp.</li>
                <li>Toque em Configurações → Aparelhos conectados → Conectar um aparelho.</li>
                <li>Aponte a câmera para o QR ao lado.</li>
              </ol>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" disabled={isPending} onClick={() => connect(true)}>
                  Gerar novo QR
                </Button>
                <Button size="sm" variant="ghost" disabled={isPending} onClick={() => { setPairing(false); resetPairing(); }}>
                  Fechar
                </Button>
              </div>
            </div>
            <PairingQrPanel phase={phase} qrCode={qrCode} secondsLeft={secondsLeft} lifetime={qrLifetime} qrKey={qrKey} />
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-dashed border-border p-4">
            <p className="max-w-xl text-sm leading-5 text-muted-foreground">
              {status === "error"
                ? "A última tentativa de conexão falhou. Gere um novo QR para parear o número novamente."
                : "Nenhum número conectado. Use um celular dedicado à empresa — ele passa a ser o canal da diretoria com os corretores."}
            </p>
            <Button size="sm" disabled={isPending} onClick={() => connect(status === "error")}>
              {isPending ? "Preparando QR…" : status === "error" ? "Gerar novo QR" : "Conectar número"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
