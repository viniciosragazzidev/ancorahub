"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ArrowsClockwise, Check, InfoIcon, PaperPlaneTilt, Plus, Trash } from "@/components/huge-icons";
import { TemplateBuilderWizard } from "./template-builder-wizard";

type Template = {
  id: string;
  name: string;
  language: string;
  category: string;
  status: string;
  qualityRating: string | null;
  bodyText: string | null;
  footerText: string | null;
  headerType: string;
  origin: string;
  rejectedReason: string | null;
  lastSyncedAt: string | null;
  componentsJson: any;
};

export function TemplateListView({ canManage, onUseTemplate }: { canManage: boolean; onUseTemplate?: (templateId: string) => void }) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [configuringTemplate, setConfiguringTemplate] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);

  // Test modal state
  const [testPhone, setTestPhone] = useState("");
  const [testSending, setTestSending] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [testError, setTestError] = useState<string | null>(null);

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "ALL") params.set("status", statusFilter);
      if (categoryFilter !== "ALL") params.set("category", categoryFilter);
      if (search.trim()) params.set("search", search.trim());

      const res = await fetch(`/api/integrations/whatsapp/templates?${params.toString()}`);
      const data = await res.json();
      if (res.ok) {
        setTemplates(data.templates || []);
      }
    } catch {
      // Ignore network failures gracefully
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchTemplates();
  }, [statusFilter, categoryFilter]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await fetch("/api/integrations/whatsapp/templates/sync", { method: "POST" });
      if (res.ok) {
        await fetchTemplates();
      }
    } catch {
      // Ignore network errors
    } finally {
      setSyncing(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este template da Meta?")) return;
    try {
      const res = await fetch(`/api/integrations/whatsapp/templates/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Erro ao excluir template.");
        return;
      }
      setSelectedTemplate(null);
      await fetchTemplates();
    } catch {
      alert("Erro de conexão ao excluir.");
    }
  };

  const handleSendTest = async () => {
    if (!selectedTemplate || !testPhone.trim()) return;
    setTestSending(true);
    setTestResult(null);
    setTestError(null);
    try {
      const res = await fetch(`/api/integrations/whatsapp/templates/${selectedTemplate.id}/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ destinationPhone: testPhone }),
      });
      const data = await res.json();
      if (res.ok) {
        setTestResult(`Mensagem de teste enviada com sucesso! WAMID: ${data.wamid || "Confirmado"}`);
      } else {
        setTestError(data.error || "Erro ao enviar teste.");
      }
    } catch {
      setTestError("Erro de conexão.");
    } finally {
      setTestSending(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "APPROVED":
        return <Badge variant="default" className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/20">Aprovado</Badge>;
      case "PENDING":
        return <Badge variant="secondary" className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/20">Em análise</Badge>;
      case "REJECTED":
        return <Badge variant="destructive">Rejeitado</Badge>;
      case "PAUSED":
        return <Badge variant="outline" className="text-orange-600 border-orange-300">Pausado</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-4">
      <Card className="border-border bg-card shadow-none">
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <div>
            <CardTitle>Templates oficiais da WABA</CardTitle>
            <CardDescription className="mt-1">
              Gerencie e sincronize os modelos de mensagem autorizados pela Meta para envio oficial.
            </CardDescription>
          </div>
          {canManage ? (
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleSync} disabled={syncing}>
                <ArrowsClockwise className={`size-4 mr-2 ${syncing ? "animate-spin" : ""}`} />
                Sincronizar com Meta
              </Button>
              <Button size="sm" onClick={() => setWizardOpen(true)}>
                <Plus className="size-4 mr-2" />
                Novo Template
              </Button>
            </div>
          ) : null}
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Input
              placeholder="Buscar por nome ou conteúdo..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && fetchTemplates()}
              className="max-w-xs"
            />
            <div className="flex items-center gap-2">
              <Select value={statusFilter} onValueChange={(val) => val && setStatusFilter(val)}>
                <SelectTrigger className="w-36">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todos os status</SelectItem>
                  <SelectItem value="APPROVED">Aprovados</SelectItem>
                  <SelectItem value="PENDING">Em análise</SelectItem>
                  <SelectItem value="REJECTED">Rejeitados</SelectItem>
                  <SelectItem value="PAUSED">Pausados</SelectItem>
                </SelectContent>
              </Select>
              <Select value={categoryFilter} onValueChange={(val) => val && setCategoryFilter(val)}>
                <SelectTrigger className="w-36">
                  <SelectValue placeholder="Categoria" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todas categorias</SelectItem>
                  <SelectItem value="UTILITY">Utilidade</SelectItem>
                  <SelectItem value="MARKETING">Marketing</SelectItem>
                  <SelectItem value="AUTHENTICATION">Autenticação</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {loading ? (
            <div className="py-8 text-center text-sm text-muted-foreground">Carregando templates da Meta...</div>
          ) : templates.length === 0 ? (
            <div className="rounded-lg border border-dashed p-8 text-center">
              <InfoIcon className="mx-auto size-8 text-muted-foreground/60" />
              <p className="mt-2 font-medium">Nenhum template encontrado</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Clique em &quot;Sincronizar com Meta&quot; para buscar modelos da WABA ou crie um novo template.
              </p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {templates.map((t) => (
                <Card
                  key={t.id}
                  className="group cursor-pointer border-border transition-colors hover:border-primary/50"
                  onClick={() => {
                    setConfiguringTemplate(false);
                    setSelectedTemplate(t);
                  }}
                >
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-mono text-sm font-semibold text-foreground truncate max-w-[180px]">{t.name}</p>
                        <p className="text-xs text-muted-foreground capitalize">{t.category.toLowerCase()} • {t.language}</p>
                      </div>
                      {getStatusBadge(t.status)}
                    </div>
                    <p className="text-xs leading-relaxed text-muted-foreground line-clamp-3 bg-muted/30 p-2 rounded">
                      {t.bodyText || "Sem conteúdo de texto."}
                    </p>
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1 border-t border-border/50">
                      <span>Origem: {t.origin === "META" ? "Importado da Meta" : "Criado no CRM"}</span>
                      {t.qualityRating && t.qualityRating !== "UNKNOWN" ? (
                        <span className="font-medium text-emerald-600 dark:text-emerald-400">Qualidade: {t.qualityRating}</span>
                      ) : null}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Drawer de Detalhes */}
      <Sheet open={Boolean(selectedTemplate)} onOpenChange={(open) => {
        if (!open) {
          setConfiguringTemplate(false);
          setSelectedTemplate(null);
        }
      }}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          {selectedTemplate ? (
            <div className="space-y-6">
              <SheetHeader>
                <div className="flex items-center gap-2">
                  <SheetTitle className="font-mono text-lg">{selectedTemplate.name}</SheetTitle>
                  {getStatusBadge(selectedTemplate.status)}
                </div>
                <p className="text-xs text-muted-foreground">
                  Categoria: {selectedTemplate.category} | Idioma: {selectedTemplate.language}
                </p>
              </SheetHeader>

              {selectedTemplate.rejectedReason ? (
                <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
                  <strong>Motivo da rejeição:</strong> {selectedTemplate.rejectedReason}
                </div>
              ) : null}

              {/* Mockup Preview WhatsApp */}
              <div className="rounded-lg border border-border bg-emerald-950/5 dark:bg-emerald-950/20 p-4">
                <p className="text-[11px] font-medium text-muted-foreground mb-2 uppercase tracking-wider">Pré-visualização WhatsApp</p>
                <div className="rounded-lg bg-card border border-border p-3 text-sm shadow-sm space-y-2 max-w-sm">
                  {selectedTemplate.headerType !== "NONE" ? (
                    <div className="font-semibold text-xs text-primary pb-1 border-b border-border/50">
                      [Cabeçalho: {selectedTemplate.headerType}]
                    </div>
                  ) : null}
                  <p className="whitespace-pre-wrap text-foreground text-xs leading-5">{selectedTemplate.bodyText}</p>
                  {selectedTemplate.footerText ? (
                    <p className="text-[10px] text-muted-foreground pt-1 border-t border-border/50">{selectedTemplate.footerText}</p>
                  ) : null}
                </div>
              </div>

              {/* Envio de teste */}
              {selectedTemplate.status === "APPROVED" && canManage ? (
                <div className="space-y-3 rounded-lg border border-border p-4 bg-muted/20">
                  <p className="text-xs font-semibold">Enviar mensagem de teste</p>
                  <div className="flex gap-2">
                    <Input
                      placeholder="DDD + Telefone (ex: 11999998888)"
                      value={testPhone}
                      onChange={(e) => setTestPhone(e.target.value)}
                      className="text-xs"
                    />
                    <Button size="sm" onClick={handleSendTest} disabled={testSending || !testPhone.trim()}>
                      <PaperPlaneTilt className="size-3.5 mr-1" />
                      Enviar
                    </Button>
                  </div>
                  {testResult ? <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">{testResult}</p> : null}
                  {testError ? <p className="text-xs text-destructive font-medium">{testError}</p> : null}
                </div>
              ) : null}

              {canManage && selectedTemplate.status === "APPROVED" && onUseTemplate && configuringTemplate ? (
                <div className="rounded-xl border border-primary/20 bg-primary/[0.04] p-4">
                  <p className="text-sm font-semibold">Configurar este template</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    Escolha a situação no painel seguinte. O template será aplicado como mensagem principal, mas só será ativado depois de você salvar e publicar.
                  </p>
                  <div className="mt-4 flex flex-wrap justify-end gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={() => setConfiguringTemplate(false)}>Cancelar</Button>
                    <Button type="button" size="sm" onClick={() => {
                      onUseTemplate(selectedTemplate.id);
                      setConfiguringTemplate(false);
                      setSelectedTemplate(null);
                    }}>
                      <Check className="size-4 mr-2" />
                      Aplicar e abrir situações
                    </Button>
                  </div>
                </div>
              ) : null}

              {canManage ? (
                <div className="pt-4 border-t border-border flex flex-wrap justify-end gap-2">
                  {selectedTemplate.status === "APPROVED" && onUseTemplate ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setConfiguringTemplate(true)}
                    >
                      <Check className="size-4 mr-2" />
                      Configurar situação
                    </Button>
                  ) : null}
                  <Button variant="destructive" size="sm" onClick={() => handleDelete(selectedTemplate.id)}>
                    <Trash className="size-4 mr-2" />
                    Excluir template da Meta
                  </Button>
                </div>
              ) : null}
            </div>
          ) : null}
        </SheetContent>
      </Sheet>

      {/* Wizard Modal */}
      {wizardOpen ? (
        <TemplateBuilderWizard
          open={wizardOpen}
          onClose={() => setWizardOpen(false)}
          onSuccess={() => {
            setWizardOpen(false);
            void fetchTemplates();
          }}
        />
      ) : null}
    </div>
  );
}
