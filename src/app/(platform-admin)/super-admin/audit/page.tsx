"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import type { ColumnDef } from "@tanstack/react-table";
import { PlatformAdminHeader } from "@/components/platform-admin-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MagnifyingGlass, Trash } from "@/components/huge-icons";
import { DataTable, DataTableColumnHeader } from "@/components/ui/data-table";
import {
  purgeUserLGPDAction,
  getLeadEvidenceReportAction,
  getPlatformAuditLogsAction,
  getTenantAuditLogsAction,
} from "../actions";

// Typings
type PlatformLog = {
  id: string;
  action: string;
  targetType: string;
  targetId: string;
  metadata: unknown;
  createdAt: Date;
  actorName: string | null;
  actorEmail: string | null;
};

type TenantLog = {
  id: string;
  userId: string;
  entidade: string;
  entidadeId: string;
  acao: string;
  createdAt: Date;
  userName: string | null;
  userEmail: string | null;
};

const platformColumns: ColumnDef<PlatformLog>[] = [
  {
    accessorKey: "createdAt",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Data" />
    ),
    cell: ({ row }) => (
      <span className="font-mono text-[11px] text-muted-foreground pl-2">
        {new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(row.original.createdAt))}
      </span>
    ),
  },
  {
    accessorKey: "actorName",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Administrador" />
    ),
    cell: ({ row }) => (
      <div className="text-xs">
        <span className="font-semibold block text-foreground">{row.original.actorName || "Sistema"}</span>
        <span className="text-[10px] text-muted-foreground font-mono">{row.original.actorEmail || "auto"}</span>
      </div>
    ),
  },
  {
    accessorKey: "action",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Ação" />
    ),
    cell: ({ row }) => (
      <span className="font-semibold text-xs text-primary">{row.original.action}</span>
    ),
  },
  {
    accessorKey: "targetType",
    header: "Entidade",
    cell: ({ row }) => <span className="text-xs font-medium">{row.original.targetType}</span>,
  },
  {
    accessorKey: "targetId",
    header: "ID do Destino",
    cell: ({ row }) => (
      <span className="font-mono text-[10px] text-muted-foreground pr-2">{row.original.targetId}</span>
    ),
  },
];

const tenantColumns: ColumnDef<TenantLog>[] = [
  {
    accessorKey: "createdAt",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Data" />
    ),
    cell: ({ row }) => (
      <span className="font-mono text-[11px] text-muted-foreground pl-2">
        {new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(row.original.createdAt))}
      </span>
    ),
  },
  {
    accessorKey: "userName",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Usuário" />
    ),
    cell: ({ row }) => (
      <div className="text-xs">
        <span className="font-semibold block text-foreground">{row.original.userName || "Usuário"}</span>
        <span className="text-[10px] text-muted-foreground font-mono">{row.original.userEmail || "—"}</span>
      </div>
    ),
  },
  {
    accessorKey: "acao",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Ação Efetuada" />
    ),
    cell: ({ row }) => (
      <span className="font-semibold text-xs text-primary">{row.original.acao}</span>
    ),
  },
  {
    accessorKey: "entidade",
    header: "Módulo",
    cell: ({ row }) => <span className="text-xs font-medium">{row.original.entidade}</span>,
  },
  {
    accessorKey: "entidadeId",
    header: "ID Recurso",
    cell: ({ row }) => (
      <span className="font-mono text-[10px] text-muted-foreground pr-2">{row.original.entidadeId}</span>
    ),
  },
];

