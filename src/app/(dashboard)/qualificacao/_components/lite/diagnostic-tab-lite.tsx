"use client";

/** Aba "Conectividade" do hub de qualificação no visual Lite: o mesmo diagnóstico da API da Meta e o envio de teste. */
import compat from "@/components/lite/page/lite-compat.module.css";
import page from "@/components/lite/page/lite-page.module.css";
import sections from "@/components/lite/page/lite-sections.module.css";
import type { WhatsAppConnectionDiagnostic } from "@/features/ai-qualification/whatsapp-diagnostic-service";
import { WhatsAppTestMessageCard } from "@/features/communication-channels/components/whatsapp-test-message-card";

import styles from "./qualification-lite.module.css";

export function DiagnosticTabLite({ diagnostic }: { diagnostic: WhatsAppConnectionDiagnostic }) {
  const token = diagnostic.tokenStatus === "valid" ? `Válido${diagnostic.tokenExpirationDays ? ` (${diagnostic.tokenExpirationDays} dias)` : ""}` : "Não configurado";
  return (
    <div className={`${styles.columns} ${styles.diag}`}>
      <section className={sections.group} aria-labelledby="diag-title">
        <div className={sections.row}>
          <div className={sections.rowText}>
            <h2 id="diag-title" className={sections.rowTitle}>Status da conexão WhatsApp</h2>
            <p className={sections.rowDescription}>Diagnóstico da API da Meta (WABA).</p>
          </div>
        </div>
        <dl className={styles.kv}>
          <div><dt>Canal</dt><dd><span className={page.badge} data-tone={diagnostic.channelConnected ? "success" : "warning"}>{diagnostic.channelConnected ? "Conectado" : "Desconectado"}</span></dd></div>
          <div><dt>Número oficial</dt><dd className={styles.mono}>{diagnostic.officialNumber ?? "Não configurado"}</dd></div>
          <div><dt>Nome exibido</dt><dd>{diagnostic.displayName ?? "Não configurado"}</dd></div>
          <div><dt>Phone Number ID</dt><dd className={styles.mono}>{diagnostic.phoneNumberId ?? "Não configurado"}</dd></div>
          <div><dt>Webhook</dt><dd><span className={page.badge} data-tone={diagnostic.webhookStatus === "active" ? "success" : undefined}>{diagnostic.webhookStatus === "active" ? "Ativo" : "Não configurado"}</span></dd></div>
          <div><dt>Token da API</dt><dd><span className={page.badge} data-tone={diagnostic.tokenStatus === "valid" ? "success" : undefined}>{token}</span></dd></div>
          <div><dt>Latência média</dt><dd className={page.numeric}>{diagnostic.averageLatencyMs} ms</dd></div>
        </dl>
      </section>
      <div className={compat.compat}>
        <WhatsAppTestMessageCard />
      </div>
    </div>
  );
}
