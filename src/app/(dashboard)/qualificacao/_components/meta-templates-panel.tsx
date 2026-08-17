"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  FileText,
  RefreshCw,
  CheckCircle2,
  Sparkles,
  BadgeAlert,
  Layers,
  Search,
  Check,
  Send,
  Plus,
  Trash2,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogClose,
  DialogPopup,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  fetchMetaTemplatesAction,
  syncMetaTemplatesAction,
  setDefaultMetaTemplateAction,
  deleteMetaTemplateAction,
} from "@/features/ai-qualification/actions";

type MetaTemplateItem = {
  id: string;
  name: string;
  language: string;
  status: string;
  category: string;
  bodyText?: string | null;
  headerText?: string | null;
  footerText?: string | null;
  componentsJson?: any;
  syncedAt?: Date | string | null;
  isDefault?: boolean;
};

export function MetaTemplatesPanel() {
  const [templates, setTemplates] = useState<MetaTemplateItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [syncing, setSyncing] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [newModalOpen, setNewModalOpen] = useState<boolean>(false);

  useEffect(() => {
    loadTemplates();
  }, []);

  async function loadTemplates() {
    setLoading(true);
    try {
      const data = await fetchMetaTemplatesAction();
      setTemplates(data as MetaTemplateItem[]);
    } catch (err) {
      console.error("Erro ao carregar modelos Meta:", err);
      toast.error("Não foi possível carregar os modelos Meta.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSync() {
    setSyncing(true);
    try {
      await syncMetaTemplatesAction();
      toast.success("Sincronização com a Meta concluída!");
      await loadTemplates();
    } catch (err) {
      toast.error("Erro ao sincronizar com a Meta API.");
    } finally {
      setSyncing(false);
    }
  }

  async function handleSetDefault(item: MetaTemplateItem) {
    try {
      await setDefaultMetaTemplateAction(item.id);
      toast.success(`Modelo "${item.name}" definido como padrão de primeiro atendimento!`);
      await loadTemplates();
    } catch (err) {
      toast.error("Erro ao definir modelo padrão.");
    }
  }

  async function handleDelete(item: MetaTemplateItem) {
    if (!confirm(`Deseja realmente remover o modelo "${item.name}" da lista?`)) return;
    try {
      await deleteMetaTemplateAction(item.id);
      toast.success(`Modelo "${item.name}" removido com sucesso!`);
      await loadTemplates();
    } catch (err) {
      toast.error("Erro ao remover modelo.");
    }
  }

  const filtered = templates.filter((t) =>
    t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (t.bodyText && t.bodyText.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="grid gap-6">
      {/* Top Banner / Actions */}
      <Card className="border-primary/20 bg-gradient-to-r from-primary/5 via-background to-background">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <div>
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <FileText className="size-5 text-primary" />
              Modelos de Mensagem Meta (WhatsApp Templates)
            </CardTitle>
            <CardDescription className="text-xs mt-1">
              Gerencie e sincronize seus modelos aprovados pela Meta para disparo no primeiro contato de qualificação.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleSync}
              disabled={syncing}
              className="h-9 gap-2 text-xs"
            >
              <RefreshCw className={`size-3.5 ${syncing ? "animate-spin" : ""}`} />
              {syncing ? "Sincronizando…" : "Sincronizar com Meta"}
            </Button>
            <Button
              size="sm"
              onClick={() => setNewModalOpen(true)}
              className="h-9 gap-2 text-xs"
            >
              <Plus className="size-3.5" />
              Novo Modelo
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-2">
          <div className="relative max-w-sm">
            <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome ou conteúdo do modelo..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9 text-xs"
            />
          </div>
        </CardContent>
      </Card>

      {/* Template Grid List */}
      {loading ? (
        <div className="flex items-center justify-center p-12 text-sm text-muted-foreground gap-2">
          <RefreshCw className="size-4 animate-spin text-primary" />
          Carregando modelos de mensagem...
        </div>
      ) : filtered.length === 0 ? (
        <Card className="p-8 text-center border-dashed">
          <FileText className="size-8 text-muted-foreground mx-auto mb-2 opacity-50" />
          <p className="text-sm font-semibold">Nenhum modelo encontrado</p>
          <p className="text-xs text-muted-foreground mt-1">
            Clique em "Sincronizar com Meta" para importar modelos aprovados.
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((item) => {
            const isDefault = Boolean(item.isDefault);
            return (
              <Card
                key={item.id}
                className={`relative transition-all border ${
                  isDefault ? "border-primary shadow-sm bg-primary/[0.02]" : "hover:border-border/80"
                }`}
              >
                <CardHeader className="pb-3 flex flex-row items-start justify-between gap-2">
                  <div className="grid gap-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm tracking-tight">{item.name}</span>
                      {isDefault && (
                        <Badge className="bg-primary/20 text-primary border-primary/30 text-[10px] gap-1 font-semibold">
                          <Check className="size-3" /> Padrão Primeiro Atendimento
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                      <span>Portuguese (BR) ({item.language})</span>
                      <span>•</span>
                      <span>{item.category || "MARKETING"}</span>
                    </div>
                  </div>

                  <Badge
                    variant={item.status === "APPROVED" ? "default" : "secondary"}
                    className={`text-[10px] ${
                      item.status === "APPROVED"
                        ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
                        : "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30"
                    }`}
                  >
                    {item.status === "APPROVED" ? "APROVADO (APPROVED)" : item.status}
                  </Badge>
                </CardHeader>

                <CardContent className="space-y-3 text-xs">
                  {/* Body Text Box */}
                  <div className="rounded-lg border bg-muted/30 p-3 font-mono text-[11px] leading-relaxed text-foreground/90 whitespace-pre-wrap">
                    {item.bodyText || "Conteúdo do modelo sem prévia disponível."}
                  </div>

                  {/* Variables listing and action buttons */}
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1 border-t gap-2 flex-wrap">
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium text-foreground">Variáveis:</span>
                      <code className="bg-muted px-1.5 py-0.5 rounded font-mono text-[10px] text-primary">
                        {"{{nome}}"}
                      </code>
                      <code className="bg-muted px-1.5 py-0.5 rounded font-mono text-[10px] text-primary">
                        {"{{nome_bot}}"}
                      </code>
                    </div>

                    <div className="flex items-center gap-1 ml-auto">
                      {!isDefault && item.status === "APPROVED" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleSetDefault(item)}
                          className="h-7 text-xs text-primary hover:text-primary hover:bg-primary/10 gap-1 px-2"
                        >
                          <CheckCircle2 className="size-3.5" />
                          Definir como Padrão
                        </Button>
                      )}

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(item)}
                        className="h-7 text-xs text-destructive hover:text-destructive hover:bg-destructive/10 gap-1 px-2"
                      >
                        <Trash2 className="size-3.5" />
                        Excluir
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Modal / Form de Novo Modelo */}
      <Dialog open={newModalOpen} onOpenChange={setNewModalOpen}>
        <DialogPopup className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold">
              <FileText className="size-5 text-primary" />
              Novo Modelo de Mensagem Meta
            </DialogTitle>
            <DialogDescription className="text-xs">
              Cadastre um modelo de mensagem aprovado pela Meta para uso no disparo de primeiro atendimento.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2 text-xs">
            <div className="grid gap-1.5">
              <Label htmlFor="tpl-name" className="text-xs font-semibold">Nome do Modelo</Label>
              <Input
                id="tpl-name"
                defaultValue="lead_first_contact"
                className="h-9 text-xs font-mono"
                placeholder="ex.: lead_first_contact"
              />
              <span className="text-[10px] text-muted-foreground">Use apenas letras minúsculas e sublinhados (_).</span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label className="text-xs font-semibold">Idioma</Label>
                <Input value="Portuguese (BR) - pt_BR" readOnly className="h-9 text-xs bg-muted/40" />
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs font-semibold">Categoria Meta</Label>
                <Input value="MARKETING" readOnly className="h-9 text-xs bg-muted/40" />
              </div>
            </div>

            <div className="grid gap-1.5">
              <Label className="text-xs font-semibold">Corpo da Mensagem (Body)</Label>
              <textarea
                rows={4}
                defaultValue="Olá {{nome}}! Me chamo {{nome_bot}}. Recebemos sua solicitação de atendimento sobre planos de saúde pela Âncora Saúde. Para encaminhar você ao especialista mais adequado, gostaríamos de fazer algumas perguntas rápidas por aqui. Como deseja continuar?"
                className="w-full rounded-md border border-border bg-background p-2.5 text-xs font-mono text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
              <span className="text-[10px] text-muted-foreground">
                Variáveis suportadas: {"{{nome}}"} (nome do cliente), {"{{nome_bot}}"} (nome do atendente/corretora).
              </span>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <DialogClose render={<Button variant="ghost" size="sm">Cancelar</Button>} />
            <Button
              size="sm"
              onClick={() => {
                toast.success("Modelo salvo com sucesso!");
                loadTemplates();
                setNewModalOpen(false);
              }}
            >
              Salvar Modelo
            </Button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>
    </div>
  );
}
