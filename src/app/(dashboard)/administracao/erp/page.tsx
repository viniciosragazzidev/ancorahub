import Link from "next/link";
import { DashboardHeader } from "@/components/dashboard-header";
import { getErpGovernance } from "@/features/erp/governance";
import { ErpModuleForm } from "@/features/erp/components/governance-forms";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import page from "@/components/lite/page/lite-page.module.css";

export default async function ErpGovernancePage() {
  const workspace = await getErpGovernance();
  return <><DashboardHeader breadcrumb="Administração" title="ERP operacional" /><main className={page.stack}>
    <section className={page.group}><h2 className={page.sectionTitle}>Disponibilidade e acesso</h2><p className="text-sm text-muted-foreground">Escolha os módulos da empresa e os perfis que poderão usá-los. Valores financeiros exigem conferência e aprovação de outra pessoa.</p>{!workspace.platform.enabled ? <p role="status" className="text-sm text-muted-foreground">O ERP está desativado globalmente. Você pode preparar as configurações e solicitar a liberação ao Super-admin.</p> : null}</section>
    <div className="grid gap-4 lg:grid-cols-2">{workspace.modules.map((module) => <ErpModuleForm key={module.key} module={module} />)}</div>
    <Card><CardHeader><CardTitle>Alterações recentes</CardTitle></CardHeader><CardContent>{workspace.events.length ? <ul className={page.group}>{workspace.events.map((event) => <li key={event.id} className="text-sm"><span className="font-medium">{workspace.modules.find((module) => module.key === event.entityId)?.label ?? "Módulo"}</span> · {event.actor ?? "Responsável registrado"} · {event.createdAt.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}</li>)}</ul> : <p className="text-sm text-muted-foreground">Nenhuma configuração alterada nesta empresa.</p>}</CardContent></Card>
    <Link href="/dashboard" className={page.cellLink}>Voltar ao início</Link>
  </main></>;
}
