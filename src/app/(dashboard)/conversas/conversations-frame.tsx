"use client";

import type { ReactNode } from "react";

import { useArcScopeEnabled } from "@/components/arc/arc-scope-context";
import styles from "./conversas-lite.module.css";

export function ConversationsFrame({
  legacyHeader,
  directorHeader,
  pageActions,
  children,
}: {
  legacyHeader: ReactNode;
  directorHeader?: ReactNode;
  pageActions?: ReactNode;
  children: ReactNode;
}) {
  const directorSkinEnabled = useArcScopeEnabled();

  return (
    <div
      className={`arc-venancor ${styles.root} flex h-app min-h-0 w-full flex-1 flex-col overflow-hidden`}
      data-skin={directorSkinEnabled ? "diretor" : undefined}
    >
      {directorSkinEnabled ? directorHeader ?? legacyHeader : legacyHeader}
      <main
        className="flex min-h-0 w-full flex-1 flex-col overflow-hidden bg-background p-0"
        data-conversations-part={directorSkinEnabled ? "content" : undefined}
      >
        {directorSkinEnabled && pageActions ? (
          <div data-conversations-part="page-actions" className="shrink-0">
            {pageActions}
          </div>
        ) : null}
        <div
          data-lite={directorSkinEnabled ? undefined : "frame"}
          data-conversations-part={directorSkinEnabled ? "frame" : undefined}
          className="flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden bg-card"
        >
          {children}
        </div>
      </main>
    </div>
  );
}
