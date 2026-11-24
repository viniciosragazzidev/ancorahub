"use client";

import Link from "next/link";
import { useMemo, useState, type MouseEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";

import { Badge } from "@/components/arc/badge/badge";
import { PeoplePage } from "@/components/light/people-list/people-list";
import { LiteResponsiveData, type LiteColumn } from "@/components/lite/data/data";
import { LitePagination, useLitePages } from "@/components/lite/data/pagination";
import { liteDateFormatter } from "@/components/lite/format/date";
import page from "@/components/lite/page/lite-page.module.css";

import styles from "./team-list-import.module.css";

import { ALL_LISTS, teamListHref } from "./list-names";
import type { SupervisorLeadList } from "./service";
import { TeamListImport, type TeamListBroker } from "./team-list-import";

const fmt = (n: number) => n.toLocaleString("pt-BR");
const normalize = (value: string) => value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const dateTime = liteDateFormatter({ day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });

/**
 * Listas importadas como pastas (24/11/2026, DEC-191): cada importação do supervisor é uma linha, com o que entrou,
 * o que ficou de fora e o que ainda espera distribuição. Clicar abre só os leads daquela lista.
 */
export function TeamListsView({ lists, team, pending, switcher, onOpenList }: { lists: SupervisorLeadList[]; team: TeamListBroker[]; pending: number; switcher: ReactNode; /** Laboratório: abre a lista sem sair da página. */ onOpenList?: (listId: string) => void }) {
  const router = useRouter();
  const open = (listId: string) => (onOpenList ? onOpenList(listId) : router.push(teamListHref(listId)));
  const follow = (listId: string) => (event: MouseEvent) => {
    if (!onOpenList) return;
    event.preventDefault();
    onOpenList(listId);
  };
  const [query, setQuery] = useState("");
  const rows = useMemo(() => {
    const q = normalize(query.trim());
    return q ? lists.filter((list) => normalize(list.name).includes(q)) : lists;
  }, [lists, query]);
  const pages = useLitePages(rows, 25);
  const totalLeads = lists.reduce((sum, list) => sum + list.total, 0);

  const columns: LiteColumn<SupervisorLeadList>[] = [
    {
      id: "name", label: "Lista", primary: true, nowrap: true,
      render: (list) => <Link href={teamListHref(list.id)} onClick={follow(list.id)} className={`${page.cellTitle} ${page.cellLink}`} title={list.name}>{list.name}</Link>,
    },
    { id: "created", label: "Importada em", secondary: true, nowrap: true, render: (list) => (list.legacy ? "Antes das listas" : dateTime.format(new Date(list.createdAt))) },
    { id: "imported", label: "Entraram", numeric: true, render: (list) => fmt(list.imported) },
    { id: "duplicates", label: "Duplicados", numeric: true, phonePriority: "low", render: (list) => fmt(list.duplicates) },
    { id: "rejected", label: "Fora", numeric: true, phonePriority: "low", render: (list) => fmt(list.rejected) },
    {
      id: "pending", label: "Para distribuir", numeric: true, phonePriority: "high",
      render: (list) => (list.pending ? <Badge tone="info" size="sm">{fmt(list.pending)}</Badge> : <span>{list.total ? "Distribuída" : "0"}</span>),
    },
    { id: "replied", label: "Responderam", numeric: true, render: (list) => fmt(list.replied) },
  ];

  return (
    <PeoplePage
      title="Listas importadas"
      subtitle={lists.length ? `${lists.length === 1 ? "1 lista" : `${fmt(lists.length)} listas`} · ${fmt(totalLeads)} contatos · ${fmt(pending)} para distribuir` : "Cada importação vira uma lista separada."}
      action={<TeamListImport pending={pending} team={team} />}
    >
      {switcher}
      <section className={page.stack} aria-label="Listas importadas">
        <div className={page.toolbar}>
          <label className={page.search}>
            <Search aria-hidden="true" size={18} className={page.searchIcon} />
            <input type="search" className={page.searchInput} aria-label="Buscar lista" placeholder="Buscar lista pelo nome" value={query} onChange={(event) => { setQuery(event.target.value); pages.reset(); }} />
          </label>
          {lists.length > 1 ? <Link href={teamListHref(ALL_LISTS)} onClick={follow(ALL_LISTS)} className={styles.back}>Ver todos os contatos</Link> : null}
        </div>
        <LiteResponsiveData
          caption="Listas importadas pela supervisão"
          columns={columns}
          rows={pages.pageRows}
          rowKey={(list) => list.id}
          onRowOpen={(list) => open(list.id)}
          empty={<p>{query ? "Nenhuma lista com esse nome." : "Nenhuma lista ainda. Use Importar contatos: cada importação vira uma lista aqui."}</p>}
        />
        <LitePagination {...pages.pagination} label="Páginas das listas" itemNoun="listas" />
      </section>
    </PeoplePage>
  );
}
