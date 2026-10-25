"use client";

/**
 * /leads/arquivados no visual Lite do diretor: a mesma busca por nome, telefone ou e-mail (?search=, formulário GET),
 * as mesmas 50 linhas por página do servidor (?page=) e as mesmas colunas, na lista Lite (tabela no desktop, cartões
 * no celular). Só leitura, como a tela atual.
 */
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Search } from "lucide-react";

import { LiteResponsiveData, type LiteColumn } from "@/components/lite/data/data";
import { LitePagination } from "@/components/lite/data/pagination";
import { formatLiteDate } from "@/components/lite/format/date";
import page from "@/components/lite/page/lite-page.module.css";
import { LEAD_STATUS_LABELS } from "@/features/leads/lead-status-constants";
import { LEAD_QUALIFICATION_LABELS, type LeadQualificationStatus } from "@/features/leads/qualification-status";

export type ArchivedLeadLiteRow = {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  status: string | null;
  qualificationStatus: string | null;
  archivedAt: string | null;
  archivedBy: string | null;
};

function sentenceCase(label: string) {
  return label.charAt(0) + label.slice(1).toLocaleLowerCase("pt-BR");
}

function statusLabel(status: string | null) {
  if (!status) return null;
  return sentenceCase(LEAD_STATUS_LABELS[status] ?? status);
}

function qualificationLabel(status: string | null) {
  if (!status) return null;
  return sentenceCase(LEAD_QUALIFICATION_LABELS[status as LeadQualificationStatus] ?? status);
}

const columns: LiteColumn<ArchivedLeadLiteRow>[] = [
  { id: "lead", label: "Lead", primary: true, render: (lead) => <span className={page.cellTitle}>{lead.name}</span> },
  {
    id: "contact",
    label: "Contato",
    secondary: true,
    render: (lead) => (
      <span>
        <span className={page.numeric}>{lead.phone}</span>
        {lead.email ? <span className={page.cellSub}>{lead.email}</span> : null}
      </span>
    ),
  },
  { id: "status", label: "Etapa", render: (lead) => statusLabel(lead.status) ? <span className={page.badge}>{statusLabel(lead.status)}</span> : <span className={page.muted}>Sem etapa</span> },
  { id: "qualification", label: "Qualificação", render: (lead) => qualificationLabel(lead.qualificationStatus) ?? <span className={page.muted}>Sem qualificação</span> },
  { id: "archivedBy", label: "Arquivado por", nowrap: true, render: (lead) => <span title={lead.archivedBy ?? "Administrador"}>{lead.archivedBy ?? "Administrador"}</span> },
  { id: "archivedAt", label: "Arquivado em", numeric: true, render: (lead) => formatLiteDate(lead.archivedAt, { dateStyle: "short", timeStyle: "short" }) },
];

export function ArchivedLeadsLite({ rows, total, page: currentPage, totalPages, pageSize, search }: {
  rows: ArchivedLeadLiteRow[];
  total: number;
  page: number;
  totalPages: number;
  pageSize: number;
  search: string;
}) {
  const router = useRouter();
  const [pending, startNavigation] = useTransition();
  const goToPage = (target: number) => {
    const query = new URLSearchParams();
    if (target > 1) query.set("page", String(target));
    if (search) query.set("search", search);
    startNavigation(() => router.push(`/leads/arquivados${query.toString() ? `?${query.toString()}` : ""}`));
  };

  return (
    <div className={`arc-venancor ${page.stack}`} data-skin="diretor">
      <div className={page.group}>
        <p className={page.cardDescription}>
          {total} {total === 1 ? "lead retirado" : "leads retirados"} da distribuição sem apagar o histórico. O arquivamento é reversível pela administração e só o diretor consulta esta lista.
        </p>
        <form className={page.toolbar} method="get" role="search" aria-label="Buscar leads arquivados">
          <label className={page.search}>
            <Search aria-hidden="true" size={18} className={page.searchIcon} />
            <input type="search" name="search" defaultValue={search} placeholder="Buscar nome, telefone ou e-mail" aria-label="Buscar leads arquivados" className={page.searchInput} />
          </label>
          <button type="submit" className={page.button}>Buscar</button>
        </form>

        {rows.length === 0 ? (
          <div className={page.empty}>
            <h2 className={page.emptyTitle}>Nenhum lead arquivado encontrado</h2>
            <p className={page.emptyText}>{search ? "Tente outro termo de busca." : "Os leads arquivados aparecem aqui."}</p>
          </div>
        ) : (
          <>
            <LiteResponsiveData caption="Leads arquivados" columns={columns} rows={rows} rowKey={(lead) => lead.id} empty={null} />
            <LitePagination page={currentPage} totalPages={totalPages} totalItems={total} pageSize={pageSize} onPageChange={goToPage} pending={pending} label="Páginas de leads arquivados" />
          </>
        )}
      </div>
    </div>
  );
}
