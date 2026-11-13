import Link from "next/link";
import { Button } from "@/components/ui/button";
import { getReferrals } from "@/features/erp/referrals";
import { ReferralsWorkspace } from "@/features/erp/components/referrals-workspace";
import { ErpHeaderActions, ErpHelp, ErpPrimaryAction, ErpSearch, ErpToolbar, ErpUrlFilter } from "@/features/erp/ui/erp-kit";
import { ErpPage } from "@/features/erp/ui/erp-page";

type SearchParams = { q?: string; status?: string; page?: string; id?: string };

export default async function ReferralsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const workspace = await getReferrals(await searchParams);
  const { filters } = workspace;
  const actions = <ErpHeaderActions>
    <ErpHelp title="Como funciona: Indicações">
      <p>Cada indicação guarda quem indicou, o canal, o responsável e o andamento até virar negócio no CRM.</p>
      <p>O contato só começa com o consentimento registrado, e o sistema confere se o contato já existe antes de salvar.</p>
      <p>A indicação não cria negócios sozinha: crie o negócio em Leads e vincule aqui. A conversão exige o negócio convertido ou com venda ativa.</p>
      <p>Atribuição e premiação ainda dependem de regra aprovada pela direção.</p>
    </ErpHelp>
    {workspace.canManage ? <ErpPrimaryAction label="Nova indicação" /> : null}
  </ErpHeaderActions>;
  const toolbar = <ErpToolbar>
    <ErpSearch label="Buscar indicação" placeholder="Buscar por nome ou telefone" value={filters.q} />
    <ErpUrlFilter label="Etapa da indicação" param="status" value={filters.status} defaultValue="all"
      options={[{ value: "all", label: "Todas as etapas" }, ...workspace.statusOptions]} />
    {filters.id ? <Button variant="ghost" render={<Link href="/indicacoes" />}>Ver todas</Button> : null}
  </ErpToolbar>;
  return <ErpPage pathname="/indicacoes" breadcrumb="Operação" title="Indicações" actions={actions}>
    <ReferralsWorkspace key={`${filters.id ?? ""}-${filters.page}`} workspace={workspace} toolbar={toolbar} />
  </ErpPage>;
}
