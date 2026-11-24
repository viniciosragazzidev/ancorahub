"use client";

import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";

import { Badge } from "@/components/arc/badge/badge";
import { Button } from "@/components/arc/button/button";
import { ChipGroup } from "@/components/arc/chip-group/chip-group";
import { PeopleEmpty, PeopleFilters, PeoplePage, PeopleRow, PeopleSection } from "@/components/light/people-list/people-list";
import { liteDateFormatter } from "@/components/lite/format/date";

import { ALL_LISTS, teamListHref } from "./list-names";
import type { SupervisorLeadList, TeamListRow } from "./service";
import { TeamListImport, type TeamListBroker } from "./team-list-import";
import { TeamListRename } from "./team-list-rename";
import styles from "./team-list-import.module.css";

/** Listas separadas (DEC-191): a lista aberta (null = todas) e as outras, para o filtro "Lista". */
export type TeamListFolders = {
  current: Pick<SupervisorLeadList, "id" | "name" | "createdAt" | "importedBy" | "imported" | "duplicates" | "rejected" | "legacy"> | null;
  all: Array<Pick<SupervisorLeadList, "id" | "name">>;
  /** Laboratório: troca de lista sem sair da página (null = pastas). */
  onOpenList?: (listId: string | null) => void;
};

const importedAt = liteDateFormatter({ day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

/** "Importada em 24/11/2026 14:05 por Daianne · 120 entraram · 8 duplicados · 3 fora". */
export function listSummary(list: NonNullable<TeamListFolders["current"]>) {
  const when = list.legacy ? "Importada antes das listas separadas" : `Importada em ${importedAt.format(new Date(list.createdAt))}`;
  const who = list.importedBy ? ` por ${list.importedBy.split(/\s+/)[0]}` : "";
  const counts = [`${fmt(list.imported)} ${list.imported === 1 ? "entrou" : "entraram"}`];
  if (list.duplicates) counts.push(`${fmt(list.duplicates)} ${list.duplicates === 1 ? "duplicado" : "duplicados"}`);
  if (list.rejected) counts.push(`${fmt(list.rejected)} fora`);
  return `${when}${who} · ${counts.join(" · ")}`;
}

type Filter = "all" | "pending" | "distributed" | "replied";
type Totals = { all: number; pending: number; distributed: number; replied: number };

const PAGE = 100;
const fmt = (n: number) => n.toLocaleString("pt-BR");
const STATUS: Record<string, string> = {
  new: "Para distribuir",
  distributed: "Novo",
  in_contact: "Em atendimento",
  quote_sent: "Cotação enviada",
  negotiation: "Negociação",
  documentation_pending: "Documentos",
  under_analysis: "Em análise",
  awaiting_reply: "Aguardando resposta",
  converted: "Venda",
  lost: "Perdido",
};
const normalize = (value: string) => value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/**
 * "Lista importada" do supervisor (16/11/2026): todos os contatos que ele importou, para distribuir e já
 * distribuídos, com quem está cada um e se o cliente respondeu. Marca os que esperam e distribui em lote.
 */
export function TeamListManager({ rows, totals, team, switcher, folders = null }: { rows: TeamListRow[]; totals: Totals; team: TeamListBroker[]; switcher: ReactNode; folders?: TeamListFolders | null }) {
  const router = useRouter();
  const [renamed, setRenamed] = useState<string | null>(null);
  const current = folders?.current ?? null;
  const go = (listId: string | null) => (folders?.onOpenList ? folders.onOpenList(listId) : router.push(teamListHref(listId)));
  const listNames = useMemo(() => new Map((folders?.all ?? []).map((list) => [list.id, list.name])), [folders]);
  const [filter, setFilter] = useState<Filter>(totals.pending ? "pending" : "all");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [shown, setShown] = useState(PAGE);

  const visible = useMemo(() => {
    const q = normalize(query.trim());
    const digits = query.replace(/\D/g, "");
    return rows.filter((row) => {
      if (filter === "pending" && row.brokerId) return false;
      if (filter === "distributed" && !row.brokerId) return false;
      if (filter === "replied" && !row.replied) return false;
      if (!q) return true;
      return normalize(row.name).includes(q) || normalize(row.brokerName ?? "").includes(q) || Boolean(digits && row.phone.includes(digits));
    });
  }, [rows, filter, query]);

  const pendingVisible = visible.filter((row) => !row.brokerId).map((row) => row.id);
  const allMarked = pendingVisible.length > 0 && pendingVisible.every((id) => selected.includes(id));
  const options = [
    { id: "pending" as const, label: "Para distribuir", count: totals.pending },
    { id: "distributed" as const, label: "Distribuídos", count: totals.distributed },
    { id: "replied" as const, label: "Responderam", count: totals.replied },
    { id: "all" as const, label: "Todos", count: totals.all },
  ];

  function toggle(id: string) {
    setSelected((current) => (current.includes(id) ? current.filter((value) => value !== id) : [...current, id]));
  }

  function toggleAll() {
    setSelected((current) => (allMarked ? current.filter((id) => !pendingVisible.includes(id)) : [...new Set([...current, ...pendingVisible])]));
  }

  const status = `${fmt(totals.pending)} para distribuir · ${fmt(totals.distributed)} distribuídos · ${fmt(totals.replied)} responderam`;
  const title = folders ? (current ? renamed ?? current.name : "Todos os contatos") : "Lista importada";

  return (
    <PeoplePage
      title={title}
      subtitle={current ? <>{listSummary(current)}<br />{status}</> : status}
      action={(
        <span className={styles.headerActions}>
          <TeamListImport pending={totals.pending} team={team} selectedLeadIds={selected} onSelectionDone={() => setSelected([])} listId={current?.id ?? null} />
          {current ? <TeamListRename listId={current.id} name={renamed ?? current.name} onRenamed={setRenamed} /> : null}
        </span>
      )}
    >
      {switcher}
      {folders ? (
        <>
          <Link href={teamListHref(null)} className={styles.back} onClick={(event) => { if (folders.onOpenList) { event.preventDefault(); go(null); } }}>Todas as listas</Link>
          {folders.all.length > 1 ? (
            <ChipGroup
              label="Lista"
              options={folders.all.map((list) => ({ value: list.id, label: list.id === current?.id && renamed ? renamed : list.name }))}
              value={current ? [current.id] : []}
              onValueChange={(next) => go(next[0] ?? ALL_LISTS)}
              maxVisible={5}
            />
          ) : null}
        </>
      ) : null}
      <PeopleFilters
        label="Situação da lista"
        options={options}
        value={filter}
        onChange={(next) => { setFilter(next); setShown(PAGE); }}
        search={query}
        onSearch={(next) => { setQuery(next); setShown(PAGE); }}
        searchPlaceholder="Buscar por nome, telefone ou corretor"
        searchLabel="Buscar na lista importada"
      />
      {pendingVisible.length ? (
        <div className={styles.selectBar}>
          <span className={styles.detail}>{selected.length ? `${fmt(selected.length)} marcados para distribuir` : "Marque os contatos que vão para a equipe, ou distribua por quantidade."}</span>
          <Button variant="ghost" size="sm" onClick={toggleAll}>{allMarked ? "Desmarcar estes" : `Marcar ${fmt(pendingVisible.length)}`}</Button>
        </div>
      ) : null}
      {!visible.length ? (
        <PeopleEmpty
          title={query ? "Ninguém com essa busca" : filter === "pending" ? "Nada esperando para distribuir" : filter === "replied" ? "Ninguém respondeu ainda" : "Nenhum contato importado"}
          description={filter === "replied" ? "Quando o cliente responde ao corretor, ele aparece aqui e também para a direção." : "Use Importar contatos para trazer uma lista para a equipe."}
        />
      ) : (
        <PeopleSection label="Contatos da lista importada">
          {visible.slice(0, shown).map((row, index) => {
            const pending = !row.brokerId;
            return (
              <PeopleRow
                key={row.id}
                index={index}
                name={row.name}
                seed={row.id}
                href={pending ? undefined : `/leads/${encodeURIComponent(row.id)}`}
                avatar={pending ? (
                  <label className={styles.rowCheck}>
                    <input type="checkbox" checked={selected.includes(row.id)} onChange={() => toggle(row.id)} aria-label={`Marcar ${row.name} para distribuir`} />
                  </label>
                ) : undefined}
                chip={<Badge tone={pending ? "neutral" : row.replied ? "success" : "info"} size="sm">{pending ? "Para distribuir" : row.replied ? "Respondeu" : STATUS[row.status] ?? "Com o corretor"}</Badge>}
                preview={[
                  // Em "Todos os contatos", cada linha diz de qual lista veio.
                  folders && !current && row.listId ? listNames.get(row.listId) : null,
                  pending ? row.phone.replace(/^55(\d{2})(\d{5})(\d{4})$/, "($1) $2-$3") : `Com ${row.brokerName ?? "corretor"}`,
                ].filter(Boolean).join(" · ")}
              />
            );
          })}
        </PeopleSection>
      )}
      {visible.length > shown ? (
        <Button variant="ghost" onClick={() => setShown((current) => current + PAGE)}>{`Mostrar mais ${fmt(Math.min(PAGE, visible.length - shown))} de ${fmt(visible.length - shown)}`}</Button>
      ) : null}
    </PeoplePage>
  );
}
