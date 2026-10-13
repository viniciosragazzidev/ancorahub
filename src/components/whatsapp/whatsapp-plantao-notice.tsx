"use client";

import { useEffect, useState } from "react";

import { getWhatsAppConnection } from "@/app/(dashboard)/settings/whatsapp-actions";
import { X } from "@/components/huge-icons";
import { Button } from "@/components/ui/button";
import { DsCallout } from "@/components/ui/ds-callout";
import { WhatsAppConnectDialog } from "@/components/whatsapp/whatsapp-connect-dialog";
import { recordWhatsAppPlantaoNoticeAction } from "@/features/whatsapp-plantao-notice/actions";

type WhatsAppConnection = Awaited<ReturnType<typeof getWhatsAppConnection>>;
type NoticeMode = "daily" | "sticky";

const NOTICE_TITLE = "A partir de 20/10, conecte seu WhatsApp para receber os leads do plantão";
const NOTICE_BODY = "Para continuar recebendo os leads do plantão em que você está escalado, seu WhatsApp precisa estar conectado ao CRM. Com as informações dos seus atendimentos, conseguimos melhorar a qualidade dos leads que chegam até você.";
const NOTICE_HIGHLIGHT = "A conexão precisa ser feita pelo computador: o CRM mostra um QR code e você lê com o WhatsApp do seu celular.";

function localDateKey() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

function storageKey(userId: string) {
  return `whatsapp-plantao-notice:${userId}:${localDateKey()}`;
}

export function WhatsAppPlantaoNotice({
  userId,
  mode,
}: {
  userId: string;
  mode: NoticeMode;
}) {
  const [visible, setVisible] = useState(mode === "sticky");
  const [mobileHelp, setMobileHelp] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogInitial, setDialogInitial] = useState<WhatsAppConnection | null>(null);
  const [loadingConnection, setLoadingConnection] = useState(false);
  const [connectionError, setConnectionError] = useState(false);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (mode === "sticky") return;

    let isMounted = true;
    queueMicrotask(() => {
      if (!isMounted) return;
      try {
        setVisible(localStorage.getItem(storageKey(userId)) !== "closed");
      } catch {
        setVisible(true);
      }
    });

    return () => { isMounted = false; };
  }, [mode, userId]);

  if (!visible || connected) return null;

  function closeForToday() {
    try {
      localStorage.setItem(storageKey(userId), "closed");
    } catch {
      // Keep the current screen usable when browser storage is unavailable.
    }
    void recordWhatsAppPlantaoNoticeAction("closed").catch((error) => {
      console.error("Não foi possível registrar o fechamento do aviso do plantão.", error);
    });
    setVisible(false);
  }

  async function connect() {
    void recordWhatsAppPlantaoNoticeAction("connect_clicked").catch((error) => {
      console.error("Não foi possível registrar o clique de conexão do WhatsApp.", error);
    });

    const desktop = window.matchMedia("(min-width: 1024px) and (pointer: fine)").matches;
    if (desktop) {
      setConnectionError(false);
      setLoadingConnection(true);
      try {
        setDialogInitial(await getWhatsAppConnection());
        setDialogOpen(true);
      } catch {
        setConnectionError(true);
      } finally {
        setLoadingConnection(false);
      }
      return;
    }
    setMobileHelp(true);
  }

  return (
    <div className={`w-full min-w-0 ${mode === "daily" ? "mb-4" : ""}`}>
      <DsCallout
        tone="info"
        title={<span className={`block break-words ${mode === "daily" ? "pr-7" : ""}`}>{NOTICE_TITLE}</span>}
        className="relative w-full min-w-0"
      >
        {mode === "daily" ? (
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            onClick={closeForToday}
            aria-label="Fechar aviso"
            className="absolute right-2 top-2"
          >
            <X aria-hidden="true" />
          </Button>
        ) : null}
        <p className="max-w-full break-words pr-7 text-sm leading-5">{NOTICE_BODY}</p>
        <p className="max-w-full break-words text-sm font-medium leading-5">{NOTICE_HIGHLIGHT}</p>
        {mobileHelp ? <p role="status" className="text-sm font-medium">Você está no celular. Para conectar, abra o CRM no computador.</p> : null}
        {connectionError ? <p role="alert" className="text-sm text-destructive">Não foi possível abrir a conexão agora. Tente novamente.</p> : null}
        <div className="flex min-w-0 flex-wrap items-center gap-2 pt-2">
          <Button type="button" variant="deep-sapphire" size="sm" onClick={() => void connect()} loading={loadingConnection} disabled={loadingConnection}>
            Conectar WhatsApp
          </Button>
        </div>
      </DsCallout>
      {dialogInitial ? (
        <WhatsAppConnectDialog
          initial={dialogInitial}
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          onConnectionChanged={() => {
            setDialogOpen(false);
            setConnected(true);
          }}
        />
      ) : null}
    </div>
  );
}
