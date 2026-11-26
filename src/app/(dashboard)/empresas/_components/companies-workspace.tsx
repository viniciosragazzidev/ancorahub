"use client";

/**
 * Empresas (/empresas, 25/11): carteira PJ da corretora numa tabela Lite com busca por nome ou CNPJ. A linha abre a
 * gaveta com o cadastro, "Consultar CNPJ" (Receita via BrasilAPI, no servidor) e os leads PJ da empresa.
 * As linhas já chegam no escopo de quem vê: diretor a empresa toda, gestor a unidade.
 */
import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";

import { LiteResponsiveData, type LiteColumn } from "@/components/lite/data/data";
import { LitePagination, useLitePages } from "@/components/lite/data/pagination";
import { LiteSidePanel } from "@/components/lite/data/side-panel";
import { formatLiteDate } from "@/components/lite/format/date";
import page from "@/components/lite/page/lite-page.module.css";
import { formatCnpj, matchesCompanyQuery } from "@/features/companies/cnpj";
import { CnpjLookupPanel } from "@/features/companies/components/cnpj-lookup-panel";
import { opportunitiesLabel } from "@/features/companies/company-portfolio";
import { LEAD_STATUS_LABELS } from "@/features/leads/lead-status-constants";

import { consultarCnpjAction, usarDadosCnpjAction } from "../actions";
import styles from "./companies-workspace.module.css";

export type CompanyRow = {
  id: string;
  name: string;
  legalName: string | null;
  cnpj: string | null;
  employeeCount: number | null;
  branchName: string | null;
  openLeads: number;
  totalLeads: number;
};

export type CompanyLeadRow = {
  id: string;
  companyId: string;
  nome: string;
  status: string;
  corretorName: string | null;
  createdAt: string | null;
};

function stageLabel(status: string) {
  const label = LEAD_STATUS_LABELS[status] ?? status;
  const lower = label.toLocaleLowerCase("pt-BR");
  return lower.charAt(0).toLocaleUpperCase("pt-BR") + lower.slice(1);
}

function lives(count: number | null) {
  return count === null ? "Sem dado" : count.toLocaleString("pt-BR");
}

