"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Clock, FileText, MessageSquare, RefreshCw, Search, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { fetchMetaTemplatesAction, syncMetaTemplatesAction } from "@/features/ai-qualification/actions";

type MetaTemplateItem = {
  id: string;
  name: string;
  language: string;
  status: string;
  category: string;
  bodyText?: string | null;
  headerText?: string | null;
  footerText?: string | null;
  buttonsJson?: unknown;
};

function statusVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  switch (status.toUpperCase()) {
    case "APPROVED":
      return "default";
    case "REJECTED":
      return "destructive";
    case "PENDING":
      return "secondary";
    default:
      return "outline";
  }
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    APPROVED: "Aprovado",
    PENDING: "Em análise",
    REJECTED: "Reprovado",
    PAUSED: "Pausado",
    DISABLED: "Desativado",
    ARCHIVED: "Arquivado",
  };
  return labels[status.toUpperCase()] ?? status;
}

function getButtons(buttonsJson: unknown) {
  if (!Array.isArray(buttonsJson)) return [];
  return buttonsJson.flatMap((button) => {
    if (typeof button !== "object" || button === null) return [];
    const value = button as Record<string, unknown>;
    return typeof value.text === "string" ? [value.text] : [];
  });
}

export function MetaTemplatesPanel() {
  const [templates, setTemplates] = useState<MetaTemplateItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const loadTemplates = async () => {
    setLoading(true);
    try {
      const data = await fetchMetaTemplatesAction();
      setTemplates(data as MetaTemplateItem[]);
    } catch {
      toast.error("Não foi possível carregar os modelos da Meta.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadTemplates();
  }, []);

  const filteredTemplates = useMemo(() => {
    const query = searchQuery.trim().toLocaleLowerCase("pt-BR");
    if (!query) return templates;
    return templates.filter((template) =>
      [template.name, template.category, template.language, template.status, template.bodyText]
        .filter(Boolean)
        .some((value) => String(value).toLocaleLowerCase("pt-BR").includes(query)),
    );
  }, [searchQuery, templates]);

  async function handleSync() {
    setSyncing(true);
    try {
      const result = await syncMetaTemplatesAction();
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success(`${result.syncedCount} modelo(s) recebido(s) da Meta.`);
      await loadTemplates();
    } catch {
      toast.error("Não foi possível sincronizar os modelos com a Meta.");
    } finally {
      setSyncing(false);
    }
  }

  return (
    <section className="grid gap-6" aria-label="Catálogo de modelos Meta">
      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1.5">
            <CardTitle className="flex items-center gap-2 text-lg">
              <ShieldCheck className="size-5 text-primary" />
              Modelos da Meta
            </CardTitle>
            <CardDescription>
              Catálogo somente para consulta. Os modelos são criados, editados e aprovados no Gerenciador do WhatsApp da Meta.
            </CardDescription>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={handleSync} disabled={syncing} className="gap-2">
            <RefreshCw className={`size-4 ${syncing ? "animate-spin" : ""}`} />
            {syncing ? "Sincronizando…" : "Sincronizar com a Meta"}
          </Button>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm text-muted-foreground" role="status">
            Esta tela não altera a conta Meta nem cria modelos. A sincronização consulta apenas a conta WhatsApp oficialmente conectada neste tenant.
          </div>
          <div className="relative max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Buscar por nome, categoria ou conteúdo"
              className="pl-9"
              aria-label="Buscar modelos Meta"
            />
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="flex items-center justify-center gap-2 p-12 text-sm text-muted-foreground" role="status">
          <RefreshCw className="size-4 animate-spin" /> Carregando modelos da Meta…
        </div>
      ) : filteredTemplates.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="p-8 text-center">
            <FileText className="mx-auto mb-3 size-8 text-muted-foreground" />
            <p className="font-medium">Nenhum modelo encontrado nesta conta Meta</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Crie ou confira o modelo no Gerenciador do WhatsApp da Meta e use “Sincronizar com a Meta”.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {filteredTemplates.map((template) => {
            const buttons = getButtons(template.buttonsJson);
            return (
              <Card key={template.id} className="overflow-hidden">
                <CardHeader className="gap-3 pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <CardTitle className="truncate font-mono text-base">{template.name}</CardTitle>
                      <CardDescription className="mt-1">{template.language} · {template.category}</CardDescription>
                    </div>
                    <Badge variant={statusVariant(template.status)} className="shrink-0">
                      {template.status.toUpperCase() === "APPROVED" ? <CheckCircle2 className="mr-1 size-3" /> : <Clock className="mr-1 size-3" />}
                      {statusLabel(template.status)}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="grid gap-3 text-sm">
                  {template.headerText ? <p className="font-medium">{template.headerText}</p> : null}
                  <div className="whitespace-pre-wrap rounded-md border bg-muted/30 p-3 text-muted-foreground">
                    {template.bodyText || "A Meta não retornou o corpo deste modelo."}
                  </div>
                  {template.footerText ? <p className="text-xs text-muted-foreground">{template.footerText}</p> : null}
                  {buttons.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5" aria-label="Botões do modelo">
                      <MessageSquare className="mt-1 size-3.5 text-muted-foreground" />
                      {buttons.map((button, index) => <Badge key={`${button}-${index}`} variant="outline">{button}</Badge>)}
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </section>
  );
}
