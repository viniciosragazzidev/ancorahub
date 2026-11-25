"use client";

/**
 * /tarefas no Lite (25/11/2026, inspirada em Tarefas do DeskComm): os retornos do dia de quem acompanha leads o dia
 * todo, agrupados por prazo no fuso de São Paulo. Concluir é a caixa da linha (nível 1: confirmação só depois do
 * servidor, sem som); clicar na linha abre o lead. Criar tarefa continua no lead, então a tela não tem CTA.
 */
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import { LiteUrlSelect } from "@/components/lite/controls/url-select";
import { LiteResponsiveData, type LiteColumn } from "@/components/lite/data/data";
import { LitePagination } from "@/components/lite/data/pagination";
import { ActionNoticeLine, useActionNotice } from "@/components/lite/feedback/action-notice";
import page from "@/components/lite/page/lite-page.module.css";
import { setLeadTaskDoneAction } from "@/features/leads/task-actions";
import { formatTaskDue, groupTasksByDue, isTaskOverdue } from "@/features/tasks/task-due-groups";
import type { TaskListScope, TaskListSituation } from "@/features/tasks/task-list-filters";
import type { TaskListRow } from "@/features/tasks/task-list-queries";

import styles from "./tasks-lite.module.css";

export type TasksLiteProps = {
  rows: TaskListRow[];
  total: number;
  overdue: number;
  page: number;
  totalPages: number;
  pageSize: number;
  scope: TaskListScope;
  situation: TaskListSituation;
  assigneeId: string | null;
  assignees: { id: string; name: string }[];
  canSeeTeam: boolean;
  /** Hora do servidor: agrupa igual no servidor e no navegador. */
  generatedAt: string;
};

const SITUATION_OPTIONS = [
  { value: "abertas", label: "Abertas" },
  { value: "concluidas", label: "Concluídas" },
];

function plural(count: number, one: string, many: string) {
  return `${count.toLocaleString("pt-BR")} ${count === 1 ? one : many}`;
}

