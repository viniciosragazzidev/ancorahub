"use client";

import { useEffect, useRef, useState } from "react";

import { getWhatsAppConnection, getWhatsAppSessionStatus } from "@/app/(dashboard)/settings/whatsapp-actions";
import { useTopStrip } from "@/components/light/use-top-strip";

import { WhatsAppConnectDialog } from "./whatsapp-connect-dialog";
import styles from "./whatsapp-missing-banner.module.css";

type Connection = NonNullable<Awaited<ReturnType<typeof getWhatsAppConnection>>>;

const CHECK_EVERY_MS = 120_000;

/**
 * The view-as strip, as a warning for the broker (Vinicios, 18/10): while their WhatsApp is not
 * connected, a strip on top of every screen with one tap to connect. Leaves by itself once connected.
 * Not rendered in "Ver como" (that strip already sits there).
 */
export function WhatsAppMissingBanner() {
  const [connection, setConnection] = useState<Connection | null>(null);
  const stripRef = useRef<HTMLDivElement>(null);
  const missing = Boolean(connection && connection.status !== "ready");
  useTopStrip(stripRef, missing);

  useEffect(() => {
    let alive = true;
    void getWhatsAppConnection().then((current) => { if (alive && current) setConnection(current); }).catch(() => undefined);
    const timer = window.setInterval(() => {
      void getWhatsAppSessionStatus()
        .then((result) => {
          if (alive && result.success && result.status) setConnection((current) => (current ? { ...current, status: result.status as string } : current));
        })
        .catch(() => undefined);
    }, CHECK_EVERY_MS);
    return () => { alive = false; window.clearInterval(timer); };
  }, []);

  if (!connection || !missing) return null;
  return (
    <div ref={stripRef} className={styles.banner} role="status">
      <span className={styles.icon} aria-hidden="true">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2c-1.5 0-3-.4-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Z" /></svg>
      </span>
      <span className={styles.text}><strong>Seu WhatsApp não está conectado.</strong> Conecte para receber os leads do plantão.</span>
      <WhatsAppConnectDialog
        initial={connection}
        onConnectionChanged={(next) => { if (next) setConnection(next as Connection); }}
        trigger={<button type="button" className={styles.action}>Conectar agora</button>}
      />
    </div>
  );
}
