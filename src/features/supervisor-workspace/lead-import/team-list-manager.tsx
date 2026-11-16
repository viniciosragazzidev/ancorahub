"use client";

import { useMemo, useState, type ReactNode } from "react";

import { Badge } from "@/components/arc/badge/badge";
import { Button } from "@/components/arc/button/button";
import { PeopleEmpty, PeopleFilters, PeoplePage, PeopleRow, PeopleSection } from "@/components/light/people-list/people-list";

import type { TeamListRow } from "./service";
import { TeamListImport, type TeamListBroker } from "./team-list-import";
import styles from "./team-list-import.module.css";

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
export function TeamListManager({ rows, totals, team, switcher }: { rows: TeamListRow[]; totals: Totals; team: TeamListBroker[]; switcher: ReactNode }) {
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

  return (
    <PeoplePage
      title="Lista importada"
      subtitle={`${fmt(totals.pending)} para distribuir · ${fmt(totals.distributed)} distribuídos · ${fmt(totals.replied)} responderam`}
      action={<TeamListImport pending={totals.pending} team={team} selectedLeadIds={selected} onSelectionDone={() => setSelected([])} />}
    >
      {switcher}
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
                preview={pending ? row.phone.replace(/^55(\d{2})(\d{5})(\d{4})$/, "($1) $2-$3") : `Com ${row.brokerName ?? "corretor"}`}
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
