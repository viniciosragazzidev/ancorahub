"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { toast } from "@/components/ui/sonner";
import {
  ArrowRight,
  ArrowsDownUp,
  Calculator,
  MagnifyingGlass,
  TrendUp,
  X,
  SlidersHorizontal,
  FileArrowDown,
} from "@/components/huge-icons";
import { EmptyState } from "@/components/empty-state";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { StatCard } from "@/components/dashboard/metric-card";
import { ScheduleStatusBadge } from "@/components/status-badges";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DataTableFrame } from "@/components/ui/data-table/data-table-frame";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { formatCurrency, formatCurrencyCompact, normalize } from "@/features/quotes/utils";
import type { CommissionDetailsData } from "@/features/financeiro/queries/commission-details";
import { monthlyCounts, monthlySums } from "@/shared/trends";

type Props = {
  data: CommissionDetailsData;
  role?: string;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(date: Date | string): string {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(
    new Date(date),
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function CommissionDetails({ data }: Props) {
  const { summary, byBroker, bySale } = data;

  const [search, setSearch] = useState("");
  const [view, setView] = useState<"brokers" | "sales">("sales");
  const [scheduleFilter, setScheduleFilter] = useState<"all" | "pending" | "paid">("all");
  const [drawerOpen, setDrawerOpen] = useState(false);

  const normalizedQuery = normalize(search.trim());

  // Filter sales
  const visibleSales = useMemo(() => {
    return bySale.filter((sale) => {
      const matchesSearch =
        !normalizedQuery ||
        normalize(sale.leadName).includes(normalizedQuery) ||
        normalize(sale.brokerName ?? "").includes(normalizedQuery) ||
        normalize(sale.planName ?? "").includes(normalizedQuery) ||
        normalize(sale.carrierName ?? "").includes(normalizedQuery) ||
        normalize(sale.ruleName ?? "").includes(normalizedQuery);
      const hasMatchingSchedule =
        scheduleFilter === "all" ||
        sale.scheduleItems.some((item) => item.status === scheduleFilter);
      return matchesSearch && hasMatchingSchedule;
    });
  }, [bySale, normalizedQuery, scheduleFilter]);

  // Filter brokers
  const visibleBrokers = useMemo(() => {
    return byBroker.filter((broker) => {
      return (
        !normalizedQuery ||
        normalize(broker.brokerName ?? "").includes(normalizedQuery)
      );
    });
  }, [byBroker, normalizedQuery]);

  // Monthly trends for the summary cards (últimos 6 meses)
  const commissionTrend = useMemo(() => {
    const totalEntries = bySale.map((sale) => ({
      date: sale.saleDate,
      value: sale.scheduleItems.reduce((sum, item) => sum + Number(item.amount), 0),
    }));
    const paidEntries = bySale.flatMap((sale) =>
      sale.scheduleItems
        .filter((item) => item.status === "paid" && item.paidAt)
        .map((item) => ({ date: item.paidAt as Date, value: Number(item.amount) })),
    );
    const pendingEntries = bySale.flatMap((sale) =>
      sale.scheduleItems
        .filter((item) => item.status === "pending" && item.dueDate)
        .map((item) => ({ date: item.dueDate as Date, value: Number(item.amount) })),
    );
    return {
      total: monthlySums(totalEntries),
      paid: monthlySums(paidEntries),
      pending: monthlySums(pendingEntries),
      sales: monthlyCounts(bySale.map((sale) => sale.saleDate)),
    };
  }, [bySale]);

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total de comissões" value={formatCurrencyCompact(summary.totalCommission)} icon={TrendUp} sparklineData={commissionTrend.total} sparklineColor="var(--chart-1)" animated />
        <StatCard label="Comissões pendentes" value={formatCurrencyCompact(summary.pendingCommission)} icon={ArrowsDownUp} sparklineData={commissionTrend.pending} sparklineColor="var(--chart-4)" animated animationDelay={0.06} />
        <StatCard label="Comissões pagas" value={formatCurrencyCompact(summary.paidCommission)} icon={Calculator} sparklineData={commissionTrend.paid} sparklineColor="var(--chart-2)" animated animationDelay={0.12} />
        <StatCard label="Vendas / Regras ativas" value={`${summary.totalSales} / ${summary.activeRules}`} icon={Calculator} sparklineData={commissionTrend.sales} sparklineColor="var(--chart-3)" animated animationDelay={0.18} />
      </section>

      {/* Action Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center justify-between">
        <div className="relative flex-1 sm:max-w-xs">
          <MagnifyingGlass className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
            placeholder={
              view === "sales"
                ? "Buscar por lead, corretor, plano..."
                : "Buscar por corretor..."
            }
            aria-label="Buscar"
          />
        </div>
        
        <Popover open={drawerOpen} onOpenChange={setDrawerOpen}>
          <PopoverTrigger render={<Button variant="outline" size="sm" className="h-9 gap-2 text-xs font-medium" />}>
            <SlidersHorizontal className="size-4" />
            Filtros e Ações
          </PopoverTrigger>

          <PopoverContent align="end" side="bottom" sideOffset={8} className="w-80 p-0 rounded-2xl border border-border/80 bg-card shadow-2xl backdrop-blur-2xl">
            <div className="flex items-center justify-between border-b border-border/70 p-3.5">
              <div className="flex items-center gap-2">
                <div className="flex size-7 items-center justify-center rounded-lg border border-border/60 bg-muted/40">
                  <SlidersHorizontal className="size-3.5 text-foreground" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-foreground">Filtros e Ações</h3>
                  <p className="text-[11px] text-muted-foreground">Refine e exporte relatórios</p>
                </div>
              </div>
            </div>

            <div className="p-4 space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Agrupar visão por</label>
                <Select value={view} onValueChange={(v) => setView(v as "sales" | "brokers")}>
                  <SelectTrigger className="h-8.5 text-xs">
                    <SelectValue placeholder="Selecione o agrupamento" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sales">Por venda</SelectItem>
                    <SelectItem value="brokers">Por corretor</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {view === "sales" && (
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Status da parcela</label>
                  <Select value={scheduleFilter} onValueChange={(v) => setScheduleFilter(v as "all" | "pending" | "paid")}>
                    <SelectTrigger className="h-8.5 text-xs">
                      <SelectValue placeholder="Filtre por status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas as parcelas</SelectItem>
                      <SelectItem value="pending">Pendentes</SelectItem>
                      <SelectItem value="paid">Pagas</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="pt-2 border-t border-border/60">
                <Button 
                  variant="outline" 
                  size="sm"
                  className="w-full h-9 text-xs font-medium justify-start gap-2 shadow-xs group"
                  onClick={() => {
                    toast.success("Exportação iniciada, o download começará em breve.");
                    setDrawerOpen(false);
                  }}
                >
                  <FileArrowDown className="size-4 text-muted-foreground transition-transform group-hover:scale-110" />
                  Exportar Relatório (.csv)
                </Button>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {/* Broker Summary Table */}
      {view === "brokers" && (
        <>
          {visibleBrokers.length === 0 ? (
            <EmptyState
              title="Nenhum corretor encontrado"
              description="Ajuste a busca para ver outros resultados."
            />
          ) : (
            <Card className="border-transparent bg-transparent shadow-none">
              <CardHeader>
                <CardTitle>Comissões por Corretor</CardTitle>
                <CardDescription>
                  Resumo de comissões agrupado por corretor
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="pl-5">Corretor</TableHead>
                      <TableHead>Filial</TableHead>
                      <TableHead className="text-right">Vendas</TableHead>
                      <TableHead className="text-right">Valor vendido</TableHead>
                      <TableHead className="text-right">Total comissão</TableHead>
                      <TableHead className="text-right">Pendente</TableHead>
                      <TableHead className="pr-5 text-right">Pago</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visibleBrokers.map((broker) => (
                      <TableRow key={broker.brokerId}>
                        <TableCell className="pl-5 font-medium">
                          {broker.brokerName ?? "—"}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {broker.branchName ?? "—"}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {broker.totalSales}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm tabular-nums">
                          {formatCurrency(broker.totalSaleValue)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm font-medium tabular-nums">
                          {formatCurrency(broker.totalCommission)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm tabular-nums text-amber-600 dark:text-amber-400">
                          {formatCurrency(broker.pendingCommission)}
                        </TableCell>
                        <TableCell className="pr-5 text-right font-mono text-sm tabular-nums text-emerald-600 dark:text-emerald-400">
                          {formatCurrency(broker.paidCommission)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Sales Detail View */}
      {view === "sales" && (
        <>
          {bySale.length === 0 ? (
            <EmptyState
              title="Nenhuma venda registrada"
              description="As vendas aparecerão aqui quando leads forem convertidos."
            />
          ) : visibleSales.length === 0 ? (
            <EmptyState
              title="Nenhum resultado"
              description="Ajuste a busca ou o filtro."
              action={
                <Button
                  variant="outline"
                  onClick={() => {
                    setSearch("");
                    setScheduleFilter("all");
                  }}
                >
                  Limpar filtros
                </Button>
              }
            />
          ) : (
            <div className="space-y-4">
              {visibleSales.map((sale, i) => (
                <motion.div
                  key={sale.saleId}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    duration: 0.15,
                    ease: [0, 0, 0.2, 1],
                    delay: Math.min(i * 0.04, 0.3),
                  }}
                >
                  <Card className="border-transparent bg-transparent shadow-none transition-all duration-200 hover:border-primary/25">
                    <CardContent className="p-0">
                      {/* Sale Header */}
                      <div className="flex items-center justify-between gap-4 border-b border-border p-4 sm:px-5">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Link
                              href={`/vendas/${sale.saleId}`}
                              className="text-sm font-semibold text-foreground hover:text-primary transition-colors"
                            >
                              {sale.leadName}
                            </Link>
                            <Badge
                              variant={
                                sale.status === "active" ? "success" : "outline"
                              }
                              className="rounded-md text-xs"
                            >
                              {sale.status === "active" ? "Ativa" : "Cancelada"}
                            </Badge>
                          </div>
                          <div className="mt-0.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                            <span>
                              Corretor: <strong>{sale.brokerName ?? "—"}</strong>
                            </span>
                            {sale.branchName && (
                              <span>Filial: <strong>{sale.branchName}</strong></span>
                            )}
                            {sale.carrierName && (
                              <span>
                                Operadora: <strong>{sale.carrierName}</strong>
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="font-mono text-lg font-semibold tabular-nums">
                            {formatCurrency(sale.saleValue)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatDate(sale.saleDate)}
                          </p>
                        </div>
                      </div>

                      {/* Schedule Items */}
                      {sale.scheduleItems.length > 0 ? (
                        <DataTableFrame density="compact" className="rounded-none border-x-0 border-b-0">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="pl-5 text-[10px] uppercase tracking-wider">
                                  Parcela
                                </TableHead>
                                <TableHead className="text-[10px] uppercase tracking-wider">
                                  Mês ref.
                                </TableHead>
                                <TableHead className="text-[10px] uppercase tracking-wider">
                                  Vencimento
                                </TableHead>
                                <TableHead className="text-right text-[10px] uppercase tracking-wider">
                                  %
                                </TableHead>
                                <TableHead className="text-right text-[10px] uppercase tracking-wider">
                                  Valor
                                </TableHead>
                                <TableHead className="text-center text-[10px] uppercase tracking-wider">
                                  Status
                                </TableHead>
                                <TableHead className="pr-5 text-right text-[10px] uppercase tracking-wider">
                                  Pago em
                                </TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {sale.scheduleItems.map((item) => (
                                <TableRow key={item.id}>
                                  <TableCell className="pl-5 tabular-nums">
                                    {item.monthNumber}ª
                                  </TableCell>
                                  <TableCell className="text-muted-foreground">
                                    {item.referenceMonth}
                                  </TableCell>
                                  <TableCell className="text-muted-foreground tabular-nums">
                                    {item.dueDate
                                      ? formatDate(item.dueDate)
                                      : "—"}
                                  </TableCell>
                                  <TableCell className="text-right tabular-nums text-muted-foreground">
                                    {item.percentage}%
                                  </TableCell>
                                  <TableCell className="text-right font-mono text-sm font-medium tabular-nums">
                                    {formatCurrency(item.amount)}
                                  </TableCell>
                                  <TableCell className="text-center">
                                    <ScheduleStatusBadge status={item.status} />
                                  </TableCell>
                                  <TableCell className="pr-5 text-right text-xs text-muted-foreground tabular-nums">
                                    {item.paidAt
                                      ? `${formatDate(item.paidAt)}${item.paidByName ? ` · ${item.paidByName}` : ""}`
                                      : "—"}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </DataTableFrame>
                      ) : (
                        <div className="px-5 py-4 text-center text-xs text-muted-foreground">
                          Nenhuma parcela de comissão gerada para esta venda.
                        </div>
                      )}

                      {/* Sale Footer - totals */}
                      <div className="border-t border-border/60 bg-muted/10 px-5 py-2.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">
                            {sale.ruleName
                              ? `Regra: ${sale.ruleName}`
                              : "Sem regra de comissão"}
                            {sale.planName && ` · Plano: ${sale.planName}`}
                          </span>
                          <Link
                            href={`/vendas/${sale.saleId}`}
                            className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
                          >
                            Detalhes
                            <ArrowRight className="size-3" />
                          </Link>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
