"use client";

import { ShieldCheck, TriangleAlert, Unplug } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { WhatsAppConnectDialog } from "@/components/whatsapp/whatsapp-connect-dialog";
import { ConfirmDialog } from "@/components/foundations/confirm-dialog";
import { useCallback, useEffect, useState, useTransition } from "react";
import {
  getWhatsAppConnection,
  getWhatsAppSessionStatus,
  resetWhatsAppSessionAction,
} from "@/app/(dashboard)/settings/whatsapp-actions";
import { toast } from "@/components/ui/sonner";

type ConnectionBadgeProps = {
  connected: boolean;
  status: string;
};

export function ConnectionBadge({ connected, status }: ConnectionBadgeProps) {
  const [connection, setConnection] = useState<
    Awaited<ReturnType<typeof getWhatsAppConnection>> | null
  >(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const refreshConnection = useCallback(async () => {
    try {
      const conn = await getWhatsAppConnection();
      setConnection(conn);
    } catch {
      /* server state remains usable */
    }
  }, []);

  function disconnect() {
    startTransition(async () => {
      try {
        const result = await resetWhatsAppSessionAction();
        if (!result.success) {
          toast.error("Não foi possível desconectar. Tente novamente.");
          return;
        }
        setConfirmOpen(false);
        toast.success("WhatsApp desconectado.");
        refreshConnection();
      } catch {
        toast.error("Erro ao desconectar.");
      }
    });
  }

  useEffect(() => {
    if (connected) return;
    const initial = window.setTimeout(() => void refreshConnection(), 0);
    const timer = window.setInterval(
      () =>
        void getWhatsAppSessionStatus()
          .then(refreshConnection)
          .catch(() => undefined),
      5_000
    );
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(timer);
    };
  }, [refreshConnection, connected]);

  if (connected) {
    return (
      <>
        <div className="flex items-center gap-2">
          <Badge variant="success" className="gap-1.5 px-2.5 py-1">
            <ShieldCheck className="size-3.5" />
            Sincronização ativa
          </Badge>
          <Button
            variant="outline"
            size="xs"
            onClick={() => setConfirmOpen(true)}
            className="gap-1.5"
          >
            <Unplug className="size-3.5" />
            Desconectar
          </Button>
        </div>
        <ConfirmDialog
          open={confirmOpen}
          onOpenChange={setConfirmOpen}
          title="Desconectar WhatsApp"
          description="Tem certeza que deseja desconectar? A sincronização de mensagens será interrompida."
          confirmLabel="Desconectar"
          destructive
          loading={pending}
          onConfirm={disconnect}
        />
      </>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Badge variant="warning" className="gap-1.5 px-2.5 py-1">
        <TriangleAlert className="size-3.5" />
        {status === "error"
          ? "Conexão requer atenção"
          : "WhatsApp não conectado"}
      </Badge>
      {connection ? (
        <WhatsAppConnectDialog
          initial={connection}
          triggerLabel="Conectar"
          connectedLabel="Gerenciar"
          onConnectionChanged={refreshConnection}
        />
      ) : (
        <Button size="xs" variant="outline" disabled>
          Carregando
        </Button>
      )}
    </div>
  );
}
