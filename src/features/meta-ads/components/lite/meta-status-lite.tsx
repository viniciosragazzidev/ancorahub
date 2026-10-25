/**
 * Faixa de situação da conexão Meta no visual Lite: última sincronização, modo de captura e o link para a conexão.
 * Mesmo conteúdo da faixa da tela atual; sem conexão, o mesmo aviso.
 */
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import page from "@/components/lite/page/lite-page.module.css";
import type { MetaSyncInfo } from "./meta-lite-shared";
import styles from "./meta-lite.module.css";

export function MetaStatusLite({ connected, sync, captureModeLabel }: { connected: boolean; sync: MetaSyncInfo | null; captureModeLabel: string | null }) {
  return (
    <section className={styles.statusBar} aria-label="Situação da conexão Meta">
      {connected && sync ? (
        <div className={styles.statusItems} title={sync.title}>
          <span className={page.badge} data-tone={sync.tone}>Última sincronização: {sync.label}</span>
          {sync.detail ? <span className={styles.statusText}>{sync.detail}</span> : null}
          {captureModeLabel ? <span className={page.badge}>{captureModeLabel}</span> : null}
          {sync.errorDetails ? (
            <details className={styles.errorDetails}>
              <summary>Ver motivo da falha</summary>
              <p>{sync.errorDetails}</p>
            </details>
          ) : null}
        </div>
      ) : (
        <p className={styles.statusText}>A Meta ainda não está conectada. Conecte o Marketing para ver campanhas e controlar a captura de leads.</p>
      )}
      <Link href="/integrations/meta" className={styles.linkButton}>
        {connected ? "Conexão e sincronização" : "Conectar Marketing"}
        <ArrowRight aria-hidden="true" size={16} />
      </Link>
    </section>
  );
}
