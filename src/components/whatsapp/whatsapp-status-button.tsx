"use client";

import { useCallback, useEffect, useState } from "react";

import { getWhatsAppConnection, getWhatsAppSessionStatus } from "@/app/(dashboard)/settings/whatsapp-actions";
import { isViewingAs } from "@/components/chat/tour/seen-storage";

import { WhatsAppConnectDialog } from "./whatsapp-connect-dialog";
import styles from "./whatsapp-status-button.module.css";

type Connection = NonNullable<Awaited<ReturnType<typeof getWhatsAppConnection>>>;

const CHECK_EVERY_MS = 120_000;

/**
 * Round WhatsApp button for the top right of the Lite: green when the broker's
 * WhatsApp is connected, red with a cut when it is not. Hidden when the connection cannot be read.
 * Desconectado (10/11): o toque abre o mesmo roteiro guiado da presença, só para conectar (código no celular,
 * QR no computador, com a tela inicial e os 4 toques). Conectado: o painel de sempre (status, desconectar).
 */
export function WhatsAppStatusButton() {
  const [connection, setConnection] = useState<Connection | null>(null);
  const [failed, setFailed] = useState(false);
  // "Ver como": the proxy blocks server actions, so the status comes from a GET
  // and the button only shows it (the admin can't pair someone else's WhatsApp).
  const [viewOnly, setViewOnly] = useState<{ connected: boolean } | null>(null);
  // Roteiro aberto: continua nele até fechar, mesmo depois de conectar (senão trocaria de tela no meio).
  const [guideOpen, setGuideOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const current = await getWhatsAppConnection();
      if (current) setConnection(current);
      else setFailed(true);
    } catch {
      setFailed(true);
    }
  }, []);

  useEffect(() => {
    if (isViewingAs()) {
      void fetch("/api/chat/whatsapp", { cache: "no-store" })
        .then((response) => (response.ok ? (response.json() as Promise<{ connection: { status: string } | null }>) : null))
        .then((body) => { if (body?.connection) setViewOnly({ connected: body.connection.status === "ready" }); else setFailed(true); })
        .catch(() => setFailed(true));
      return;
    }
    void load();
    // Keeps the color true when the session drops or comes back.
    const timer = window.setInterval(() => {
      void getWhatsAppSessionStatus()
        .then((result) => {
          if (result.success && result.status) setConnection((current) => (current ? { ...current, status: result.status as string } : current));
        })
        .catch(() => undefined);
    }, CHECK_EVERY_MS);
    return () => window.clearInterval(timer);
  }, [load]);

  if (viewOnly) {
    const label = viewOnly.connected ? "WhatsApp do corretor conectado" : "WhatsApp do corretor desconectado";
    return (
      <span className={styles.button} data-connected={viewOnly.connected} role="img" aria-label={label} title={label}>
        <WhatsAppGlyph connected={viewOnly.connected} />
        <span className={styles.dot} aria-hidden="true" />
      </span>
    );
  }
  if (failed || !connection) return null;
  const connected = connection.status === "ready";
  const guided = !connected || guideOpen;
  return (
    <WhatsAppConnectDialog
      initial={connection}
      variant={guided ? "presence" : "default"}
      guideMode="connect"
      onOpenChange={(open) => setGuideOpen(open && guided)}
      onConnectionChanged={(next) => { if (next) setConnection(next as Connection); else void load(); }}
      trigger={(
        <button type="button" className={styles.button} data-connected={connected} aria-label={connected ? "WhatsApp conectado" : "WhatsApp desconectado: toque para conectar"} title={connected ? "WhatsApp conectado" : "Conectar o WhatsApp"}>
          <WhatsAppGlyph connected={connected} />
          <span className={styles.dot} aria-hidden="true" />
        </button>
      )}
    />
  );
}

/** The WhatsApp mark, with a cut across it when disconnected. */
function WhatsAppGlyph({ connected }: { connected: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <path fill="currentColor" d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2c-1.5 0-3-.4-4.3-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.7.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.3-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6a2.7 2.7 0 0 0 1.8-1.2 2.2 2.2 0 0 0 .1-1.3c0-.1-.2-.2-.5-.3Z" />
      {connected ? null : <path d="M3.5 3.5 20.5 20.5" stroke="var(--wa-cut, #fff)" strokeWidth="4" strokeLinecap="round" />}
      {connected ? null : <path d="M3.5 3.5 20.5 20.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />}
    </svg>
  );
}
