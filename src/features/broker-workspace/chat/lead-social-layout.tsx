"use client";

import type { ReactNode } from "react";

import { BottomSheet } from "@/components/arc/bottom-sheet/bottom-sheet";
import { Button } from "@/components/arc/button/button";
import { useMediaQuery } from "@/hooks/use-media-query";

import styles from "./lead-social.module.css";

/**
 * The whole lead on one screen, like a social app (Vinicios, 17/10). Slots:
 * header (who and when it arrived), next (the next step), details (the client's full data),
 * side (actions and timeline), conversation (the chat).
 *
 * Computer 1280+: details | conversation | next and side, each column with its own scroll.
 * Computer 1024-1279: header, next, details and side in one column, conversation beside it.
 * Phone: header, next step and conversation; the full data opens in a sheet.
 */
export function LeadSocialLayout({ header, next, details, side, conversation }: {
  header: ReactNode;
  next: ReactNode;
  details?: ReactNode;
  side?: ReactNode;
  conversation: ReactNode;
}) {
  const wide = useMediaQuery("(min-width: 1024px)");
  const xl = useMediaQuery("(min-width: 1280px)");

  if (!wide) {
    return (
      <div className={styles.mobile}>
        <div className={styles.mobileTop}>
          {header}
          {next}
          {details || side ? (
            <BottomSheet trigger={<Button variant="secondary" className="min-h-11 w-full">Ver dados do cliente</Button>} title="Dados do cliente" detents={[0.92]}>
              <div className="flex flex-col gap-4">
                {details}
                {side}
              </div>
            </BottomSheet>
          ) : null}
        </div>
        <div className={styles.conversation}>{conversation}</div>
      </div>
    );
  }

  if (xl) {
    return (
      <div className={styles.wideXl}>
        <div className={styles.column}>
          {header}
          {details}
        </div>
        <div className={styles.conversation}>{conversation}</div>
        <div className={styles.column}>
          {next}
          {side}
        </div>
      </div>
    );
  }

  return (
    <div className={styles.wide}>
      <div className={styles.column}>
        {header}
        {next}
        {details}
        {side}
      </div>
      <div className={styles.conversation}>{conversation}</div>
    </div>
  );
}
