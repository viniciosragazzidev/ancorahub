"use client";

/**
 * Alertas da IA (/ia/alertas): tabela Lite com abas Abertos e Resolvidos; clique na linha abre a gaveta com
 * "O que aconteceu" e "O que fazer". Resolver só vale para alerta gravado (o calculado some sozinho) e confirma
 * depois do servidor (FEEDBACK.md, nível 1).
 */
import { useMemo, useState } from "react";
import Link from "next/link";

import { LiteActionButton, LiteMenu } from "@/components/lite/controls";
import { LiteResponsiveData, type LiteColumn } from "@/components/lite/data/data";
import { LiteSidePanel } from "@/components/lite/data/side-panel";
import { ActionNoticeLine, useActionNotice } from "@/components/lite/feedback/action-notice";
import { formatLiteDate } from "@/components/lite/format/date";
import page from "@/components/lite/page/lite-page.module.css";
import { acknowledgeAlertAction } from "@/features/ai-qualification/actions";
import { alertLevelView, alertsForTab, alertTitle, alertWhatToDo, canResolveAlert, isOpenAlert, toAlertRow, type AlertRow, type AlertTab } from "@/features/ai-qualification/alerts-view";

import hub from "../../_components/ia-hub.module.css";

export type AlertsServices = { resolve: (id: string) => Promise<AlertRow[]> };

const defaultServices: AlertsServices = {
  resolve: async (id) => (await acknowledgeAlertAction(id)).map(toAlertRow),
};

function since(value: string | null) {
  return formatLiteDate(value, { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }, "Sem data");
}

export function AlertsWorkspace({ initialRows, services = defaultServices }: { initialRows: AlertRow[]; services?: AlertsServices }) {
  const [rows, setRows] = useState(initialRows);
  const [tab, setTab] = useState<AlertTab>("open");
  const [openId, setOpenId] = useState<string | null>(null);
  // Resolvido pela gaveta: o botão fica lá mostrando "Alerta resolvido" até a gaveta fechar.
  const [resolvedHere, setResolvedHere] = useState<string | null>(null);
  const notice = useActionNotice();

  const openCount = rows.filter(isOpenAlert).length;
  const visible = useMemo(() => alertsForTab(rows, tab), [rows, tab]);
  const open = openId ? rows.find((row) => row.id === openId) ?? null : null;

  const resolve = async (row: AlertRow) => {
    const updated = await services.resolve(row.id);
    setRows(updated);
  };

  const resolveFromMenu = async (row: AlertRow) => {
    notice.tap();
    try {
      await resolve(row);
      notice.succeed(`${alertTitle(row.alertType)}: resolvido.`);
    } catch (error) {
      notice.fail(error, { fallback: "Não deu para resolver o alerta agora.", keeps: "O alerta continua aberto.", retry: () => void resolveFromMenu(row) });
    }
  };

  const columns: LiteColumn<AlertRow>[] = [
    {
      id: "level", label: "Gravidade", nowrap: true,
      render: (row) => { const view = alertLevelView(row.level); return <span className={page.badge} data-tone={view.tone}>{view.label}</span>; },
    },
    {
      id: "what", label: "O que aconteceu", primary: true,
      render: (row) => (
        <span>
          <span className={page.cellTitle}>{alertTitle(row.alertType)}</span>
          <span className={`${page.cellSub} ${page.clamp2}`}>{row.message}</span>
        </span>
      ),
    },
    { id: "since", label: "Desde", nowrap: true, numeric: true, render: (row) => since(row.createdAt) },
    {
      id: "actions", label: "Ações", nowrap: true,
      render: (row) => (
        <span onClick={(event) => event.stopPropagation()}>
          <LiteMenu
            label={`Ações do alerta ${alertTitle(row.alertType)}`}
            items={[
              row.href ? { id: "open", label: "Abrir", href: row.href } : { id: "open", label: "Abrir", onSelect: () => setOpenId(row.id) },
              ...(canResolveAlert(row) ? [{ id: "resolve", label: "Resolver", onSelect: () => void resolveFromMenu(row) }] : []),
            ]}
          />
        </span>
      ),
    },
  ];

  return (
    <>
      <section className={page.group} aria-labelledby="ia-alerts-title">
        <header className={page.cardHead}>
          <h2 id="ia-alerts-title" className={page.cardTitle}>Alertas da IA</h2>
          <p className={page.cardDescription}>Lead sem corretor, falhas seguidas da IA e problemas da operação. Os calculados somem sozinhos quando o problema acaba.</p>
        </header>
        <nav className={page.countTabs} aria-label="Filtrar alertas">
          {([
            { value: "open", label: "Abertos", count: openCount },
            { value: "resolved", label: "Resolvidos", count: rows.length - openCount },
          ] as const).map((item) => (
            <button key={item.value} type="button" className={page.countTab} data-active={tab === item.value ? "true" : undefined} aria-pressed={tab === item.value} onClick={() => setTab(item.value)}>
              {item.label}<span className={page.countPill}>{item.count}</span>
            </button>
          ))}
        </nav>
        <ActionNoticeLine notice={notice.notice} />
        <LiteResponsiveData
          caption="Alertas da IA"
          columns={columns}
          rows={visible}
          rowKey={(row) => row.id}
          onRowOpen={(row) => setOpenId(row.id)}
          rowTone={(row) => (isOpenAlert(row) ? undefined : "muted")}
          empty={<p className={page.emptyText}>{tab === "open" ? "Nenhum alerta aberto. A IA e a fila estão em dia." : "Nenhum alerta resolvido ainda."}</p>}
        />
      </section>

      <LiteSidePanel
        open={Boolean(open)}
        onOpenChange={(value) => { if (!value) { setOpenId(null); setResolvedHere(null); } }}
        title={open ? alertTitle(open.alertType) : "Alerta"}
        description={open ? `${alertLevelView(open.level).label} · desde ${since(open.createdAt)}` : undefined}
      >
        {open ? (
          <div className={hub.drawerBody}>
            <div className={hub.drawerBlock}>
              <h3 className={hub.drawerTitle}>O que aconteceu</h3>
              <p className={hub.drawerText}>{open.message}</p>
              {open.live ? <p className={hub.drawerText}>Some sozinho quando o problema acabar.</p> : null}
              {!isOpenAlert(open) && open.resolvedAt ? <p className={hub.drawerText}>Resolvido em {since(open.resolvedAt)}.</p> : null}
            </div>
            <div className={hub.drawerBlock}>
              <h3 className={hub.drawerTitle}>O que fazer</h3>
              <p className={hub.drawerText}>{alertWhatToDo(open)}</p>
            </div>
            <div className={hub.drawerActions}>
              {canResolveAlert(open) || resolvedHere === open.id ? (
                <LiteActionButton busyLabel="Resolvendo…" doneLabel="Alerta resolvido" keeps="O alerta continua aberto." errorFallback="Não deu para resolver o alerta agora." onAction={async () => { await resolve(open); setResolvedHere(open.id); }}>
                  Resolver
                </LiteActionButton>
              ) : null}
              {open.href ? <Link href={open.href} className={canResolveAlert(open) ? page.button : page.primaryButton}>Abrir</Link> : null}
            </div>
          </div>
        ) : null}
      </LiteSidePanel>
    </>
  );
}
