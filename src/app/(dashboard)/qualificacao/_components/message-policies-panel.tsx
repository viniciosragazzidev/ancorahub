"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, PencilSimple, Plus, Trash } from "@/components/huge-icons";
import { Info } from "lucide-react";
import { toast } from "@/components/ui/sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogDescription, DialogHeader, DialogPopup, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  deleteFreeMessageTemplateAction,
  fetchMessageEventPoliciesAction,
  saveFreeMessageTemplateAction,
  saveMessageEventPolicyAction,
} from "@/features/ai-qualification/actions";

type ResourceKind = "meta_template" | "free_message";
type Policy = {
  id: string;
  primaryKind: ResourceKind;
  metaTemplateId: string | null;
  freeMessageTemplateId: string | null;
  fallbackKind: ResourceKind | null;
  active: boolean;
  version: number;
};
type EventItem = {
  key: string;
  label: string;
  description: string;
  audience: "lead" | "client" | "user";
  windowRule: "meta_required_without_window" | "corporate_internal";
  variables: Array<{ key: string; label: string; urlOnly?: boolean }>;
  policy: Policy | null;
};
type MetaTemplate = { id: string; name: string; language: string; category: string; status: string; variables: string[] };
type FreeMessage = { id: string; name: string; category: string; content: string; variables: string[] };
type StudioData = { globallyEnabled: boolean; loadError?: string; events: EventItem[]; metaTemplates: MetaTemplate[]; freeMessages: FreeMessage[] };
type Draft = {
  primaryKind: ResourceKind;
  metaTemplateId: string;
  freeMessageTemplateId: string;
  fallbackKind: ResourceKind | "none";
  active: boolean;
};

const emptyDraft: Draft = {
  primaryKind: "meta_template",
  metaTemplateId: "",
  freeMessageTemplateId: "",
  fallbackKind: "none",
  active: false,
};

function policyToDraft(policy: Policy | null): Draft {
  return policy ? {
    primaryKind: policy.primaryKind,
    metaTemplateId: policy.metaTemplateId ?? "",
    freeMessageTemplateId: policy.freeMessageTemplateId ?? "",
    fallbackKind: policy.fallbackKind ?? "none",
    active: policy.active,
  } : emptyDraft;
}

