"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Calendar,
  Users,
  Download,
  Search,
  TrendingUp,
  Clock,
  UserCheck,
  UserX,
  Flame,
  CheckCircle2,
  Filter,
  ArrowUpRight,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { AvailabilityToggle } from "@/components/availability-toggle";
import { getBrokerDailySummaryAction } from "@/features/lead-distribution/broker-summary-actions";
import type { BrokerDailySummaryAggregate, BrokerDailySummaryItem } from "@/features/lead-distribution/broker-summary-service";

type BranchOption = { id: string; name: string };

export function BrokerDailySummaryPanel({
  initialData,
  branches,
  canFilterBranch = true,
}: {
  initialData: BrokerDailySummaryAggregate;
  branches: BranchOption[];
  canFilterBranch?: boolean;
}) {
  const [data, setData] = useState<BrokerDailySummaryAggregate>(initialData);
  const [period, setPeriod] = useState<"today" | "week" | "month" | "custom">("today");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedBranchId, setSelectedBranchId] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const fetchSummary = async (
    newPeriod = period,
    newBranch = selectedBranchId,
    start = startDate,
    end = endDate,
  ) => {
    setIsLoading(true);
    try {
      const res = await getBrokerDailySummaryAction({
        period: newPeriod,
        startDate: start || undefined,
        endDate: end || undefined,
        branchId: newBranch === "all" ? null : newBranch,
      });
      setData(res);
    } catch {
      toast.error("Erro ao carregar dados do resumo de desempenho.");
    } finally {
      setIsLoading(false);
    }
  };

  const handlePeriodChange = (newPeriod: "today" | "week" | "month" | "custom") => {
    setPeriod(newPeriod);
    if (newPeriod !== "custom") {
      fetchSummary(newPeriod, selectedBranchId);
    }
  };

  const handleBranchChange = (branchId: string) => {
    setSelectedBranchId(branchId);
    fetchSummary(period, branchId);
  };

  const handleCustomDateSubmit = () => {
    if (!startDate) {
      toast.error("Selecione a data inicial");
      return;
    }
    fetchSummary("custom", selectedBranchId, startDate, endDate);
  };

  const handleExportCSV = () => {
    if (!data.items.length) {
      toast.info("Nenhum dado disponível para exportar.");
      return;
    }

    const headers = [
      "Corretor",
      "Email",
      "Filial",
      "Status Disponibilidade",
      "Leads Recebidos",
      "Em Atendimento",
      "Não Iniciados",
      "Perdidos",
      "Vendas Fechadas",
      "Taxa Conversao (%)",
      "Tempo Medio Resposta (min)",
    ];

    const rows = data.items.map((item) => [
      `"${item.brokerName.replace(/"/g, '""')}"`,
      `"${item.brokerEmail}"`,
      `"${item.branchName || "N/A"}"`,
      `"${item.availabilityStatus}"`,
      item.leadsReceived,
      item.activeAttending,
      item.unstartedLeads,
      item.lostLeads,
      item.convertedLeads,
      `${item.conversionRate}%`,
      item.avgFirstContactMinutes !== null ? item.avgFirstContactMinutes : "N/A",
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `resumo_desempenho_corretores_${period}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Relatório CSV baixado com sucesso!");
  };

  const filteredItems = data.items.filter((item) => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      item.brokerName.toLowerCase().includes(q) ||
      item.brokerEmail.toLowerCase().includes(q) ||
      (item.branchName ?? "").toLowerCase().includes(q)
    );
  });

  const getStatusBadge = (status: string) => {
    if (status === "available") return <Badge variant="success">Disponível</Badge>;
    if (status === "busy") return <Badge variant="warning">Em Atendimento</Badge>;
    if (status === "break") return <Badge variant="outline">Pausa</Badge>;
    return <Badge variant="outline" className="opacity-60">Offline</Badge>;
  };

  return (
    <div className="space-y-6">
      {/* FILTER BAR & PERIOD SELECTOR */}
      <Card variant="overview" className="p-4 sm:p-6 space-y-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            <div>
              <h3 className="font-semibold text-base">Resumo de Desempenho dos Corretores</h3>
              <p className="text-xs text-muted-foreground">
                Acompanhe o volume de leads recebidos, perdas, atendimento ativo e conversão por período.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Period Buttons */}
            <div className="flex items-center gap-1 rounded-lg border p-1 bg-muted/20">
              <Button
                size="xs"
                variant={period === "today" ? "primary" : "ghost"}
                onClick={() => handlePeriodChange("today")}
                disabled={isLoading}
              >
                Hoje
              </Button>
              <Button
                size="xs"
                variant={period === "week" ? "primary" : "ghost"}
                onClick={() => handlePeriodChange("week")}
                disabled={isLoading}
              >
                Esta Semana
              </Button>
              <Button
                size="xs"
                variant={period === "month" ? "primary" : "ghost"}
                onClick={() => handlePeriodChange("month")}
                disabled={isLoading}
              >
                Este Mês
              </Button>
              <Button
                size="xs"
                variant={period === "custom" ? "primary" : "ghost"}
                onClick={() => handlePeriodChange("custom")}
                disabled={isLoading}
              >
                Personalizado
              </Button>
            </div>

            {/* Export CSV Button */}
            <Button size="xs" variant="outline" onClick={handleExportCSV} className="gap-1.5">
              <Download className="h-3.5 w-3.5" />
              Exportar CSV
            </Button>
          </div>
        </div>

        {/* CUSTOM DATE RANGE SELECTOR */}
        {period === "custom" && (
          <div className="flex flex-wrap items-end gap-3 pt-3 border-t border-border/60">
            <div className="space-y-1">
              <Label className="text-xs">Data Inicial</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Data Final</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="h-8 text-xs"
              />
            </div>
            <Button size="xs" onClick={handleCustomDateSubmit} disabled={isLoading}>
              Filtrar Intervalo
            </Button>
          </div>
        )}

        {/* BRANCH & SEARCH BAR */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pt-2">
          <div className="relative max-w-sm w-full">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Buscar corretor por nome ou e-mail..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 text-xs h-9"
            />
          </div>

          {canFilterBranch && (
            <div className="flex items-center gap-2">
              <Filter className="h-3.5 w-3.5 text-muted-foreground" />
              <Select value={selectedBranchId} onValueChange={handleBranchChange}>
                <SelectTrigger className="w-[200px] h-9 text-xs">
                  <SelectValue placeholder="Todas as Unidades" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as Unidades</SelectItem>
                  {branches.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      </Card>

      {/* KPI METRIC CARDS */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
        <Card variant="overview" className="p-4 space-y-1">
          <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5 text-primary" /> Corretores Ativos
          </p>
          <p className="text-xl font-bold tabular-nums">{data.totalBrokers}</p>
        </Card>

        <Card variant="overview" className="p-4 space-y-1">
          <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
            <Flame className="h-3.5 w-3.5 text-blue-500" /> Leads Recebidos
          </p>
          <p className="text-xl font-bold tabular-nums">{data.totalReceived}</p>
        </Card>

        <Card variant="overview" className="p-4 space-y-1">
          <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
            <UserCheck className="h-3.5 w-3.5 text-emerald-500" /> Em Atendimento
          </p>
          <p className="text-xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">{data.totalActive}</p>
          {data.totalUnstarted > 0 && (
            <p className="text-[10px] text-amber-500 font-semibold">{data.totalUnstarted} sem 1º contato</p>
          )}
        </Card>

        <Card variant="overview" className="p-4 space-y-1">
          <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
            <UserX className="h-3.5 w-3.5 text-rose-500" /> Leads Perdidos
          </p>
          <p className="text-xl font-bold tabular-nums text-rose-600 dark:text-rose-400">{data.totalLost}</p>
        </Card>

        <Card variant="overview" className="p-4 space-y-1">
          <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> Vendas Concluídas
          </p>
          <p className="text-xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">{data.totalConverted}</p>
        </Card>

        <Card variant="overview" className="p-4 space-y-1">
          <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
            <TrendingUp className="h-3.5 w-3.5 text-amber-500" /> Taxa de Conversão
          </p>
          <p className="text-xl font-bold tabular-nums">{data.teamConversionRate}%</p>
          {data.avgTeamResponseMinutes !== null && (
            <p className="text-[10px] text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" /> ~{data.avgTeamResponseMinutes} min resposta
            </p>
          )}
        </Card>
      </div>

      {/* BROKER SUMMARY TABLE */}
      <Card variant="overview" className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-muted/40 border-b border-border text-muted-foreground font-semibold">
              <tr>
                <th className="py-3 px-4">Corretor</th>
                <th className="py-3 px-3">Filial</th>
                <th className="py-3 px-3 text-center">Status</th>
                <th className="py-3 px-3 text-right">Leads Recebidos</th>
                <th className="py-3 px-3 text-right">Em Atendimento</th>
                <th className="py-3 px-3 text-right">Não Iniciados</th>
                <th className="py-3 px-3 text-right">Leads Perdidos</th>
                <th className="py-3 px-3 text-right">Vendas</th>
                <th className="py-3 px-3 text-right">Conversão (%)</th>
                <th className="py-3 px-3 text-right">Tempo Resp.</th>
                <th className="py-3 px-4 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-8 text-center text-muted-foreground">
                    Nenhum corretor encontrado com os filtros selecionados.
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => (
                  <tr key={item.brokerId} className="hover:bg-muted/20 transition-colors">
                    <td className="py-3 px-4 font-medium">
                      <div className="flex flex-col">
                        <span className="font-semibold text-foreground text-sm">{item.brokerName}</span>
                        <span className="text-[11px] text-muted-foreground">{item.brokerEmail}</span>
                      </div>
                    </td>
                    <td className="py-3 px-3 text-muted-foreground">{item.branchName || "Matriz"}</td>
                    <td className="py-3 px-3 text-center">
                      {canFilterBranch ? (
                        <AvailabilityToggle initialStatus={item.availabilityStatus as "available" | "paused" | "offline"} />
                      ) : (
                        getStatusBadge(item.availabilityStatus)
                      )}
                    </td>
                    <td className="py-3 px-3 text-right font-semibold tabular-nums text-sm">{item.leadsReceived}</td>
                    <td className="py-3 px-3 text-right tabular-nums text-emerald-600 dark:text-emerald-400 font-medium">
                      {item.activeAttending}
                    </td>
                    <td className="py-3 px-3 text-right tabular-nums text-amber-500 font-medium">
                      {item.unstartedLeads > 0 ? item.unstartedLeads : "-"}
                    </td>
                    <td className="py-3 px-3 text-right tabular-nums text-rose-600 dark:text-rose-400">
                      {item.lostLeads}
                    </td>
                    <td className="py-3 px-3 text-right tabular-nums font-bold text-emerald-600 dark:text-emerald-400">
                      {item.convertedLeads}
                    </td>
                    <td className="py-3 px-3 text-right tabular-nums font-semibold">
                      {item.conversionRate}%
                    </td>
                    <td className="py-3 px-3 text-right tabular-nums text-muted-foreground">
                      {item.avgFirstContactMinutes !== null ? `${item.avgFirstContactMinutes} min` : "N/A"}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <Button
                        render={
                          <Link
                            href={`/leads?corretor=${item.brokerId}`}
                            className="inline-flex items-center gap-1"
                          />
                        }
                        size="xs"
                        variant="outline"
                      >
                        Leads
                        <ArrowUpRight className="h-3 w-3" />
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
