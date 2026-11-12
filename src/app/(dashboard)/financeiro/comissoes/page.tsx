import Link from "next/link";
import { DashboardHeader } from "@/components/dashboard-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getCommissionOverview } from "@/features/erp/commissions";
import { CommissionsTable } from "@/features/erp/components/payout-workspace";
import page from "@/components/lite/page/lite-page.module.css";

export default async function CommissionsPage({ searchParams }: { searchParams: Promise<{ competence?: string; page?: string }> }) {
  const raw = await searchParams; const data = await getCommissionOverview({ competence: raw.competence || undefined, page: raw.page });
  const target = (number: number) => `/financeiro/comissoes?${new URLSearchParams({ ...(data.filters.competence ? { competence: data.filters.competence } : {}), page: String(number) })}`;
  return <><DashboardHeader breadcrumb="Financeiro" title={data.agency ? "Comissões" : "Minhas comissões"} /><main className={page.stack}>
    <p className="text-sm text-muted-foreground">Previsto vem do cronograma da venda. Conferido é o valor aprovado com evidência no ERP. Pago ao corretor é a soma das liquidações e compensações confirmadas. São três fatos diferentes.</p>
    <form action="/financeiro/comissoes" className={page.toolbar} aria-label="Filtrar comissões"><Input type="month" name="competence" aria-label="Competência" defaultValue={data.filters.competence ?? ""} /><Button type="submit" variant="outline">Filtrar</Button></form>
    <CommissionsTable data={data} />
    <nav aria-label="Paginação de comissões" className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm text-muted-foreground">{data.total} parcela(s) · página {data.filters.page}</p><div className="flex gap-2">{data.filters.page > 1 ? <Button variant="outline" render={<Link href={target(data.filters.page - 1)} />}>Anterior</Button> : null}{data.filters.page * 50 < data.total ? <Button variant="outline" render={<Link href={target(data.filters.page + 1)} />}>Próxima</Button> : null}</div></nav>
  </main></>;
}
