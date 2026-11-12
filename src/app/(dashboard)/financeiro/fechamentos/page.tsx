import { DashboardHeader } from "@/components/dashboard-header";
import { getClosings } from "@/features/erp/closing";
import { ClosingsWorkspace } from "@/features/erp/components/finance-controls";
import page from "@/components/lite/page/lite-page.module.css";
export default async function ClosingsPage() { const data = await getClosings(); return <><DashboardHeader breadcrumb="Financeiro" title="Fechamentos" /><main className={page.stack}><p className="text-sm text-muted-foreground">Prepare a memória dos fatos, solicite conferência independente e feche o período. Uma alteração depois da prévia exige nova conferência. A reabertura mantém o retrato anterior no histórico.</p><ClosingsWorkspace data={data} /></main></>; }