export function MessagePoliciesPanel({
  canManage,
  preferredMetaTemplateId,
  preferredEventKey,
  onPreferredMetaTemplateApplied,
}: {
  canManage: boolean;
  preferredMetaTemplateId: string | null;
  preferredEventKey: string | null;
  onPreferredMetaTemplateApplied: () => void;
}) {
  const [data, setData] = useState<StudioData | null>(null);
  const [selectedEventKey, setSelectedEventKey] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [freeEditorOpen, setFreeEditorOpen] = useState(false);
  const [editingFree, setEditingFree] = useState<FreeMessage | null>(null);
  const [freeName, setFreeName] = useState("");
  const [freeCategory, setFreeCategory] = useState("operacional");
  const [freeContent, setFreeContent] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const result = await Promise.race<StudioData>([
        fetchMessageEventPoliciesAction() as Promise<StudioData>,
        new Promise<StudioData>((_, reject) => {
          window.setTimeout(() => reject(new Error("A configuração demorou mais que o esperado. Tente novamente.")), 12_000);
        }),
      ]);
      setData(result);
      setSelectedEventKey((current) => current ?? result.events[0]?.key ?? null);
      setDrafts(Object.fromEntries(result.events.map((event) => [event.key, policyToDraft(event.policy)])));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Não foi possível carregar as situações.";
      setLoadError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!preferredMetaTemplateId || !data?.events.length) return;

    // O template pode ser escolhido enquanto a lista de situações ainda está
    // carregando. Nesse caso, usa a primeira situação como destino explícito,
    // em vez de fechar o drawer e perder a ação.
    const eventKey = preferredEventKey && data.events.some((event) => event.key === preferredEventKey)
      ? preferredEventKey
      : selectedEventKey ?? data.events[0].key;
    setSelectedEventKey(eventKey);

    setDrafts((current) => ({
      ...current,
      [eventKey]: {
        ...(current[eventKey] ?? emptyDraft),
        primaryKind: "meta_template",
        metaTemplateId: preferredMetaTemplateId,
        active: true,
      },
    }));
    window.setTimeout(() => {
      const target = document.getElementById("message-situations");
      const scrollFrame = document.querySelector<HTMLElement>('[data-slot="app-scroll-frame"]');
      if (!target || !scrollFrame) return;
      const targetTop = target.getBoundingClientRect().top - scrollFrame.getBoundingClientRect().top + scrollFrame.scrollTop - 24;
      scrollFrame.scrollTo({ top: Math.max(0, targetTop), behavior: "smooth" });
    }, 220);
    toast.info("Template selecionado. Revise a situação e clique em ‘Salvar e publicar’.");
    onPreferredMetaTemplateApplied();
  }, [data, onPreferredMetaTemplateApplied, preferredEventKey, preferredMetaTemplateId, selectedEventKey]);

  const selectedEvent = data?.events.find((event) => event.key === selectedEventKey) ?? null;
  const selectedDraft = selectedEventKey ? drafts[selectedEventKey] ?? emptyDraft : emptyDraft;
  const approvedTemplates = useMemo(() => data?.metaTemplates.filter((template) => template.status === "APPROVED") ?? [], [data]);

  function patchDraft(patch: Partial<Draft>) {
    if (!selectedEventKey) return;
    setDrafts((current) => ({ ...current, [selectedEventKey]: { ...(current[selectedEventKey] ?? emptyDraft), ...patch } }));
  }

  async function savePolicy() {
    if (!selectedEventKey || !canManage) return;
    setSaving(true);
    try {
      const result = await saveMessageEventPolicyAction({
        eventKey: selectedEventKey,
        primaryKind: selectedDraft.primaryKind,
        metaTemplateId: selectedDraft.metaTemplateId || null,
        freeMessageTemplateId: selectedDraft.freeMessageTemplateId || null,
        fallbackKind: selectedDraft.fallbackKind === "none" ? null : selectedDraft.fallbackKind,
        active: selectedDraft.active,
      });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success("Política publicada e conectada ao fluxo.");
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível salvar a política.");
    } finally {
      setSaving(false);
    }
  }

  function openFreeEditor(message?: FreeMessage) {
    setEditingFree(message ?? null);
    setFreeName(message?.name ?? "");
    setFreeCategory(message?.category ?? "operacional");
    setFreeContent(message?.content ?? "");
    setFreeEditorOpen(true);
  }

  async function saveFreeMessage() {
    try {
      await saveFreeMessageTemplateAction({ id: editingFree?.id, name: freeName, category: freeCategory, content: freeContent });
      toast.success(editingFree ? "Mensagem livre atualizada." : "Mensagem livre criada.");
      setFreeEditorOpen(false);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível salvar a mensagem.");
    }
  }

  async function removeFreeMessage(message: FreeMessage) {
    if (!window.confirm(`Remover a mensagem livre “${message.name}”?`)) return;
    try {
      await deleteFreeMessageTemplateAction(message.id);
      toast.success("Mensagem livre removida.");
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível remover a mensagem.");
    }
  }

  return (
    <div className="grid gap-6">
      <Card id="message-situations">
        <CardHeader>
          <CardTitle>Situações do fluxo</CardTitle>
          <CardDescription>
            Escolha a mensagem principal e uma contingência. O servidor aplica janela de 24 horas, canal corporativo e idempotência antes de enviar.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {data && !data.globallyEnabled ? (
            <div className="mb-4 rounded-lg border border-warning/30 bg-warning/5 p-3 text-sm text-muted-foreground">
              As políticas por situação estão pausadas pela plataforma. As configurações permanecem salvas e o envio usa o comportamento homologado anterior.
            </div>
          ) : null}
          {data?.loadError ? (
            <div className="mb-4 rounded-lg border border-warning/30 bg-warning/5 p-3 text-sm text-muted-foreground">
              {data.loadError}
            </div>
          ) : null}
          {loading ? (
            <p className="py-10 text-center text-sm text-muted-foreground" role="status">Carregando situações…</p>
          ) : loadError ? (
            <div className="grid gap-3 rounded-xl border border-destructive/20 bg-destructive/[0.03] p-6 text-center">
              <p className="text-sm font-medium">Não foi possível carregar as situações</p>
              <p className="text-sm text-muted-foreground">{loadError}</p>
              <div><Button type="button" variant="outline" onClick={() => void load()}>Tentar novamente</Button></div>
            </div>
          ) : !data ? (
            <p className="py-10 text-center text-sm text-muted-foreground" role="status">Nenhuma situação disponível.</p>
          ) : (
            <div className="grid overflow-hidden rounded-xl border bg-card xl:grid-cols-[19rem_minmax(0,1fr)]">
              <nav className="border-b bg-muted/20 p-2 xl:border-b-0 xl:border-r" aria-label="Situações disponíveis">
                {data.events.map((event) => (
                  <button
                    key={event.key}
                    type="button"
                    onClick={() => setSelectedEventKey(event.key)}
                    className={`flex min-h-12 w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors ${selectedEventKey === event.key ? "bg-background shadow-xs" : "text-muted-foreground hover:bg-background/70 hover:text-foreground"}`}
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{event.label}</span>
                      <span className="block truncate text-xs">{event.audience === "user" ? "Equipe" : "Cliente"}</span>
                    </span>
                    <span className={`size-2 shrink-0 rounded-full ${event.policy?.active ? "bg-success" : "bg-muted-foreground/30"}`} aria-label={event.policy?.active ? "Ativa" : "Inativa"} />
                  </button>
                ))}
              </nav>

              {selectedEvent ? (
                <div className="grid gap-5 p-4 sm:p-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h3 className="font-semibold">{selectedEvent.label}</h3>
                      <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{selectedEvent.description}</p>
                    </div>
                    <label className="flex items-center gap-2 text-sm font-medium">
                      <Switch disabled={!canManage} checked={selectedDraft.active} onCheckedChange={(checked) => patchDraft({ active: checked })} />
                      {selectedDraft.active ? "Ativa" : "Pausada"}
                    </label>
                  </div>

                  <div className="rounded-lg border bg-muted/15 p-3 text-xs text-muted-foreground">
                    <Info className="mr-2 inline-block size-4 align-text-bottom text-primary" aria-hidden="true" />
                    {selectedEvent.windowRule === "meta_required_without_window"
                      ? "Sem inbound nas últimas 24 horas, o sistema força um template Meta aprovado. Texto livre nunca abre uma conversa fora da janela."
                      : "Mensagem livre como principal exige o WhatsApp corporativo ativo. O WhatsApp pessoal do corretor nunca envia pelo CRM."}
                  </div>

                  <div className="grid gap-4 lg:grid-cols-2">
                    <div className="grid gap-2">
                      <Label>Mensagem principal</Label>
                      <Select disabled={!canManage} value={selectedDraft.primaryKind} onValueChange={(value) => value && patchDraft({ primaryKind: value as ResourceKind, fallbackKind: value === selectedDraft.fallbackKind ? "none" : selectedDraft.fallbackKind })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="meta_template">Template Meta oficial</SelectItem>
                          <SelectItem value="free_message">Mensagem livre</SelectItem>
                        </SelectContent>
                      </Select>
                      {selectedDraft.primaryKind === "meta_template" ? (
                        <Select disabled={!canManage} value={selectedDraft.metaTemplateId} onValueChange={(value) => value && patchDraft({ metaTemplateId: value })}>
                          <SelectTrigger><SelectValue placeholder="Escolha um template aprovado" /></SelectTrigger>
                          <SelectContent>{approvedTemplates.map((template) => <SelectItem key={template.id} value={template.id}>{template.name} · {template.language}</SelectItem>)}</SelectContent>
                        </Select>
                      ) : (
                        <Select disabled={!canManage} value={selectedDraft.freeMessageTemplateId} onValueChange={(value) => value && patchDraft({ freeMessageTemplateId: value })}>
                          <SelectTrigger><SelectValue placeholder="Escolha uma mensagem livre" /></SelectTrigger>
                          <SelectContent>{data.freeMessages.map((message) => <SelectItem key={message.id} value={message.id}>{message.name}</SelectItem>)}</SelectContent>
                        </Select>
                      )}
                    </div>

                    <div className="grid gap-2">
                      <Label>Contingência antes do aceite</Label>
                      <Select disabled={!canManage} value={selectedDraft.fallbackKind} onValueChange={(value) => value && patchDraft({ fallbackKind: value as Draft["fallbackKind"] })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Sem contingência</SelectItem>
                          {selectedDraft.primaryKind !== "meta_template" ? <SelectItem value="meta_template">Template Meta oficial</SelectItem> : null}
                          {selectedDraft.primaryKind !== "free_message" ? <SelectItem value="free_message">Mensagem livre</SelectItem> : null}
                        </SelectContent>
                      </Select>
                      {selectedDraft.fallbackKind === "meta_template" ? (
                        <Select disabled={!canManage} value={selectedDraft.metaTemplateId} onValueChange={(value) => value && patchDraft({ metaTemplateId: value })}>
                          <SelectTrigger><SelectValue placeholder="Escolha o template de contingência" /></SelectTrigger>
                          <SelectContent>{approvedTemplates.map((template) => <SelectItem key={template.id} value={template.id}>{template.name} · {template.language}</SelectItem>)}</SelectContent>
                        </Select>
                      ) : selectedDraft.fallbackKind === "free_message" ? (
                        <Select disabled={!canManage} value={selectedDraft.freeMessageTemplateId} onValueChange={(value) => value && patchDraft({ freeMessageTemplateId: value })}>
                          <SelectTrigger><SelectValue placeholder="Escolha a mensagem de contingência" /></SelectTrigger>
                          <SelectContent>{data.freeMessages.map((message) => <SelectItem key={message.id} value={message.id}>{message.name}</SelectItem>)}</SelectContent>
                        </Select>
                      ) : <p className="text-xs leading-5 text-muted-foreground">Nenhuma segunda mensagem será tentada automaticamente.</p>}
                    </div>
                  </div>

                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Variáveis disponíveis nesta situação</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {selectedEvent.variables.map((variable) => <Badge key={variable.key} variant="outline" className="font-mono">{`{{${variable.key}}}`}</Badge>)}
                    </div>
                  </div>

                  <div className="flex justify-end border-t pt-4">
                    <Button onClick={savePolicy} disabled={saving || !canManage}>
                      <Check className="mr-2 size-4" />
                      {saving ? "Publicando…" : "Salvar e publicar"}
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle>Mensagens livres</CardTitle>
            <CardDescription className="mt-1">Textos reutilizáveis permitidos na janela de atendimento ou pelo WhatsApp corporativo interno.</CardDescription>
          </div>
          {canManage ? <Button variant="outline" onClick={() => openFreeEditor()}><Plus className="mr-2 size-4" />Nova mensagem</Button> : null}
        </CardHeader>
        <CardContent>
          {!data?.freeMessages.length ? (
            <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">Nenhuma mensagem livre criada.</div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {data.freeMessages.map((message) => (
                <article key={message.id} className="rounded-xl border bg-card p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div><h3 className="font-medium">{message.name}</h3><p className="mt-0.5 text-xs text-muted-foreground">{message.category}</p></div>
                    {canManage ? <div className="flex gap-1">
                      <Button variant="ghost" size="icon-sm" aria-label={`Editar ${message.name}`} onClick={() => openFreeEditor(message)}><PencilSimple className="size-4" /></Button>
                      <Button variant="ghost" size="icon-sm" aria-label={`Remover ${message.name}`} onClick={() => removeFreeMessage(message)}><Trash className="size-4" /></Button>
                    </div> : null}
                  </div>
                  <p className="mt-3 line-clamp-4 whitespace-pre-wrap rounded-lg bg-muted/20 p-3 text-sm text-muted-foreground">{message.content}</p>
                </article>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={freeEditorOpen} onOpenChange={setFreeEditorOpen}>
        <DialogPopup className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{editingFree ? "Editar mensagem livre" : "Nova mensagem livre"}</DialogTitle>
            <DialogDescription>Use somente as variáveis exibidas na situação em que a mensagem será aplicada.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-2"><Label htmlFor="free-name">Nome</Label><Input id="free-name" value={freeName} onChange={(event) => setFreeName(event.target.value)} /></div>
            <div className="grid gap-2"><Label htmlFor="free-category">Categoria</Label><Input id="free-category" value={freeCategory} onChange={(event) => setFreeCategory(event.target.value)} /></div>
            <div className="grid gap-2"><Label htmlFor="free-content">Mensagem</Label><Textarea id="free-content" rows={7} value={freeContent} onChange={(event) => setFreeContent(event.target.value)} placeholder="Olá {{corretor_nome}}, um novo lead foi atribuído a você." /></div>
            <div className="flex justify-end gap-2 border-t pt-4"><Button variant="outline" onClick={() => setFreeEditorOpen(false)}>Cancelar</Button><Button onClick={saveFreeMessage}>Salvar mensagem</Button></div>
          </div>
        </DialogPopup>
      </Dialog>
    </div>
  );
}