export function TasksLite(props: TasksLiteProps) {
  const { rows, total, overdue, scope, situation, assigneeId, assignees, canSeeTeam, generatedAt } = props;
  const router = useRouter();
  const pathname = usePathname() ?? "/tarefas";
  const params = useSearchParams();
  const [pending, startNavigation] = useTransition();
  const notice = useActionNotice();
  const now = useMemo(() => new Date(generatedAt), [generatedAt]);
  // Estado confirmado pelo servidor nesta visita (id -> concluída). A linha fica no lugar para dar para desfazer.
  const [doneById, setDoneById] = useState<Record<string, boolean>>({});
  const [busyIds, setBusyIds] = useState<ReadonlySet<string>>(() => new Set());

  const isDone = (row: TaskListRow) => doneById[row.id] ?? Boolean(row.completedAt);

  // Contador de atrasadas acompanha o que foi concluído ou reaberto aqui, sem esperar recarregar.
  const overdueNow = rows.reduce((value, row) => {
    const local = doneById[row.id];
    if (local === undefined || local === Boolean(row.completedAt) || !isTaskOverdue(row.dueAt, now)) return value;
    return value + (local ? -1 : 1);
  }, overdue);

  const hrefWith = (changes: Record<string, string | null>) => {
    const query = new URLSearchParams(params?.toString() ?? "");
    for (const [key, value] of Object.entries(changes)) {
      if (value === null) query.delete(key);
      else query.set(key, value);
    }
    return `${pathname}${query.toString() ? `?${query.toString()}` : ""}`;
  };

  const goToPage = (target: number) => startNavigation(() => router.push(hrefWith({ page: target > 1 ? String(target) : null }), { scroll: false }));

  async function setDone(row: TaskListRow, next: boolean) {
    if (busyIds.has(row.id)) return;
    notice.tap();
    setBusyIds((current) => new Set(current).add(row.id));
    const result = await setLeadTaskDoneAction(row.id, next ? "done" : "reopen").catch((error: unknown) => ({ error: error instanceof Error ? error.message : undefined, success: false }));
    setBusyIds((current) => {
      const copy = new Set(current);
      copy.delete(row.id);
      return copy;
    });
    if (result.success) {
      setDoneById((current) => ({ ...current, [row.id]: next }));
      notice.succeed(next ? `Tarefa concluída: ${row.title}` : `Tarefa reaberta: ${row.title}`);
      return;
    }
    notice.fail(result, {
      fallback: "Não consegui atualizar a tarefa agora.",
      keeps: next ? "A tarefa continua aberta." : "A tarefa continua concluída.",
      retry: () => void setDone(row, next),
    });
  }

  const openLead = (row: TaskListRow) => router.push(`/leads/${encodeURIComponent(row.leadId)}`);

  const columns: LiteColumn<TaskListRow>[] = [
    {
      id: "done",
      label: "Concluir",
      phonePriority: "high",
      render: (row) => {
        const done = isDone(row);
        const busy = busyIds.has(row.id);
        return (
          <label className={styles.doneBox} aria-busy={busy ? "true" : undefined}>
            <input
              type="checkbox"
              className={styles.doneInput}
              checked={done}
              disabled={busy}
              aria-label={done ? `Reabrir ${row.title}` : `Concluir ${row.title}`}
              onChange={(event) => void setDone(row, event.target.checked)}
            />
          </label>
        );
      },
    },
    {
      id: "title",
      label: "Tarefa",
      primary: true,
      render: (row) => (
        <span>
          <span className={`${page.cellTitle} ${styles.title}`} data-done={isDone(row) ? "true" : undefined}>{row.title}</span>
          {row.priority === "urgent" ? <> <span className={page.badge}>Urgente</span></> : null}
          {row.description ? <span className={page.cellSub}>{row.description}</span> : null}
        </span>
      ),
    },
    {
      id: "lead",
      label: "Lead",
      secondary: true,
      render: (row) => <Link href={`/leads/${encodeURIComponent(row.leadId)}`} className={page.cellLink}>{row.leadName}</Link>,
    },
    { id: "assignee", label: "Responsável", nowrap: true, render: (row) => row.assigneeName ? <span title={row.assigneeName}>{row.assigneeName}</span> : <span className={page.muted}>Sem responsável</span> },
    { id: "due", label: "Prazo", numeric: true, render: (row) => <span className={row.dueAt ? undefined : page.muted}>{formatTaskDue(row.dueAt, now)}</span> },
  ];

  const groups = situation === "concluidas"
    ? (rows.length ? [{ key: "concluidas", label: "Concluídas", rows }] : [])
    : groupTasksByDue(rows, now);

  const assigneeOptions = [{ value: "", label: "Todos os responsáveis" }, ...assignees.map((item) => ({ value: item.id, label: item.name }))];

  return (
    <div className={page.group}>
      <div className={styles.top}>
        {canSeeTeam ? (
          <nav className={page.countTabs} aria-label="De quem são as tarefas">
            <Link href={hrefWith({ escopo: "minhas", responsavel: null, page: null })} className={page.countTab} data-active={scope === "minhas" ? "true" : undefined} aria-current={scope === "minhas" ? "page" : undefined}>Minhas</Link>
            <Link href={hrefWith({ escopo: null, page: null })} className={page.countTab} data-active={scope === "equipe" ? "true" : undefined} aria-current={scope === "equipe" ? "page" : undefined}>Da equipe</Link>
          </nav>
        ) : <span />}
        {overdueNow > 0
          ? <span className={page.badge} data-tone="danger" aria-live="polite">{plural(overdueNow, "atrasada", "atrasadas")}</span>
          : <span className={page.badge} aria-live="polite">Nada atrasado</span>}
      </div>

      <div className={page.toolbar}>
        {scope === "equipe" ? (
          <LiteUrlSelect label="Responsável" param="responsavel" value={assigneeId ?? ""} options={assigneeOptions} resetPage className={page.select} />
        ) : null}
        <LiteUrlSelect label="Situação" param="situacao" value={situation} defaultValue="abertas" options={SITUATION_OPTIONS} resetPage className={page.select} />
      </div>

      <ActionNoticeLine notice={notice.notice} />

      {groups.length === 0 ? (
        <div className={page.empty}>
          <h2 className={page.emptyTitle}>{situation === "concluidas" ? "Nenhuma tarefa concluída" : "Nenhuma tarefa aberta"}</h2>
          <p className={page.emptyText}>
            {situation === "concluidas"
              ? "As tarefas concluídas aparecem aqui."
              : "Crie tarefas no lead: ligar, cobrar documentos, retornar cotação ou confirmar a aprovação."}
          </p>
        </div>
      ) : (
        groups.map((group) => (
          <section key={group.key} className={page.group} aria-labelledby={`tarefas-${group.key}`}>
            <div className={styles.groupHead}>
              <h2 id={`tarefas-${group.key}`} className={page.sectionTitle}>{group.label}</h2>
              <span className={styles.groupCount}>{group.rows.length.toLocaleString("pt-BR")}</span>
            </div>
            <LiteResponsiveData caption={`Tarefas: ${group.label}`} columns={columns} rows={group.rows} rowKey={(row) => row.id} onRowOpen={openLead} empty={null} />
          </section>
        ))
      )}

      <LitePagination page={props.page} totalPages={props.totalPages} totalItems={total} pageSize={props.pageSize} onPageChange={goToPage} pending={pending} label="Páginas de tarefas" itemNoun="tarefas" />
    </div>
  );
}
