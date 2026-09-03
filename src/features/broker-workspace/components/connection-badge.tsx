"use client";

import { ShieldCheck, TriangleAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { WhatsAppConnectDialog } from "@/components/whatsapp/whatsapp-connect-dialog";
import { useCallback, useEffect, useState } from "react";
import {
  getWhatsAppConnection,
  getWhatsAppSessionStatus,
} from "@/app/(dashboard)/settings/whatsapp-actions";

type ConnectionBadgeProps = {
  connected: boolean;
  status: string;
};

export function ConnectionBadge({ connected, status }: ConnectionBadgeProps) {
  const [connection, setConnection] = useState<
    Awaited<ReturnType<typeof getWhatsAppConnection>> | null
  >(null);

  const refreshConnection = useCallback(async () => {
    try {
      const conn = await getWhatsAppConnection();
      setConnection(conn);
    } catch {
      /* server state remains usable */
    }
  }, []);

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
      <Badge variant="success" className="gap-1.5 px-2.5 py-1">
        <ShieldCheck className="size-3.5" />
        Sincronização ativa
      </Badge>
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
