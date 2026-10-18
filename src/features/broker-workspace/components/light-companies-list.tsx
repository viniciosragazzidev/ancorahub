"use client";

import { useMemo, useState } from "react";
import { Avatar } from "@/components/arc/avatar/avatar";
import { AnimatedCounter } from "@/components/arc/animated-counter/animated-counter";
import { EmptyState } from "@/components/arc/empty-state/empty-state";
import { SearchField } from "@/components/arc/search-field/search-field";
import { AssistantAvatar } from "@/components/chat/assistant-avatar";
import { LitePageEnter, LiteList, LiteListItem } from "@/components/light/light-motion";

export type LightCompanyItem = {
  id: string;
  name: string;
  cnpj: string | null;
  employeeCount: number | null;
  branchName: string | null;
  leadCount: number;
};

/**
 * Empresas (PJ) do gestor no Lite: a carteira da unidade, com busca e a contagem de leads por empresa.
 * Os dados já vêm filtrados pelo escopo da unidade (buildCompanyReadScope).
 */
export function LightCompaniesList({ companies }: { companies: LightCompanyItem[] }) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return companies;
    return companies.filter((company) => company.name.toLowerCase().includes(q) || (company.cnpj ?? "").includes(q));
  }, [companies, query]);
  const totalLeads = companies.reduce((sum, company) => sum + company.leadCount, 0);

  return (
    <LitePageEnter className="flex min-h-full flex-col text-foreground">
      <div className="arc-venancor lite-page flex flex-1 flex-col gap-5">
        <header>
          <h1 className="lite-page-title">Empresas</h1>
          <p className="lite-page-subtitle">Carteira PJ da sua unidade</p>
        </header>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-(--surface-muted) p-4">
            <p className="text-2xl font-semibold tabular-nums text-(--foreground)"><AnimatedCounter value={companies.length} locale="pt-BR" /></p>
            <p className="text-xs text-(--text-secondary)">Empresas</p>
          </div>
          <div className="rounded-2xl bg-(--surface-muted) p-4">
            <p className="text-2xl font-semibold tabular-nums text-(--foreground)"><AnimatedCounter value={totalLeads} locale="pt-BR" /></p>
            <p className="text-xs text-(--text-secondary)">Leads PJ</p>
          </div>
        </div>

        <SearchField label="Buscar empresa" placeholder="Nome ou CNPJ" value={query} onValueChange={setQuery} />

        {filtered.length > 0 ? (
          <LiteList className="flex flex-col gap-3" label="Empresas">
            {filtered.map((company) => (
              <LiteListItem key={company.id} className="flex items-center gap-4 rounded-3xl bg-(--surface) p-5 shadow-(--shadow-resting)">
                <Avatar name={company.name} size="lg" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-base font-semibold text-(--foreground)">{company.name}</p>
                  <p className="text-sm text-(--text-secondary)">{company.branchName ?? "Sem unidade"}{company.employeeCount ? ` · ${company.employeeCount} vidas` : ""}</p>
                  <p className="text-sm tabular-nums text-(--text-secondary)">CNPJ {company.cnpj ?? "não informado"}</p>
                </div>
                <span className="shrink-0 rounded-full bg-(--surface-muted) px-3 py-1 text-xs font-medium tabular-nums text-(--foreground)">{company.leadCount} {company.leadCount === 1 ? "lead" : "leads"}</span>
              </LiteListItem>
            ))}
          </LiteList>
        ) : (
          <EmptyState
            label="Lista de empresas vazia"
            icon={<AssistantAvatar shape="logo" hue={null} size={56} />}
            title={query.trim() ? `Nenhum resultado para "${query.trim()}"` : "Nenhuma empresa ainda"}
            description={query.trim() ? "Tente outro nome ou CNPJ." : "As empresas aparecem aqui quando um lead PJ é cadastrado na sua unidade."}
          />
        )}
      </div>
    </LitePageEnter>
  );
}
