"use client";

/**
 * Painel lateral Lite (F3): detalhe ou edição ao lado da tela no desktop, BottomSheet do Arc no celular (abaixo de
 * 768px). Modal: prende o foco, Esc e o véu fecham, e o foco volta para quem abriu.
 */
import { useCallback, useEffect, useId, useRef, type ReactNode } from "react";
import { X } from "lucide-react";

import { BottomSheet } from "@/components/arc/bottom-sheet/bottom-sheet";
import { useLitePhone } from "@/components/lite/controls/select";

import styles from "./side-panel.module.css";

export type LiteSidePanelProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
};

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function LiteSidePanel({ open, onOpenChange, title, description, children }: LiteSidePanelProps) {
  const phone = useLitePhone();
  const close = useCallback(() => onOpenChange(false), [onOpenChange]);
  if (phone) {
    return (
      <BottomSheet open={open} onOpenChange={onOpenChange} title={title} description={description} closeLabel="Fechar" detents={[0.92]}>
        {children}
      </BottomSheet>
    );
  }
  return open ? <DesktopPanel title={title} description={description} onClose={close}>{children}</DesktopPanel> : null;
}

function DesktopPanel({ title, description, onClose, children }: { title: string; description?: string; onClose: () => void; children: ReactNode }) {
  const titleId = useId();
  const descriptionId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const returnTo = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    // O foco vai para o primeiro campo do conteúdo; sem campo, para o botão de fechar.
    const first = bodyRef.current?.querySelector<HTMLElement>(FOCUSABLE) ?? panel?.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? panel)?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab" || !panel) return;
      const items = [...panel.querySelectorAll<HTMLElement>(FOCUSABLE)];
      if (!items.length) return;
      const firstItem = items[0]!;
      const lastItem = items[items.length - 1]!;
      if (event.shiftKey && document.activeElement === firstItem) {
        event.preventDefault();
        lastItem.focus();
      } else if (!event.shiftKey && document.activeElement === lastItem) {
        event.preventDefault();
        firstItem.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      returnTo?.focus?.();
    };
  }, [onClose]);

  return (
    <div className={styles.layer}>
      <div className={styles.scrim} aria-hidden="true" onClick={onClose} />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        className={styles.panel}
      >
        <header className={styles.head}>
          <div className={styles.headText}>
            <h2 id={titleId} className={styles.title}>{title}</h2>
            {description ? <p id={descriptionId} className={styles.description}>{description}</p> : null}
          </div>
          <button type="button" className={styles.close} aria-label="Fechar painel" onClick={onClose}>
            <X aria-hidden="true" size={18} />
          </button>
        </header>
        <div ref={bodyRef} className={styles.body}>{children}</div>
      </div>
    </div>
  );
}
