import Link from "next/link";
import { DashboardHeader } from "@/components/dashboard-header";
import { Input } from "@/components/ui/input";
import { AppSelect } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { getReferrals } from "@/features/erp/referrals";
import { NewReferralButton, ReferralsWorkspace } from "@/features/erp/components/referrals-workspace";
import page from "@/components/lite/page/lite-page.module.css";

export default async function ReferralsPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string; page?: string; id?: string }> }) {
  const workspace = await getReferrals(await searchParams);
  const { filters } = workspace;
  const target = (number: number) => `/indicacoes?${new URLSearchParams({ q: filters.q, status: filters.status, page: String(number) })}`;
  return <><DashboardHeader breadcrumb="Comercial" title="Indicações" /><main className={page.stack}>
    <p className="text-sm text-muted-foreground">Origem, responsável e andamento de cada indicação. Atribuição e premiação ainda dependem de regra aprovada.</p>
    <div className={page.toolbar}>
      <form action="/indicacoes" className={page.toolbar} aria-label="Filtrar indicações"><Input name="q" aria-label="Buscar por nome ou telefone" defaultValue={filters.q} placeholder="Buscar por nome ou telefone" maxLength={100} /><AppSelect name="status" aria-label="Etapa da indicação" defaultValue={filters.status} options={[{ value: "all", label: "Todas as etapas" }, ...workspace.statusOptions]} /><Button type="submit" variant="outline">Filtrar</Button>{filters.id ? <Button variant="outline" render={<Link href="/indicacoes" />}>Ver todas</Button> : null}</form>
      <NewReferralButton workspace={workspace} />
    </div>
    <ReferralsWorkspace key={`${filters.id ?? ""}-${filters.page}`} workspace={workspace} />
    <nav aria-label="Paginação de indicações" className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm text-muted-foreground">{workspace.total} indicação(ões) · página {filters.page}</p><div className="flex gap-2">{filters.page > 1 ? <Button variant="outline" render={<Link href={target(filters.page - 1)} />}>Anterior</Button> : null}{filters.page * workspace.pageSize < workspace.total ? <Button variant="outline" render={<Link href={target(filters.page + 1)} />}>Próxima</Button> : null}</div></nav>
  </main></>;
}
