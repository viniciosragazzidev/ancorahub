import { notFound } from "next/navigation";
import Link from "next/link";

import { DashboardHeader } from "@/components/dashboard-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { UserAvatar } from "@/components/ui/user-avatar";
import { ArrowLeft, Clock, FileText, UserList } from "@/components/huge-icons";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getSaleById, getCommissionSchedule } from "@/features/sales/queries";
import { formatCurrency } from "@/features/quotes/utils";
import { SaleDetailsTabs } from "./sale-details-tabs";
import { SaleStatsCards } from "./sale-stats-cards";

export default async function SaleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const context = await getRequiredTenantContext();

  const [sale, schedule] = await Promise.all([
    getSaleById(id),
    getCommissionSchedule(id),
  ]);

  if (!sale) notFound();

  const totalCommissions = schedule.reduce((sum, item) => sum + Number(item.amount), 0);
  const paidCommissions = schedule
    .filter((item) => item.status === "paid")
    .reduce((sum, item) => sum + Number(item.amount), 0);
  const pendingCommissions = schedule
    .filter((item) => item.status === "pending")
    .reduce((sum, item) => sum + Number(item.amount), 0);

  const paidPercentage = totalCommissions > 0 ? Math.round((paidCommissions / totalCommissions) * 100) : 0;
  const paidCount = schedule.filter((i) => i.status === "paid").length;
  const pendingCount = schedule.filter((i) => i.status === "pending").length;
  const initials = sale.leadName
    ? sale.leadName
        .split(" ")
        .map((n) => n[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : "VD";

  return (
    <>
      <DashboardHeader breadcrumb="Operação comercial / Vendas" title="Detalhes da Venda" />
      <main className="flex min-h-full flex-col gap-6 bg-background p-4 lg:p-6">
        {/* Hero Header Card */}
        <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-5 shadow-sm transition-all sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <UserAvatar seed={sale.clientName ?? sale.id} name={sale.clientName ?? "Venda"} size="lg" className="size-12 rounded-xl" />
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-primary">
                  Venda #{sale.id.slice(0, 8)}
                </span>
                <Badge variant={sale.status === "active" ? "success" : "outline"} className="text-xs px-2 py-0.5">
                  {sale.status === "active" ? "Ativa" : "Cancelada"}
                </Badge>
              </div>
              <h1 className="mt-0.5 text-xl sm:text-2xl font-semibold tracking-tight text-foreground">
                {sale.leadName}
              </h1>
              <p className="mt-0.5 text-xs sm:text-sm text-muted-foreground flex items-center gap-1.5">
                <Clock className="size-3.5 text-muted-foreground" />
                Registrada em {new Intl.DateTimeFormat("pt-BR").format(new Date(sale.saleDate))}
                {sale.branchName && (
                  <>
                    <span>•</span>
                    <span>{sale.branchName}</span>
                  </>
                )}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-border">
            <Button size="sm" variant="outline" render={<Link href={`/leads/${sale.leadId}`} />} className="gap-1.5 text-xs">
              <FileText className="size-3.5" /> Ver lead
            </Button>
            {sale.clientName && (
              <Button size="sm" variant="outline" render={<Link href={`/clientes`} />} className="gap-1.5 text-xs">
                <UserList className="size-3.5" /> Ver cliente
              </Button>
            )}
            <Button size="sm" variant="ghost" render={<Link href="/vendas" />} className="gap-1.5 text-xs text-muted-foreground">
              <ArrowLeft className="size-3.5" /> Voltar
            </Button>
          </div>
        </div>

        {/* Summary KPI Cards + Progress */}
        <SaleStatsCards
          saleValue={formatCurrency(Number(sale.saleValue))}
          totalCommissions={totalCommissions}
          paidCommissions={paidCommissions}
          pendingCommissions={pendingCommissions}
          paidPercentage={paidPercentage}
          scheduleLength={schedule.length}
          paidCount={paidCount}
          pendingCount={pendingCount}
        />

        {/* Main Details & Schedule Tabs */}
        <SaleDetailsTabs
          sale={{
            ...sale,
            saleValue: String(sale.saleValue),
          }}
          schedule={schedule.map((item) => ({
            ...item,
            dueDate: item.dueDate?.toISOString() ?? null,
            paidAt: item.paidAt?.toISOString() ?? null,
          }))}
          canManage={context.role === "director"}
        />
      </main>
    </>
  );
}


