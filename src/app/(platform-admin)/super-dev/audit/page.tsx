"use client";

import { useActionState, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  PlatformAdminHeader
} from "@/components/platform-admin-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Clock,
  ShieldWarning,
  FileText,
  MagnifyingGlass,
  Trash,
  Plus
} from "@/components/huge-icons";
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

export default function SuperDevAuditPage() {
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
    } catch (e) {
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
    } catch (e) {
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
            className={`pb-3 border-b-2 px-1 transition-colors ${activeTab === "platform" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
          >
            Auditoria Plataforma
          </button>
          <button
            onClick={() => { setActiveTab("tenant"); loadTenantLogs(); }}
            className={`pb-3 border-b-2 px-1 transition-colors ${activeTab === "tenant" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
          >
            Auditoria Operadoras
          </button>
          <button
            onClick={() => setActiveTab("evidence")}
            className={`pb-3 border-b-2 px-1 transition-colors ${activeTab === "evidence" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
          >
            Relatório de Evidências (7.6)
          </button>
          <button
            onClick={() => setActiveTab("lgpd")}
            className={`pb-3 border-b-2 px-1 transition-colors ${activeTab === "lgpd" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
          >
            Governança LGPD (7.7)
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === "platform" && (
          <Card className="border-border bg-card shadow-none">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Eventos da Plataforma</CardTitle>
                <CardDescription>Auditoria global de criação de tenants, alterações de licença e logins administrativos.</CardDescription>
              </div>
              <Button size="xs" onClick={loadPlatformLogs} disabled={loading}>
                Carregar Logs
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-5">Ação</TableHead>
                    <TableHead>Alvo</TableHead>
                    <TableHead>ID Alvo</TableHead>
                    <TableHead>Executor</TableHead>
                    <TableHead className="pr-5">Data/Hora</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {platformLogs.map((log) => (
                    <TableRow key={log.id} className="text-xs">
                      <TableCell className="pl-5 font-semibold">{log.action}</TableCell>
                      <TableCell>{log.targetType}</TableCell>
                      <TableCell className="font-mono text-[10px] text-muted-foreground">{log.targetId}</TableCell>
                      <TableCell>{log.actorName || "—"} ({log.actorEmail})</TableCell>
                      <TableCell className="pr-5 text-[10px] text-muted-foreground">
                        {new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(log.createdAt))}
                      </TableCell>
                    </TableRow>
                  ))}
                  {platformLogs.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                        Clique em Carregar Logs para visualizar o histórico de eventos.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {activeTab === "tenant" && (
          <Card className="border-border bg-card shadow-none">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Eventos de Auditoria das Operadoras</CardTitle>
                <CardDescription>Exportações de PDF, visualização de dados sensíveis e acessos realizados pelos corretores.</CardDescription>
              </div>
              <Button size="xs" onClick={loadTenantLogs} disabled={loading}>
                Carregar Logs
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-5">Ação</TableHead>
                    <TableHead>Entidade</TableHead>
                    <TableHead>ID Entidade</TableHead>
                    <TableHead>Corretor / Membro</TableHead>
                    <TableHead className="pr-5">Data/Hora</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tenantLogs.map((log) => (
                    <TableRow key={log.id} className="text-xs">
                      <TableCell className="pl-5 font-semibold">{log.acao}</TableCell>
                      <TableCell>{log.entidade}</TableCell>
                      <TableCell className="font-mono text-[10px] text-muted-foreground">{log.entidadeId}</TableCell>
                      <TableCell>{log.userName || "—"} ({log.userEmail})</TableCell>
                      <TableCell className="pr-5 text-[10px] text-muted-foreground">
                        {new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(log.createdAt))}
                      </TableCell>
                    </TableRow>
                  ))}
                  {tenantLogs.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                        Clique em Carregar Logs para visualizar o histórico de eventos.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {activeTab === "evidence" && (
          <Card className="border-border bg-card shadow-none">
            <CardHeader>
              <CardTitle>Relatório de Evidências do Lead</CardTitle>
              <CardDescription>Dumps estruturados e consolidados de todas as interações e documentos do lead para auditorias criminais e comerciais.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2 max-w-md">
                <Input
                  placeholder="Informe o ID do Lead"
                  value={leadIdInput}
                  className="h-9 text-xs"
                  onChange={(e) => setLeadIdInput(e.target.value)}
                />
                <Button size="xs" onClick={fetchEvidence} disabled={pending}>
                  {pending ? "Buscando..." : "Gerar Relatório"}
                </Button>
              </div>

              {evidenceReport && (
                <div className="rounded-xl border bg-muted/20 p-4 space-y-4 text-xs">
                  <div className="flex justify-between items-center border-b pb-2">
                    <span className="font-semibold text-sm">Lead: {evidenceReport.lead.nome}</span>
                    <Badge variant="outline">Status: {evidenceReport.lead.status}</Badge>
                  </div>
                  <div>
                    <span className="font-semibold">Histórico de Linha do Tempo (Interações):</span>
                    <ul className="mt-2 space-y-1.5 list-disc pl-5">
                      {evidenceReport.timeline.map((t: any) => (
                        <li key={t.id}>
                          <strong>[{t.type}]</strong> {t.content} —{" "}
                          <span className="text-[10px] text-muted-foreground">
                            {new Date(t.createdAt).toLocaleString("pt-BR")}
                          </span>
                        </li>
                      ))}
                      {evidenceReport.timeline.length === 0 && (
                        <p className="text-muted-foreground">Nenhuma interação registrada.</p>
                      )}
                    </ul>
                  </div>

                  <div>
                    <span className="font-semibold">Documentos Anexados:</span>
                    <ul className="mt-2 space-y-1.5 list-disc pl-5">
                      {evidenceReport.documents.map((d: any) => (
                        <li key={d.id}>
                          {d.fileName} ({d.status}) —{" "}
                          <span className="text-[10px] text-muted-foreground">
                            {new Date(d.createdAt).toLocaleString("pt-BR")}
                          </span>
                        </li>
                      ))}
                      {evidenceReport.documents.length === 0 && (
                        <p className="text-muted-foreground">Nenhum documento anexado.</p>
                      )}
                    </ul>
                  </div>

                  <div className="border-t pt-3 flex justify-between items-center text-[10px] text-muted-foreground">
                    <span>ID do Lead: {evidenceReport.lead.id}</span>
                    <span>Exportado em: {new Date(evidenceReport.exportedAt).toLocaleString("pt-BR")}</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {activeTab === "lgpd" && (
          <Card className="border-border bg-card shadow-none">
            <CardHeader className="flex flex-row items-start gap-3">
              <ShieldWarning className="size-6 text-warning mt-0.5 shrink-0" />
              <div>
                <CardTitle>Painel de Governança LGPD</CardTitle>
                <CardDescription>Exclusão definitiva de logins, chaves de autenticação, sessões ativas e dados de contato sob requisição legal dos titulares.</CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              <form action={handlePurge} className="space-y-4 max-w-md">
                <div className="space-y-2">
                  <Label htmlFor="userId" className="text-xs">ID do Usuário / Titular</Label>
                  <Input
                    id="userId"
                    name="userId"
                    placeholder="Informe o ID do usuário (BetterAuth userId)"
                    className="h-9 text-xs"
                    value={purgingId}
                    onChange={(e) => setPurgingId(e.target.value)}
                    required
                  />
                </div>
                <Button variant="destructive" className="text-xs" type="submit" disabled={pending || !purgingId}>
                  Expurgar e Desativar Titular
                </Button>
              </form>
            </CardContent>
          </Card>
        )}
      </main>
    </>
  );
}