export default function SuperAdminAuditPage() {
  const [activeTab, setActiveTab] = useState<"platform" | "tenant" | "lgpd" | "evidence">("platform");
  const [platformLogs, setPlatformLogs] = useState<PlatformLog[]>([]);
  const [tenantLogs, setTenantLogs] = useState<TenantLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [leadIdInput, setLeadIdInput] = useState("");
  const [evidenceReport, setEvidenceReport] = useState<any>(null);
  const [purgingId, setPurgingId] = useState("");
  const [pending, startTransition] = useTransition();

  const loadPlatformLogs = async () => {
    setLoading(true);
    try {
      const data = await getPlatformAuditLogsAction();
      setPlatformLogs(data);
    } catch {
      toast.error("Erro ao carregar logs de plataforma.");
    } finally {
      setLoading(false);
    }
  };

  const loadTenantLogs = async () => {
    setLoading(true);
    try {
      const data = await getTenantAuditLogsAction();
      setTenantLogs(data);
    } catch {
      toast.error("Erro ao carregar logs de operadoras.");
    } finally {
      setLoading(false);
    }
  };

  const fetchEvidence = () => {
    if (!leadIdInput.trim()) return;
    startTransition(async () => {
      const result = await getLeadEvidenceReportAction(leadIdInput);
      if (result.error) {
        toast.error(result.error);
        setEvidenceReport(null);
        return;
      }
      setEvidenceReport(result.report);
      toast.success("Relatório de evidências gerado com sucesso.");
    });
  };

  const handlePurge = (formData: FormData) => {
    startTransition(async () => {
      await purgeUserLGPDAction(formData);
      toast.success("Usuário expurgado com sucesso sob requisição LGPD.");
      setPurgingId("");
    });
  };

  return (
    <>
      <PlatformAdminHeader breadcrumb="CorreTop / Admin" title="Segurança & Auditoria" />

      <main className="flex flex-1 flex-col gap-6 p-4 lg:p-6">
        {/* Navigation Tabs */}
        <div className="flex border-b border-border text-xs gap-4 font-semibold pb-px">
          <button
            onClick={() => { setActiveTab("platform"); loadPlatformLogs(); }}
            className={`pb-3 border-b-2 px-1 transition-colors cursor-pointer ${activeTab === "platform" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
          >
            Auditoria Plataforma
          </button>
          <button
            onClick={() => { setActiveTab("tenant"); loadTenantLogs(); }}
            className={`pb-3 border-b-2 px-1 transition-colors cursor-pointer ${activeTab === "tenant" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
          >
            Auditoria Operadoras
          </button>
          <button
            onClick={() => setActiveTab("evidence")}
            className={`pb-3 border-b-2 px-1 transition-colors cursor-pointer ${activeTab === "evidence" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
          >
            Relatório de Evidências (7.6)
          </button>
          <button
            onClick={() => setActiveTab("lgpd")}
            className={`pb-3 border-b-2 px-1 transition-colors cursor-pointer ${activeTab === "lgpd" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
          >
            Governança LGPD (7.7)
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === "platform" && (
          <Card className="border-border bg-card shadow-xs">
            <CardHeader className="flex flex-row items-center justify-between border-b border-border/50 p-4">
              <div>
                <CardTitle className="text-base">Eventos da Plataforma</CardTitle>
                <CardDescription className="text-xs mt-0.5">Auditoria global de criação de tenants, alterações de licença e logins administrativos.</CardDescription>
              </div>
              <Button size="sm" onClick={loadPlatformLogs} disabled={loading} className="h-8 text-xs">
                Carregar Logs
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <DataTable
                columns={platformColumns}
                data={platformLogs}
                searchKey="action"
                searchPlaceholder="Filtrar eventos por ação..."
                showColumnToggle={true}
                showPagination={true}
                pageSize={10}
                emptyState="Clique em 'Carregar Logs' para atualizar a lista."
              />
            </CardContent>
          </Card>
        )}

        {activeTab === "tenant" && (
          <Card className="border-border bg-card shadow-xs">
            <CardHeader className="flex flex-row items-center justify-between border-b border-border/50 p-4">
              <div>
                <CardTitle className="text-base">Eventos de Operação do Tenant</CardTitle>
                <CardDescription className="text-xs mt-0.5">Auditoria de exportações de PDFs, exclusões de leads e reatribuição de carteiras.</CardDescription>
              </div>
              <Button size="sm" onClick={loadTenantLogs} disabled={loading} className="h-8 text-xs">
                Carregar Logs
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <DataTable
                columns={tenantColumns}
                data={tenantLogs}
                searchKey="acao"
                searchPlaceholder="Filtrar eventos operacionais..."
                showColumnToggle={true}
                showPagination={true}
                pageSize={10}
                emptyState="Clique em 'Carregar Logs' para atualizar a lista."
              />
            </CardContent>
          </Card>
        )}

        {activeTab === "evidence" && (
          <div className="space-y-4">
            <Card className="border-border bg-card shadow-xs">
              <CardHeader>
                <CardTitle className="text-base">Dossiê Forense de Evidências</CardTitle>
                <CardDescription className="text-xs">Consolide todo o histórico de logs, timeline e arquivos do lead em um arquivo único para auditorias.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2 items-end">
                  <div className="flex-1 max-w-sm">
                    <Label htmlFor="leadIdInput" className="text-xs">Identificador do Lead (UUID)</Label>
                    <Input
                      id="leadIdInput"
                      placeholder="e.g. 550e8400-e29b-41d4-a716-446655440000"
                      value={leadIdInput}
                      onChange={(e) => setLeadIdInput(e.target.value)}
                      className="h-9 mt-1 text-xs"
                    />
                  </div>
                  <Button size="sm" onClick={fetchEvidence} disabled={pending} className="h-9 text-xs">
                    <MagnifyingGlass className="size-4 mr-1.5" />
                    Gerar Dossiê
                  </Button>
                </div>
              </CardContent>
            </Card>

            {evidenceReport && (
              <Card className="border-border bg-card shadow-xs">
                <CardHeader className="border-b border-border/50 p-4">
                  <CardTitle className="text-sm font-semibold">Evidências: {evidenceReport.lead.nome}</CardTitle>
                  <CardDescription className="text-[10px] font-mono mt-0.5">Exportado em: {new Date(evidenceReport.exportedAt).toLocaleString("pt-BR")}</CardDescription>
                </CardHeader>
                <CardContent className="p-4 space-y-4 font-mono text-[11px] bg-muted/20 text-foreground/80 max-h-96 overflow-auto">
                  <pre className="whitespace-pre-wrap">{JSON.stringify(evidenceReport, null, 2)}</pre>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {activeTab === "lgpd" && (
          <Card className="border-border bg-card shadow-xs">
            <CardHeader>
              <CardTitle className="text-base">Expurgo Governança LGPD</CardTitle>
              <CardDescription className="text-xs">Anonimize de forma permanente um usuário deletando suas conexões ativas, dados pessoais e acessos por requisição judicial ou de titularidade.</CardDescription>
            </CardHeader>
            <CardContent>
              <form action={handlePurge} className="space-y-4 max-w-md">
                <div className="space-y-1">
                  <Label htmlFor="userId" className="text-xs">Identificador do Usuário (ID)</Label>
                  <Input
                    name="userId"
                    id="userId"
                    placeholder="e.g. 987abc-550e8400..."
                    value={purgingId}
                    onChange={(e) => setPurgingId(e.target.value)}
                    required
                    className="h-9 text-xs font-mono"
                  />
                </div>
                <Button size="sm" variant="destructive" type="submit" disabled={pending} className="h-9 text-xs">
                  <Trash className="size-4 mr-1.5" />
                  {pending ? "Processando expurgo..." : "Anonimizar Usuário (Expurgar)"}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}
      </main>
    </>
  );
}