export function CompaniesWorkspace({ companies, leads, canEdit }: { companies: CompanyRow[]; leads: CompanyLeadRow[]; canEdit: boolean }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const filtered = useMemo(() => companies.filter((company) => matchesCompanyQuery(company, query)), [companies, query]);
  const pages = useLitePages(filtered, 20);
  const open = openId ? companies.find((company) => company.id === openId) ?? null : null;
  const openLeads = useMemo(() => (open ? leads.filter((lead) => lead.companyId === open.id) : []), [leads, open]);
  const totalOpen = companies.reduce((sum, company) => sum + company.openLeads, 0);
  const total = companies.reduce((sum, company) => sum + company.totalLeads, 0);

  const columns: LiteColumn<CompanyRow>[] = [
    {
      id: "name", label: "Empresa", primary: true,
      render: (row) => (
        <span>
          <span className={page.cellTitle}>{row.name}</span>
          {row.legalName && row.legalName !== row.name ? <span className={page.cellSub}>{row.legalName}</span> : null}
        </span>
      ),
    },
    { id: "cnpj", label: "CNPJ", nowrap: true, numeric: true, render: (row) => (row.cnpj ? formatCnpj(row.cnpj) : <span className={page.muted}>Não informado</span>) },
    { id: "branch", label: "Unidade", secondary: true, nowrap: true, render: (row) => row.branchName ?? <span className={page.muted}>Sem unidade</span> },
    { id: "lives", label: "Vidas", numeric: true, nowrap: true, render: (row) => lives(row.employeeCount) },
    { id: "leads", label: "Oportunidades", numeric: true, nowrap: true, phonePriority: "high", render: (row) => opportunitiesLabel(row.openLeads, row.totalLeads) },
  ];

  const trimmed = query.trim();

  return (
    <>
      <section className={page.group} aria-labelledby="companies-title">
        <header className={page.cardHead}>
          <h2 id="companies-title" className={page.cardTitle}>Empresas ({companies.length.toLocaleString("pt-BR")})</h2>
          <p className={page.cardDescription}>
            Empresas nascem do cadastro de um lead PJ. {total ? `Oportunidades: ${opportunitiesLabel(totalOpen, total)}.` : "Nenhuma oportunidade ainda."}
          </p>
        </header>
        <div className={page.toolbar}>
          <label className={page.search}>
            <Search aria-hidden="true" size={18} className={page.searchIcon} />
            <input
              className={page.searchInput}
              value={query}
              onChange={(event) => { setQuery(event.target.value); pages.reset(); }}
              placeholder="Buscar por nome ou CNPJ"
              aria-label="Buscar empresa por nome ou CNPJ"
            />
          </label>
        </div>
        <LiteResponsiveData
          caption="Empresas da carteira PJ"
          columns={columns}
          rows={pages.pageRows}
          rowKey={(row) => row.id}
          onRowOpen={(row) => setOpenId(row.id)}
          empty={
            <p className={page.emptyText}>
              {trimmed ? `Nenhuma empresa para "${trimmed}". Tente outro nome ou CNPJ.` : "Nenhuma empresa ainda. Elas aparecem quando um lead PJ é cadastrado."}
            </p>
          }
        />
        <LitePagination {...pages.pagination} itemNoun="empresas" label="Páginas das empresas" />
      </section>

      <LiteSidePanel
        open={Boolean(open)}
        onOpenChange={(value) => { if (!value) setOpenId(null); }}
        title={open?.name ?? "Empresa"}
        description={open ? `${open.branchName ?? "Sem unidade"} · ${opportunitiesLabel(open.openLeads, open.totalLeads)}` : undefined}
      >
        {open ? (
          <div className={styles.body}>
            <section className={styles.block} aria-labelledby="company-data-title">
              <h3 id="company-data-title" className={styles.blockTitle}>Cadastro</h3>
              <dl className={styles.facts}>
                <dt>Nome</dt><dd>{open.name}</dd>
                <dt>Razão social</dt><dd>{open.legalName ?? "Não informada"}</dd>
                <dt>CNPJ</dt><dd className={styles.numeric}>{open.cnpj ? formatCnpj(open.cnpj) : "Não informado"}</dd>
                <dt>Unidade</dt><dd>{open.branchName ?? "Sem unidade"}</dd>
                <dt>Vidas</dt><dd className={styles.numeric}>{lives(open.employeeCount)}</dd>
              </dl>
            </section>

            <section className={styles.block} aria-labelledby="company-cnpj-title">
              <h3 id="company-cnpj-title" className={styles.blockTitle}>Consultar CNPJ</h3>
              <CnpjLookupPanel
                key={open.id}
                initialCnpj={open.cnpj}
                onLookup={consultarCnpjAction}
                onUse={canEdit ? async (data) => {
                  const result = await usarDadosCnpjAction({ companyId: open.id, cnpj: data.cnpj });
                  if (result.ok) router.refresh();
                  return result;
                } : undefined}
                useHint={canEdit ? "Grava a razão social da Receita no cadastro desta empresa." : undefined}
                useDoneLabel="Razão social gravada"
              />
            </section>

            <section className={styles.block} aria-labelledby="company-leads-title">
              <h3 id="company-leads-title" className={styles.blockTitle}>Leads PJ ({openLeads.length.toLocaleString("pt-BR")})</h3>
              {openLeads.length ? (
                <ul className={styles.leads}>
                  {openLeads.map((lead) => (
                    <li key={lead.id}>
                      <Link href={`/leads/${lead.id}`} className={styles.lead}>
                        <span className={styles.leadMain}>
                          <span className={styles.leadName}>{lead.nome}</span>
                          <span className={styles.leadSub}>
                            {lead.corretorName ?? "Sem corretor"}
                            {lead.createdAt ? ` · ${formatLiteDate(lead.createdAt, { day: "2-digit", month: "2-digit", year: "2-digit" }, "")}` : ""}
                          </span>
                        </span>
                        <span className={page.badge} data-tone={lead.status === "converted" ? "success" : undefined}>
                          {stageLabel(lead.status)}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className={styles.text}>Nenhum lead PJ no seu acesso para esta empresa.</p>
              )}
            </section>
          </div>
        ) : null}
      </LiteSidePanel>
    </>
  );
}
