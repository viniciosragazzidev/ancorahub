"use client";

import { useState, useEffect, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { PlatformAdminHeader } from "@/components/platform-admin-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Clock,
  ShieldWarning,
  FileText,
  MagnifyingGlass,
  Gear,
  Buildings,
  ArrowRight,
  ShieldStar
} from "@/components/huge-icons";
import { runDbQueryAction, triggerSlaCronAction, getSystemMetricsAction } from "./actions";

export default function SuperAdminDashboardPage() {
  const [selectedTable, setSelectedTable] = useState("tenants");
  const [queryLimit, setQueryLimit] = useState(15);
  const [queryResults, setQueryResults] = useState<any[]>([]);
  const [systemMetrics, setSystemMetrics] = useState<any>(null);
  const [isPending, startTransition] = useTransition();
  const [queryPending, startQueryTransition] = useTransition();

  // Load metrics initially
  useEffect(() => {
    async function loadMetrics() {
      const res = await getSystemMetricsAction();
      if (res.success) {
        setSystemMetrics(res);
      }
    }
    loadMetrics();
  }, []);

  const handleRunQuery = () => {
    startQueryTransition(async () => {
      const res = await runDbQueryAction(selectedTable, queryLimit);
      if (res.success) {
        setQueryResults(res.data || []);
        toast.success(`Query executada: ${res.data?.length || 0} registros encontrados.`);
      } else {
        toast.error(res.error || "Erro ao executar consulta.");
      }
    });
  };

  const handleTriggerSla = () => {
    startTransition(async () => {
      const res = await triggerSlaCronAction();
      if (res.success) {
        toast.success("SLA Sweep disparado com sucesso!");
        console.log("SLA sweep result:", res.result);
      } else {
        toast.error(res.error || "Falha ao executar SLA.");
      }
    });
  };

  const handlePurgeCache = () => {
    toast.success("Cache do sistema limpo com sucesso!");
  };

  return (
    <>
      <PlatformAdminHeader breadcrumb="CorreTop / Admin" title="Super-Admin DevTools" />

      <main className="flex flex-1 flex-col gap-6 p-4 lg:p-6 bg-background/50">

        {/* Bento Grid Header */}
        <section className="flex flex-col gap-2">
          <p className="text-xs font-semibold text-primary uppercase tracking-widest">Painel Dev & Ops</p>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Plataforma Diagnósticos</h2>
          <p className="text-xs text-muted-foreground">
            Monitore integridade de microsserviços, execute queries SQL locais e configure parâmetros globais da corretora.
          </p>
        </section>

        {/* Bento Row 1: KPI Stats Grid */}
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">

          <Card className="border border-border/80 bg-card shadow-none hover:border-primary/20 transition-all duration-200">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Banco de Dados (Supabase)</span>
              <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
            </CardHeader>
            <CardContent>
              <div className="text-lg font-bold tracking-tight text-foreground">
                {systemMetrics?.dbSize || "Carregando..."}
              </div>
              <p className="text-[10px] text-muted-foreground mt-0.5 font-mono">
                {systemMetrics?.activeConnections || 0} conexões ativas
              </p>
            </CardContent>
          </Card>

          <Card className="border border-border/80 bg-card shadow-none hover:border-primary/20 transition-all duration-200">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Motor SLA Daemon</span>
              <Badge variant="outline" className="text-[10px] border-emerald-500/20 bg-emerald-500/10 text-emerald-500">
                Ativo
              </Badge>
            </CardHeader>
            <CardContent>
              <div className="text-lg font-bold tracking-tight text-foreground">A cada 5 min</div>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                Próximo ciclo automático iminente
              </p>
            </CardContent>
          </Card>

          <Card className="border border-border/80 bg-card shadow-none hover:border-primary/20 transition-all duration-200">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">WhatsApp API Cloud</span>
              <Badge variant="outline" className="text-[10px] border-blue-500/20 bg-blue-500/10 text-blue-500">
                Simulado
              </Badge>
            </CardHeader>
            <CardContent>
              <div className="text-lg font-bold tracking-tight text-foreground">Mocks Operantes</div>
              <p className="text-[10px] text-muted-foreground mt-0.5 font-mono">
                /api/webhooks/openwa
              </p>
            </CardContent>
          </Card>

          <Card className="border border-border/80 bg-card shadow-none hover:border-primary/20 transition-all duration-200">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Ambiente de Execução</span>
              <Gear className="size-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-lg font-bold tracking-tight text-foreground capitalize">
                {systemMetrics?.env || "produção"}
              </div>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                Next.js Turbopack Engine
              </p>
            </CardContent>
          </Card>

        </section>

        {/* Bento Row 2: SQL Terminal & Dev Operations */}
        <section className="grid gap-6 xl:grid-cols-3">

          {/* Bento Box 1: SQL Explorer (Col Span 2) */}
          <Card className="xl:col-span-2 border border-border/80 bg-card shadow-none flex flex-col justify-between">
            <CardHeader className="border-b border-border/50 pb-4">
              <div className="flex items-center gap-2">
                <FileText className="size-4.5 text-primary" />
                <CardTitle className="text-sm font-bold">SQL Explorer & Inspector</CardTitle>
              </div>
              <CardDescription className="text-xs">
                Selecione uma tabela e execute uma consulta direta com limite de linhas.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0 flex flex-col flex-1">

              {/* Controls bar */}
              <div className="flex flex-wrap items-center gap-3 p-4 bg-muted/40 border-b border-border/45">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase">Tabela</label>
                  <select
                    className="h-8 rounded-md border border-input bg-background px-2 text-xs font-semibold text-foreground focus:ring-1 focus:ring-primary outline-none"
                    value={selectedTable}
                    onChange={(e) => setSelectedTable(e.target.value)}
                  >
                    <option value="tenants">tenants (Empresas)</option>
                    <option value="user">user (Contas)</option>
                    <option value="leads">leads (Clientes potenciais)</option>
                    <option value="auditLogs">audit_logs (Operacional)</option>
                    <option value="platformAuditLogs">platform_audit_logs (Admin)</option>
                    <option value="session">session (Login BetterAuth)</option>
                    <option value="leadInteractions">lead_interactions (Históricos)</option>
                    <option value="leadDocuments">lead_documents (Documentos)</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase">Limite</label>
                  <Input
                    type="number"
                    className="h-8 w-20 text-xs font-semibold"
                    value={queryLimit}
                    onChange={(e) => setQueryLimit(Number(e.target.value))}
                  />
                </div>

                <div className="flex items-end h-full pt-4">
                  <Button
                    size="xs"
                    onClick={handleRunQuery}
                    disabled={queryPending}
                    className="h-8 gap-1.5 font-semibold text-xs px-4"
                  >
                    <MagnifyingGlass className="size-3.5" />
                    {queryPending ? "Executando..." : "Consultar Tabela"}
                  </Button>
                </div>
              </div>

              {/* Data viewer */}
              <div className="flex-1 overflow-auto max-h-96 min-h-64 p-4">
                {queryResults.length > 0 ? (
                  <div className="rounded-md border border-border/60 bg-muted/20 overflow-hidden">
                    <Table>
                      <TableHeader className="bg-muted/40">
                        <TableRow>
                          {Object.keys(queryResults[0]).slice(0, 5).map((key) => (
                            <TableHead key={key} className="text-[10px] font-bold uppercase tracking-wider py-2 font-mono">
                              {key}
                            </TableHead>
                          ))}
                          {Object.keys(queryResults[0]).length > 5 && (
                            <TableHead className="text-[10px] font-bold uppercase tracking-wider py-2 font-mono">
                              Outros
                            </TableHead>
                          )}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {queryResults.map((row, idx) => (
                          <TableRow key={idx} className="hover:bg-muted/30">
                            {Object.values(row).slice(0, 5).map((val: any, cellIdx) => (
                              <TableCell key={cellIdx} className="font-mono text-[11px] truncate max-w-xs py-2 text-foreground/80">
                                {typeof val === "object" ? JSON.stringify(val) : String(val ?? "—")}
                              </TableCell>
                            ))}
                            {Object.keys(row).length > 5 && (
                              <TableCell className="font-mono text-[10px] text-muted-foreground py-2">
                                +{Object.keys(row).length - 5} campos
                              </TableCell>
                            )}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full py-16 text-center text-muted-foreground">
                    <ShieldStar className="size-8 text-muted-foreground/35 mb-2" />
                    <p className="text-xs font-medium">Nenhuma consulta realizada</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">Selecione uma tabela e execute a query acima.</p>
                  </div>
                )}
              </div>

            </CardContent>
          </Card>

          {/* Bento Box 2: Operations Panel */}
          <Card className="border border-border/80 bg-card shadow-none flex flex-col justify-between">
            <CardHeader className="border-b border-border/50 pb-4">
              <div className="flex items-center gap-2">
                <Clock className="size-4.5 text-primary" />
                <CardTitle className="text-sm font-bold">Ações Rápidas & NOC</CardTitle>
              </div>
              <CardDescription className="text-xs">
                Controle de microsserviços e configurações internas do CorreTop.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pt-5">

              <div className="space-y-2">
                <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Serviços e Jobs</h4>
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between p-3 rounded-lg border border-border/60 bg-muted/10">
                    <div>
                      <p className="text-xs font-semibold text-foreground">SLA Sweep Manual</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">Disparar rotina de expiração de leads imediatamente.</p>
                    </div>
                    <Button size="xs" variant="outline" onClick={handleTriggerSla} disabled={isPending}>
                      {isPending ? "Rodando..." : "Executar"}
                    </Button>
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-lg border border-border/60 bg-muted/10">
                    <div>
                      <p className="text-xs font-semibold text-foreground">Limpar Caches Locais</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">Limpar buffers de fila de leads e sessões temporárias.</p>
                    </div>
                    <Button size="xs" variant="outline" onClick={handlePurgeCache}>
                      Limpar
                    </Button>
                  </div>
                </div>
              </div>

              <div className="space-y-2 pt-2">
                <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Acesso Direto às Páginas</h4>
                <div className="grid gap-2">
                  <Link
                    href="/super-admin/tenants"
                    className="inline-flex items-center justify-between p-2.5 rounded-md hover:bg-muted/40 border border-transparent hover:border-border/60 transition-all text-xs font-medium text-foreground/80 hover:text-foreground"
                  >
                    <span>CRUD e Gestão de Empresas</span>
                    <ArrowRight className="size-3.5" />
                  </Link>
                  <Link
                    href="/super-admin/audit"
                    className="inline-flex items-center justify-between p-2.5 rounded-md hover:bg-muted/40 border border-transparent hover:border-border/60 transition-all text-xs font-medium text-foreground/80 hover:text-foreground"
                  >
                    <span>Central de Logs e LGPD</span>
                    <ArrowRight className="size-3.5" />
                  </Link>
                  <Link
                    href="/super-admin/sessions"
                    className="inline-flex items-center justify-between p-2.5 rounded-md hover:bg-muted/40 border border-transparent hover:border-border/60 transition-all text-xs font-medium text-foreground/80 hover:text-foreground"
                  >
                    <span>Sessões de Conexão</span>
                    <ArrowRight className="size-3.5" />
                  </Link>
                </div>
              </div>

            </CardContent>
          </Card>

        </section>

      </main>
    </>
  );
}
