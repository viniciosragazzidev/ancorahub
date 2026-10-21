"use client";

import { useLayoutEffect, useRef, useState, type ReactNode } from "react";

import { BottomSheet } from "@/components/arc/bottom-sheet/bottom-sheet";
import { Button } from "@/components/arc/button/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useMediaQuery } from "@/hooks/use-media-query";

import styles from "./lead-social.module.css";

type Mode = "phone" | "two" | "three";

/**
 * The layout follows the width it really has, not the window: on computers the conversation list
 * takes 360px on the left (Vinicios, 18/10: spacing and scroll broken at 1440).
 */
export const modeForWidth = (width: number): Mode => (width >= 1180 ? "three" : width >= 720 ? "two" : "phone");

/**
 * The whole lead on one screen, like a social app (Vinicios, 17/10). Slots:
 * header (who and when it arrived), next (the next step and its buttons), details (the client's full data),
 * side (timeline, tasks), conversation (the chat history).
 *
 * Wide (1180px+ of room): details | conversation | next and side, each column with its own scroll.
 * Medium (720px+): header, next, details and side in one column, conversation beside it.
 * Phone: header, next step and conversation; the full data opens in a sheet.
 */
/** A side column: stays put while the chat scrolls, scrolls on its own, bar only while scrolling or hovering. */
function Column({ children }: { children: ReactNode }) {
  return (
    <ScrollArea className={styles.column} type="scroll">
      <div className={styles.columnInner}>{children}</div>
    </ScrollArea>
  );
}

export function LeadSocialLayout({ header, next, details, side, conversation }: {
  header: ReactNode;
  next: ReactNode;
  details?: ReactNode;
  side?: ReactNode;
  conversation: ReactNode;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [measured, setMeasured] = useState<Mode | null>(null);
  // Without a measurable box (no layout yet, tests): the window decides.
  const wideWindow = useMediaQuery("(min-width: 1024px)");
  const mode = measured;

  // Measured before the first paint, then on every resize (rail, window, zoom).
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const measure = () => {
      const width = root.getBoundingClientRect().width;
      setMeasured(width > 0 ? modeForWidth(width) : wideWindow ? "two" : "phone");
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(root);
    return () => observer.disconnect();
  }, [wideWindow]);

  const conversationColumn = (
    <section className={styles.conversation} aria-labelledby="lead-conversation-title">
      <h2 id="lead-conversation-title" className={styles.conversationTitle}>Conversa no WhatsApp</h2>
      <div className={styles.conversationBody}>{conversation}</div>
    </section>
  );

  let body: ReactNode = null;
  if (mode === "phone") {
    body = (
      <div className={styles.phone}>
        <div className={styles.phoneTop}>
          <div className={styles.phoneHeader}>
            <div className={styles.phoneHeaderMain}>{header}</div>
            {details || side ? (
              <BottomSheet className="arc-venancor" trigger={<Button variant="secondary" size="sm" className="min-h-11 shrink-0">Ver dados</Button>} title="Dados do cliente" closeLabel="Fechar dados do cliente" detents={[0.92]}>
                <div className="flex flex-col gap-4 pb-6">
                  {details}
                  {side}
                </div>
              </BottomSheet>
            ) : null}
          </div>
          {next}
        </div>
        {conversationColumn}
      </div>
    );
  } else if (mode === "three") {
    body = (
      <div className={styles.three}>
        <Column>
          {header}
          {details}
        </Column>
        {conversationColumn}
        <Column>
          {next}
          {side}
        </Column>
      </div>
    );
  } else if (mode === "two") {
    body = (
      <div className={styles.two}>
        <Column>
          {header}
          {next}
          {details}
          {side}
        </Column>
        {conversationColumn}
      </div>
    );
  }

  return <div ref={rootRef} className={styles.root} data-mode={mode ?? "measuring"}>{body}</div>;
}
