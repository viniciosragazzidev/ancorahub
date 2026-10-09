"use client";

import { ConnectionBadge } from "@/features/broker-workspace/components/connection-badge";

/**
 * WhatsApp pessoal of the broker app. The connection (QR pairing, status polling, disconnect) is the
 * one brokers already use, through ConnectionBadge and the connect dialog, so nothing about it changes
 * here. /integrations/whatsapp is the corporate Meta/WAHA page and is not part of the broker app.
 */
export function LightWhatsappSection({ connected, status }: { connected: boolean; status: string }) {
  return (
    <section aria-labelledby="whatsapp-heading" className="arc-venancor flex flex-col gap-4 rounded-3xl bg-(--surface) p-5 shadow-(--shadow-resting)">
      <div>
        <h2 id="whatsapp-heading" className="text-base font-semibold text-(--foreground)">WhatsApp pessoal de atendimento</h2>
        <p className="mt-1 text-sm text-(--text-secondary)">
          Conecte somente o número que você usa no atendimento. A conexão é isolada por usuário e não altera a identidade da corretora.
        </p>
      </div>
      <ConnectionBadge connected={connected} status={status} />
    </section>
  );
}
