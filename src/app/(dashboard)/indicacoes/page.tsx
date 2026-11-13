import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getReferrals } from "@/features/erp/referrals";
import { ReferralsWorkspace } from "@/features/erp/components/referrals-workspace";
import { ErpNote, ErpToolbar, ErpUrlFilter } from "@/features/erp/ui/erp-kit";
import { ErpPage } from "@/features/erp/ui/erp-page";

type SearchParams = { q?: string; status?: string; page?: string; id?: string };

export default async function ReferralsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const workspace = await getReferrals(await searchParams);
  const { filters } = workspace;
  return <ErpPage pathname="/indicacoes" breadcrumb="Comercial" title="Indicações">
    <ErpNote>Origem, responsável e andamento de cada indicação. Atribuição e premiação ainda dependem de regra aprovada.</ErpNote>
    <ErpToolbar>
      <form action="/indicacoes" className="flex flex-1 flex-wrap items-center gap-2" aria-label="Buscar indicações">
        {filters.status !== "all" ? <input type="hidden" name="status" value={filters.status} /> : null}
        <Input
          name="q"
          type="search"
          aria-label="Buscar por nome ou telefone"
          defaultValue={filters.q}
          placeholder="Buscar por nome ou telefone"
          maxLength={100}
          className="w-full sm:w-64"
        />
        <Button type="submit" variant="outline">Buscar</Button>
      </form>
      <ErpUrlFilter
        label="Etapa da indicação"
        param="status"
        value={filters.status}
        defaultValue="all"
        options={[{ value: "all", label: "Todas as etapas" }, ...workspace.statusOptions]}
      />
      {filters.id || filters.q ? <Button variant="ghost" render={<Link href="/indicacoes" />}>Ver todas</Button> : null}
    </ErpToolbar>
    <ReferralsWorkspace key={`${filters.id ?? ""}-${filters.page}`} workspace={workspace} />
  </ErpPage>;
}
