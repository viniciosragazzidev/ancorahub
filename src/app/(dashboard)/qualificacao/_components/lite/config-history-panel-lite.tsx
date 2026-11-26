"use client";

/**
 * Histórico do "Prompt e comportamento" (só o diretor), aberto pelo ⋯ da aba. Lista as versões (quem, quando e o que
 * mudou em uma linha) e "Restaurar como nova versão": cria uma versão nova igual à antiga, nunca apaga. O sucesso só
 * aparece depois do servidor (FEEDBACK.md nível 1); a falha mostra a causa, o que continua valendo e "Tentar de novo".
 */
import { useCallback, useEffect, useState } from "react";

import { LiteConfirmDialog } from "@/components/lite/controls";
import { LiteSidePanel } from "@/components/lite/data/side-panel";
import { ActionNoticeLine, useActionNotice } from "@/components/lite/feedback/action-notice";
import page from "@/components/lite/page/lite-page.module.css";
import sections from "@/components/lite/page/lite-sections.module.css";
import { fetchQualificationConfigVersionsAction, restoreQualificationConfigVersionAction } from "@/features/ai-qualification/actions";
import type { ConfigVersionRow } from "@/features/ai-qualification/config-versions-service";

import type { QualificationHubProps } from "../qualification-hub-types";

type LoadState = { status: "loading" } | { status: "error"; error: string } | { status: "unavailable" } | { status: "ready"; versions: ConfigVersionRow[] };

const WHEN = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" });

export function ConfigHistoryPanelLite({ open, onOpenChange, onRestored }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRestored: (settings: NonNullable<QualificationHubProps["settings"]>) => void;
}) {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [confirming, setConfirming] = useState<ConfigVersionRow | null>(null);
  const [busyVersion, setBusyVersion] = useState<number | null>(null);
  const notice = useActionNotice();

  const load = useCallback(() => {
    setState({ status: "loading" });
    fetchQualificationConfigVersionsAction()
      .then((result) => {
        if (!result.ok) setState({ status: "error", error: result.error });
        else if (!result.data.ready) setState({ status: "unavailable" });
        else setState({ status: "ready", versions: result.data.versions });
      })
      .catch(() => setState({ status: "error", error: "Sem conexão agora." }));
  }, []);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  const restore = async (row: ConfigVersionRow) => {
    notice.tap();
    setBusyVersion(row.version);
    const result = await restoreQualificationConfigVersionAction({ version: row.version }).catch(() => ({ ok: false as const, error: "Sem conexão agora." }));
    setBusyVersion(null);
    if (!result.ok) {
      notice.fail(result.error, { keeps: "A versão em uso continua valendo.", retry: () => void restore(row) });
      return;
    }
    if (result.data.settings) onRestored(result.data.settings as NonNullable<QualificationHubProps["settings"]>);
    notice.succeed(`Versão ${row.version} restaurada como versão nova.`);
    load();
  };

  return (
    <>
      <LiteSidePanel open={open} onOpenChange={onOpenChange} title="Histórico do prompt" description="Cada salvar vira uma versão. Restaurar cria uma versão nova e não apaga nada.">
        <div className="flex flex-col gap-ds-16">
          <ActionNoticeLine notice={notice.notice} />
          {state.status === "loading" ? <p className={sections.note} aria-live="polite">Carregando…</p> : null}
          {state.status === "error" ? (
            <p className={sections.note} role="alert">
              {state.error} O prompt em uso continua valendo. <button type="button" className={sections.link} onClick={load}>Tentar de novo</button>
            </p>
          ) : null}
          {state.status === "unavailable" ? (
            <div className={sections.empty}>
              <p className={sections.emptyTitle}>Histórico ainda não ligado</p>
              <p>Falta aplicar a atualização do banco. Até lá, salvar continua gravando por cima.</p>
            </div>
          ) : null}
          {state.status === "ready" && !state.versions.length ? (
            <div className={sections.empty}>
              <p className={sections.emptyTitle}>Nenhuma versão ainda</p>
              <p>A primeira aparece quando você salvar o prompt.</p>
            </div>
          ) : null}
          {state.status === "ready" && state.versions.length ? (
            <ul className={sections.list} aria-label="Versões do prompt">
              {state.versions.map((row) => (
                <li key={row.version} className={sections.item}>
                  <span className={sections.itemText}>
                    <span className={sections.rowTitle}>
                      Versão <span className="tabular-nums">{row.version}</span>
                      {row.current ? <> <span className={page.badge} data-tone="success">Em uso</span></> : null}
                    </span>
                    <span className={sections.itemSub}>{[row.createdByName ?? "Sistema", WHEN.format(new Date(row.createdAt)), row.summary].join(" · ")}</span>
                  </span>
                  {!row.current ? (
                    <button type="button" className={page.button} disabled={busyVersion !== null} aria-busy={busyVersion === row.version || undefined} onClick={() => setConfirming(row)}>
                      {busyVersion === row.version ? "Restaurando…" : "Restaurar como nova versão"}
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </LiteSidePanel>
      <LiteConfirmDialog
        open={Boolean(confirming)}
        title={confirming ? `Restaurar a versão ${confirming.version}?` : "Restaurar versão?"}
        description="Os textos dela viram uma versão nova. A versão atual continua no histórico e a IA segue ligada ou pausada como está."
        confirmLabel="Restaurar como nova versão"
        onCancel={() => setConfirming(null)}
        onConfirm={() => {
          const target = confirming;
          setConfirming(null);
          if (target) void restore(target);
        }}
      />
    </>
  );
}
