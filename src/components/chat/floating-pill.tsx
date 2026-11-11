"use client";

import type { ReactNode } from "react";

import styles from "./chat.module.css";

/**
 * FloatingPill do Lite (LITE_CHAT_DESIGN_SYSTEM.md §5.8): fixa no pé (área segura + 20 px),
 * centralizada, 50 px, raio total. `tone="whatsapp"` usa o verde do WhatsApp, reservado ao
 * "Abrir WhatsApp". `pulse` pede atenção (parado com movimento reduzido).
 */
export function FloatingPill({ children, onClick, tone = "action", pulse = false, ariaLabel, mobileOnly = false }: {
  children: ReactNode;
  onClick: () => void;
  tone?: "action" | "whatsapp";
  pulse?: boolean;
  ariaLabel?: string;
  mobileOnly?: boolean;
}) {
  return (
    <div className={styles.pillWrap} data-mobile-only={mobileOnly ? "" : undefined}>
      <button
        type="button"
        className={[styles.pill, tone === "whatsapp" ? styles.pillWhatsapp : "", pulse ? (tone === "whatsapp" ? styles.pillPulseWhatsapp : styles.pillPulse) : ""].filter(Boolean).join(" ")}
        aria-label={ariaLabel}
        onClick={onClick}
      >
        {children}
      </button>
    </div>
  );
}
