"use client";

import React from "react";
import {
  CalendarBlank,
  FileText,
  ListChecks,
  Users,
  Buildings,
  Target,
  CheckCircle,
  Clock,
  ShieldCheck,
  Handshake,
} from "@/components/huge-icons";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CommissionScheduleTable } from "./commission-schedule-table";

type ScheduleItem = {
  id: string;
  saleId: string;
  monthNumber: number;
  referenceMonth: string;
  dueDate: string | null;
  percentage: string;
  amount: string;
  status: "pending" | "paid" | "cancelled" | "chargeback_pending";
  paidAt: string | null;
  paidBy: string | null;
  paidByName: string | null;
  notes: string | null;
};

type SaleDetailProps = {
  sale: {
    id: string;
    leadId: string;
    leadName: string;
    clientName: string | null;
    brokerName: string | null;
    branchName: string | null;
    planName: string | null;
    carrierName: string | null;
    ruleName: string | null;
    status: string;
    saleDate: Date;
    saleValue: string;
    notes: string | null;
  };
  schedule: ScheduleItem[];
  canManage: boolean;
};

export function SaleDetailsTabs({ sale, schedule, canManage }: SaleDetailProps) {
  const pendingCount = schedule.filter((i) => i.status === "pending").length;
  const paidCount = schedule.filter((i) => i.status === "paid").length;

  return (
    <Tabs defaultValue="schedule" className="w-full space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-border pb-3">
        <TabsList variant="line" className="h-10 p-0 bg-transparent">
          <TabsTrigger value="schedule" className="gap-2 px-4 py-2 text-sm">
            <CalendarBlank className="size-4" />
            Cronograma de Repasse
            <Badge variant="secondary" className="ml-1 px-1.5 py-0.5 text-xs font-mono">
              {schedule.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="info" className="gap-2 px-4 py-2 text-sm">
            <FileText className="size-4" />
            Dados do Contrato
          </TabsTrigger>
          {sale.notes && (
            <TabsTrigger value="notes" className="gap-2 px-4 py-2 text-sm">
              <ListChecks className="size-4" />
              Observações
            </TabsTrigger>
          )}
        </TabsList>

        <div className="flex items-center gap-2 text-xs text-muted-foreground self-end sm:self-center">
          <span className="inline-flex items-center gap-1.5 font-medium">
            <span className="size-2 rounded-full bg-emerald-500" />
            {paidCount} pagas
          </span>
          <span>•</span>
          <span className="inline-flex items-center gap-1.5 font-medium">
            <span className="size-2 rounded-full bg-amber-500" />
            {pendingCount} pendentes
          </span>
        </div>
      </div>

      {/* Tab 1: Schedule Table */}
      <TabsContent value="schedule" className="space-y-4 m-0 focus-visible:outline-none">
        <Card className="border-border bg-card shadow-xs transition-all">
          <CardHeader className="border-b border-border/50 pb-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <CardTitle className="text-base font-semibold">Cronograma de Repasse de Comissão</CardTitle>
                <CardDescription className="text-xs text-muted-foreground mt-0.5">
                  Parcelas calculadas e vinculadas às regras ativas da corretora.
                </CardDescription>
              </div>
              <Badge variant="outline" className="w-fit text-xs font-mono">
                {schedule.length} parcelas registradas
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <CommissionScheduleTable schedule={schedule} canManage={canManage} />
          </CardContent>
        </Card>
      </TabsContent>

      {/* Tab 2: Contract Info */}
      <TabsContent value="info" className="space-y-6 m-0 focus-visible:outline-none">
        <div className="grid gap-6 md:grid-cols-2">
          {/* Card 1: Participantes */}
          <Card className="border-border bg-card shadow-xs">
            <CardHeader className="border-b border-border/40 pb-3">
              <div className="flex items-center gap-2 text-primary">
                <Users className="size-5" />
                <CardTitle className="text-base">Envolvidos na Venda</CardTitle>
              </div>
              <CardDescription className="text-xs">Identificação de clientes e responsáveis</CardDescription>
            </CardHeader>
            <CardContent className="p-4 space-y-3.5 text-sm">
              <DetailItem label="Lead de Origem" icon={<Target className="size-4 text-muted-foreground" />}>
                <span className="font-medium text-foreground">{sale.leadName}</span>
              </DetailItem>
              <DetailItem label="Cliente Cadastrado" icon={<Users className="size-4 text-muted-foreground" />}>
                <span className="font-medium text-foreground">{sale.clientName ?? "Não associado"}</span>
              </DetailItem>
              <DetailItem label="Corretor Responsável" icon={<Users className="size-4 text-muted-foreground" />}>
                <span className="font-medium text-foreground">{sale.brokerName ?? "—"}</span>
              </DetailItem>
              <DetailItem label="Unidade / Filial" icon={<Buildings className="size-4 text-muted-foreground" />}>
                <span className="font-medium text-foreground">{sale.branchName ?? "—"}</span>
              </DetailItem>
            </CardContent>
          </Card>

          {/* Card 2: Produto e Regra */}
          <Card className="border-border bg-card shadow-xs">
            <CardHeader className="border-b border-border/40 pb-3">
              <div className="flex items-center gap-2 text-primary">
                <Handshake className="size-5" />
                <CardTitle className="text-base">Produto & Comissionamento</CardTitle>
              </div>
              <CardDescription className="text-xs">Regras e especificações do produto vendido</CardDescription>
            </CardHeader>
            <CardContent className="p-4 space-y-3.5 text-sm">
              <DetailItem label="Plano de Saúde / Odonto">
                <span className="font-medium text-foreground">
                  {sale.planName ? `${sale.planName}${sale.carrierName ? ` (${sale.carrierName})` : ""}` : "—"}
                </span>
              </DetailItem>
              <DetailItem label="Operadora">
                <span className="font-medium text-foreground">{sale.carrierName ?? "—"}</span>
              </DetailItem>
              <DetailItem label="Regra de Comissão">
                <Badge variant="secondary" className="font-mono text-xs">
                  {sale.ruleName ?? "Padrão (100% parcela única)"}
                </Badge>
              </DetailItem>
              <DetailItem label="Status do Contrato">
                <Badge variant={sale.status === "active" ? "success" : "outline"}>
                  {sale.status === "active" ? "Ativo" : "Cancelado"}
                </Badge>
              </DetailItem>
            </CardContent>
          </Card>
        </div>
      </TabsContent>

      {/* Tab 3: Notes if present */}
      {sale.notes && (
        <TabsContent value="notes" className="space-y-4 m-0 focus-visible:outline-none">
          <Card className="border-border bg-card shadow-xs">
            <CardHeader className="border-b border-border/40 pb-3">
              <div className="flex items-center gap-2 text-primary">
                <ListChecks className="size-5" />
                <CardTitle className="text-base">Observações & Anotações</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-5">
              <p className="text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed">{sale.notes}</p>
            </CardContent>
          </Card>
        </TabsContent>
      )}
    </Tabs>
  );
}

function DetailItem({
  label,
  children,
  icon,
}: {
  label: string;
  children: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-1 border-b border-border/30 last:border-0">
      <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium">
        {icon}
        <span>{label}</span>
      </div>
      <div className="text-right text-xs sm:text-sm">{children}</div>
    </div>
  );
}
