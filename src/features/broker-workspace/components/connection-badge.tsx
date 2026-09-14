"use client";

import { ShieldCheck, TriangleAlert, Unplug } from "lucide-react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { WhatsAppConnectDialog } from "@/components/whatsapp/whatsapp-connect-dialog";
import { ConfirmDialog } from "@/components/foundations/confirm-dialog";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
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

export function ConnectionBadge({ connected: initialConnected, status: initialStatus }: ConnectionBadgeProps) {
  const router = useRouter();
  // Estado vivo: começa no valor server-rendered e passa a refletir o polling.
  // Sem isso o badge só mudava com reload manual — a página é force-dynamic e
  // revalidatePath não altera a árvore já renderizada.
  const [live, setLive] = useState({ connected: initialConnected, status: initialStatus });
  const [connection, setConnection] = useState<
    Awaited<ReturnType<typeof getWhatsAppConnection>> | null
  >(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const wasConnected = useRef(initialConnected);

  // Mantém o estado vivo em sincronia quando o servidor re-renderiza o
  // componente (navegação, router.refresh) — o valor server é autoridade
  // inicial a cada render novo de props.
  useEffect(() => {
    setLive({ connected: initialConnected, status: initialStatus });
  }, [initialConnected, initialStatus]);

  const refreshConnection = useCallback(async () => {
    try {
      const conn = await getWhatsAppConnection();
      setConnection(conn);
      setLive({ connected: conn.status === "ready", status: conn.status });
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
        setLive((current) => ({ ...current, connected: false, status: "disconnected" }));
        refreshConnection();
      } catch {
        toast.error("Erro ao desconectar.");
      }
    });
  }

  // Polling bidirecional: busca atualizações enquanto desconectado (conexão
  // recém-feita) e também enquanto conectado (queda de sessão). Quando o
  // status vira "ready", atualiza o badge imediatamente e pede um refresh
  // do Server Component — a página é force-dynamic, então isso re-renderiza
  // a árvore com o estado real sem reload manual.
  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      try {
        const result = await getWhatsAppSessionStatus();
        if (cancelled) return;
        if (result.success && result.status) {
          setLive((current) => {
            if (current.status === result.status && current.connected === (result.status === "ready")) {
              return current;
            }
            return { connected: result.status === "ready", status: result.status };
          });
          if (result.status === "ready" && !wasConnected.current) {
            wasConnected.current = true;
            router.refresh();
          }
          if (result.status !== "ready") {
            wasConnected.current = false;
          }
        }
      } catch {
        /* transient error — next tick retries */
      }
    };
    const timer = window.setInterval(() => void tick(), 5_000);
    void tick();
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [router]);

  if (live.connected) {
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
      <Badge variant={live.status === "error" ? "destructive" : "warning"} className="gap-1.5 px-2.5 py-1">
        <TriangleAlert className="size-3.5" />
        {live.status === "error"
          ? "Conexão requer atenção"
          : live.status === "paused"
            ? "Sincronização pausada"
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
