import Link from "next/link";
import { DashboardHeader } from "@/components/dashboard-header";
import { Input } from "@/components/ui/input";
import { AppSelect } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { getImplantations } from "@/features/erp/implantations";
import { IMPLANTATION_LABELS, IMPLANTATION_STATUSES } from "@/features/erp/contracts";
import { ImplantationsWorkspace } from "@/features/erp/components/implantations-workspace";
import page from "@/components/lite/page/lite-page.module.css";

export default async function ImplantationsPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string; page?: string }> }) {
  const params = await searchParams;
  const workspace = await getImplantations(params);
  const target = (number: number) => `/implantacoes?${new URLSearchParams({ q: workspace.filters.q, status: workspace.filters.status, page: String(number) })}`;
  return <><DashboardHeader breadcrumb="Operação" title="Implantação" /><main className={page.stack}>
    <p className="text-sm text-muted-foreground">Da conferência à cobertura ativa. A implantação não comprova pagamento de mensalidade, recebimento de comissão ou repasse.</p>
    <form action="/implantacoes" className={page.toolbar} aria-label="Filtrar implantações"><Input name="q" aria-label="Buscar negócio, protocolo ou apólice" defaultValue={workspace.filters.q} placeholder="Buscar negócio, protocolo ou apólice" maxLength={100} /><AppSelect name="status" aria-label="Etapa de implantação" defaultValue={workspace.filters.status} options={[{ value: "all", label: "Todas as etapas" }, ...IMPLANTATION_STATUSES.map((status) => ({ value: status, label: IMPLANTATION_LABELS[status] }))]} /><Button type="submit" variant="outline">Filtrar</Button></form>
    <ImplantationsWorkspace workspace={workspace} />
    <nav aria-label="Paginação de implantações" className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm text-muted-foreground">{workspace.total} negócio(s) · página {workspace.filters.page}</p><div className="flex gap-2">{workspace.filters.page > 1 ? <Button variant="outline" render={<Link href={target(workspace.filters.page - 1)} />}>Anterior</Button> : null}{workspace.filters.page * 25 < workspace.total ? <Button variant="outline" render={<Link href={target(workspace.filters.page + 1)} />}>Próxima</Button> : null}</div></nav>
  </main></>;
}
