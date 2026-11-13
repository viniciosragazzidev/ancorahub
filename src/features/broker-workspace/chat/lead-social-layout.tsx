"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { Eye } from "lucide-react";
import { BottomSheet } from "@/components/arc/bottom-sheet/bottom-sheet";
import { Button } from "@/components/arc/button/button";
import page from "@/components/lite/page/lite-page.module.css";
import styles from "./lead-social.module.css";

/** Conversation first. The eye owns all lead context, at every screen width. */
export function LeadSocialLayout({ header, next, details, side, conversation, detailOverlayActive = false, actions }: {
  header: ReactNode;
  next: ReactNode;
  details?: ReactNode;
  side?: ReactNode;
  conversation: ReactNode;
  detailOverlayActive?: boolean;
  actions?: ReactNode;
}) {
  const eye = useRef<HTMLButtonElement>(null);
  const previousOverlay = useRef(detailOverlayActive);
  useEffect(() => {
    const returned = previousOverlay.current && !detailOverlayActive;
    previousOverlay.current = detailOverlayActive;
    if (!returned) return;
    const frame = requestAnimationFrame(() => eye.current?.focus({ preventScroll: true }));
    return () => cancelAnimationFrame(frame);
  }, [detailOverlayActive]);
  return <div className={`${styles.root} ${styles.focusRoot}`}>
    <header className={styles.focusHeader}>
      <div className={styles.focusIdentity}>
        <div className={styles.phoneHeaderMain}>{header}</div>
        {!detailOverlayActive && (next || details || side) ? (
          <BottomSheet className="arc-venancor" trigger={<Button ref={eye} variant="ghost" size="sm" className={page.iconButton} aria-label="Ver dados do cliente" title="Ver dados do cliente"><Eye size={20} aria-hidden="true" /></Button>}
            title="Dados do cliente" closeLabel="Fechar dados do cliente" detents={[0.92]}>
            <div className="flex min-w-0 flex-col gap-4 pb-6">
              {next}
              {details}
              {side}
            </div>
          </BottomSheet>
        ) : null}
      </div>
      {actions ? <div className={styles.focusActions}>{actions}</div> : null}
    </header>
    <section className={styles.conversation} aria-labelledby="lead-conversation-title">
      <h2 id="lead-conversation-title" className={styles.srOnly}>Conversa no WhatsApp</h2>
      <div className={styles.conversationBody}>{conversation}</div>
    </section>
  </div>;
}
