"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Copy, HelpCircle, LinkSimple, Plus, ShieldCheck, Trash } from "@/components/huge-icons";
import { FlaskConical } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogClose, DialogDescription, DialogPopup, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { createIntegrationAction, getIntegrationsData, revokeIntegrationAction, toggleIntegrationAction, type IntegrationRecord } from "../integrations-actions";

type Branch = { id: string; name: string };
type Props = { integrations: IntegrationRecord[]; branches: Branch[] };
type QueryData = { integrations: IntegrationRecord[]; branches: Branch[] };

const sourceLabel: Record<string, string> = { site_pixel: "Pixel / Site", landing_page: "Landing page" };

export function IntegrationsTab({ integrations, branches }: Props) {
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(integrations[0]?.id ?? null);
  const [createOpen, setCreateOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [revealedToken, setRevealedToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [testOpen, setTestOpen] = useState(false);
  const [testStatus, setTestStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [testResult, setTestResult] = useState<{ leadId?: string; code?: string; message?: string } | null>(null);
  const testNameRef = useRef<HTMLInputElement>(null);
  const testPhoneRef = useRef<HTMLInputElement>(null);
  const testEmailRef = useRef<HTMLInputElement>(null);

  async function handleTest(e: React.FormEvent) {
    e.preventDefault();
    if (!selected || !revealedToken) return;
    setTestStatus("loading");
    setTestResult(null);
    try {
      const res = await fetch("/api/webhooks/leads/" + encodeURIComponent(revealedToken), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": "test-" + Date.now(),
        },
        body: JSON.stringify({
          nome: testNameRef.current?.value || "Lead de Teste",
          telefone: testPhoneRef.current?.value || "+5511999999999",
          email: testEmailRef.current?.value || undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setTestStatus("success");
        setTestResult({ leadId: data.data?.leadId });
        toast.success("Lead de teste criado com sucesso!");
      } else {
        setTestStatus("error");
        setTestResult({ code: data.error?.code, message: data.error?.message });
      }
    } catch {
      setTestStatus("error");
      setTestResult({ code: "NETWORK_ERROR", message: "Sem conexão com o servidor." });
    }
  }

  const query = useQuery<QueryData>({ queryKey: ["settings-integrations"], queryFn: async () => ({ integrations, branches }), initialData: { integrations, branches }, staleTime: 30_000 });
  const data = query.data;
  const selected = data.integrations.find((item) => item.id === selectedId) ?? data.integrations[0] ?? null;

  const createMutation = useMutation({
    mutationFn: async (formData: FormData) => createIntegrationAction({}, formData),
    onMutate: async (formData) => {
      await queryClient.cancelQueries({ queryKey: ["settings-integrations"] });
      const previous = queryClient.getQueryData<QueryData>(["settings-integrations"]);
      const branchId = String(formData.get("branchId") ?? "") || null;
      const optimistic: IntegrationRecord = { id: `temp-${crypto.randomUUID()}`, name: String(formData.get("name") ?? "Nova fonte"), source: String(formData.get("source") ?? "site_pixel"), branchId, branchName: data.branches.find((branch) => branch.id === branchId)?.name ?? null, status: "active", tokenPrefix: "sincronizando⬦", createdAt: new Date() };
      queryClient.setQueryData<QueryData>(["settings-integrations"], { ...data, integrations: [optimistic, ...data.integrations] });
      setSelectedId(optimistic.id);
      setCreateOpen(false);
      return { previous, optimisticId: optimistic.id };
    },
    onSuccess: (result, _formData, context) => {
      if (!result.success || !result.integration || !context) { toast.error(result.error ?? "Não foi possível criar a integração."); return; }
      queryClient.setQueryData<QueryData>(["settings-integrations"], (current) => current ? { ...current, integrations: current.integrations.map((item) => item.id === context.optimisticId ? { ...result.integration!, branchName: current.branches.find((branch) => branch.id === result.integration!.branchId)?.name ?? null } : item) } : current);
      setSelectedId(result.integration.id);
      setRevealedToken(result.token ?? null);
      toast.success("Fonte de captura criada.");
    },
    onError: (_error, _formData, context) => { if (context?.previous) queryClient.setQueryData(["settings-integrations"], context.previous); toast.error("Não foi possível criar a integração."); },
  });

  const toggleMutation = useMutation({
    mutationFn: async (id: string) => { const form = new FormData(); form.set("id", id); return toggleIntegrationAction(form); },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ["settings-integrations"] });
      const previous = queryClient.getQueryData<QueryData>(["settings-integrations"]);
      queryClient.setQueryData<QueryData>(["settings-integrations"], (current) => current ? { ...current, integrations: current.integrations.map((item) => item.id === id ? { ...item, status: item.status === "active" ? "revoked" : "active" } : item) } : current);
      return { previous };
    },
    onSuccess: (result) => { if (!result.success) { queryClient.invalidateQueries({ queryKey: ["settings-integrations"] }); toast.error(result.error); return; } toast.success("Status da integração atualizado."); },
    onError: (_error, _id, context) => { if (context?.previous) queryClient.setQueryData(["settings-integrations"], context.previous); toast.error("Não foi possível atualizar o status."); },
  });

  const revokeMutation = useMutation({
    mutationFn: async (id: string) => { const form = new FormData(); form.set("id", id); return revokeIntegrationAction(form); },
    onSuccess: (_result, id) => { queryClient.setQueryData<QueryData>(["settings-integrations"], (current) => current ? { ...current, integrations: current.integrations.filter((item) => item.id !== id) } : current); setSelectedId(null); toast.success("Integração revogada."); },
    onError: () => toast.error("Não foi possível revogar a integração."),
  });

  const snippet = useMemo(() => {
    if (!selected) return "";
    const origin = typeof window !== "undefined" ? window.location.origin : "https://app.corretop.com.br";
    const token = revealedToken ?? `${selected.tokenPrefix}⬢⬢⬢⬢⬢⬢⬢⬢`;
    return `<form data-corretop-form>
  <input type="text" name="nome" placeholder="Seu nome" required>
  <input type="tel" name="telefone" placeholder="Telefone" required>
  <input type="email" name="email" placeholder="E-mail">
  <select name="plano_interesse">
    <option value="individual">Individual</option>
    <option value="familiar">Familiar</option>
  </select>
  <!-- Honeypot — invisível ao visitante, bots preenchem -->
  <input type="text" name="website" style="display:none" tabindex="-1" autocomplete="off">
  <button type="submit">Quero uma cotação</button>
</form>

<script
  src="${origin}/embed/lead-form.js"
  data-token="${token}"></script>`;
  }, [revealedToken, selected]);

  async function copySnippet() { await navigator.clipboard.writeText(snippet); setCopied(true); window.setTimeout(() => setCopied(false), 1400); }

  return <Tabs className="gap-5" defaultValue="sources">
    <TabsList variant="line" className="w-full justify-start border-b border-border">
      <TabsTrigger value="sources"><LinkSimple /> Webhooks & Pixels</TabsTrigger>
    </TabsList>
    <TabsContent value="sources" className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <Card className="border-border bg-card shadow-none">
        <CardHeader className="flex-row items-start justify-between gap-4 border-b border-border"><div className="flex items-center gap-2"><CardTitle>Fontes de captura</CardTitle><button type="button" onClick={() => setHelpOpen(true)} className="text-muted-foreground hover:text-foreground transition-colors" title="Como integrar em um site externo?"><HelpCircle className="size-4" /></button></div><Button onClick={() => setCreateOpen(true)} size="sm"><Plus /> Nova fonte</Button></CardHeader>
        <CardContent className="p-0"><div className="divide-y divide-border">
          {data.integrations.map((item) => <button className={`grid w-full grid-cols-[1fr_auto] gap-3 px-5 py-4 text-left transition-colors hover:bg-muted/40 ${selected?.id === item.id ? "bg-muted/30" : ""}`} key={item.id} onClick={() => setSelectedId(item.id)} type="button"><span className="min-w-0"><span className="flex items-center gap-2"><span className="truncate text-sm font-medium">{item.name}</span>{item.id.startsWith("temp-") ? <Badge variant="secondary">Sincronizando</Badge> : null}</span><span className="mt-1 block text-xs text-muted-foreground">{sourceLabel[item.source] ?? item.source} · {item.branchName ?? "Primeira filial ativa"}</span></span><span className="flex items-center gap-3"><span className={`size-2 rounded-full ${item.status === "active" ? "bg-emerald-400" : "bg-muted-foreground"}`} /><span className="text-xs text-muted-foreground">{item.status === "active" ? "Ativo" : "Inativo"}</span></span></button>)}
          {!data.integrations.length ? <div className="p-10 text-center"><ShieldCheck className="mx-auto size-7 text-muted-foreground" /><p className="mt-3 text-sm font-medium">Nenhuma fonte configurada</p><p className="mt-1 text-xs text-muted-foreground">Crie um token para começar a receber leads automaticamente.</p></div> : null}
        </div></CardContent>
      </Card>
      {selected ? <Card className="h-fit border-border bg-card shadow-none"><CardHeader><CardTitle className="text-base">Configuração da fonte</CardTitle><CardDescription>{selected.name}</CardDescription></CardHeader><CardContent className="grid gap-4"><div className="grid gap-1"><span className="text-xs text-muted-foreground">Token</span><code className="rounded-md bg-muted px-2.5 py-2 text-xs">{selected.tokenPrefix}⬢⬢⬢⬢⬢⬢⬢⬢</code><span className="text-[11px] text-muted-foreground">O token completo só é exibido uma vez após a criação.</span></div><div className="flex items-center justify-between rounded-lg border border-border p-3"><div><p className="text-sm font-medium">Recebimento</p><p className="text-xs text-muted-foreground">{selected.status === "active" ? "Aceitando novos leads" : "Bloqueado"}</p></div><Button aria-label="Alternar status" onClick={() => toggleMutation.mutate(selected.id)} size="sm" variant="outline">{selected.status === "active" ? "Desativar" : "Ativar"}</Button></div><div className="grid gap-2"><div className="flex items-center justify-between"><span className="flex items-center gap-1 text-xs font-medium">Snippet de integração <button type="button" onClick={() => setHelpOpen(true)} className="text-muted-foreground hover:text-foreground transition-colors" title="Como integrar em um site externo?"><HelpCircle className="size-3.5" /></button></span><Button onClick={copySnippet} size="sm" variant="ghost">{copied ? <Check /> : <Copy />} {copied ? "Copiado" : "Copiar"}</Button></div><pre className="max-h-64 overflow-auto rounded-lg border border-border bg-muted/40 p-3 text-[11px] leading-5 text-muted-foreground">{snippet}</pre></div>

        {/* Painel de Teste */}
        <div className="rounded-lg border border-border">
          <button
            type="button"
            className="flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-muted/40"
            onClick={() => { setTestOpen((v) => !v); setTestStatus("idle"); setTestResult(null); }}
          >
            <span className="flex items-center gap-2 text-sm font-medium">
              <FlaskConical className="size-4 text-primary" />
              Testar integração
            </span>
            <span className="text-xs text-muted-foreground">{testOpen ? "Fechar" : "Abrir"}</span>
          </button>

          {testOpen && (
            <div className="border-t border-border p-4">
              {!revealedToken ? (
                <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 px-3 py-2.5">
                  <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">Token não disponível</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">O token completo só é visível logo após a criação da integração. Crie uma nova fonte para testar.</p>
                </div>
              ) : (
                <form onSubmit={handleTest} className="grid gap-3">
                  <div className="grid gap-1.5">
                    <label className="text-xs font-medium">Nome <span className="text-muted-foreground">(obrigatório)</span></label>
                    <Input ref={testNameRef} placeholder="Ex: Maria da Silva" defaultValue="Lead de Teste" className="h-8 text-xs" />
                  </div>
                  <div className="grid gap-1.5">
                    <label className="text-xs font-medium">Telefone <span className="text-muted-foreground">(obrigatório)</span></label>
                    <Input ref={testPhoneRef} placeholder="+5511999999999" defaultValue="+5511999999999" className="h-8 text-xs" />
                  </div>
                  <div className="grid gap-1.5">
                    <label className="text-xs font-medium">E-mail <span className="text-muted-foreground">(opcional)</span></label>
                    <Input ref={testEmailRef} type="email" placeholder="teste@email.com" className="h-8 text-xs" />
                  </div>

                  <Button type="submit" size="sm" disabled={testStatus === "loading"} className="w-full">
                    {testStatus === "loading" ? "Enviando..." : <><FlaskConical className="size-3.5" /> Enviar lead de teste</>}
                  </Button>

                  {testStatus === "success" && testResult && (
                    <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-3 py-2.5">
                      <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">Webhook funcionando!</p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground font-mono">Lead ID: {testResult.leadId}</p>
                    </div>
                  )}

                  {testStatus === "error" && testResult && (
                    <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-2.5">
                      <p className="text-xs font-semibold text-destructive">Falha no envio</p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">{testResult.code} — {testResult.message}</p>
                    </div>
                  )}
                </form>
              )}
            </div>
          )}
        </div>

        <Button className="w-full" onClick={() => revokeMutation.mutate(selected.id)} variant="destructive"><Trash /> Revogar integração</Button></CardContent></Card> : null}
    </TabsContent>
    <CreateIntegrationDialog branches={branches} open={createOpen} onOpenChange={setCreateOpen} onSubmit={(formData) => createMutation.mutate(formData)} pending={createMutation.isPending} />
    <HelpIntegrationDialog open={helpOpen} onOpenChange={setHelpOpen} />
  </Tabs>;
}

function CreateIntegrationDialog({ branches, open, onOpenChange, onSubmit, pending }: { branches: Branch[]; open: boolean; onOpenChange: (open: boolean) => void; onSubmit: (formData: FormData) => void; pending: boolean }) {
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogPopup className="sm:max-w-md"><DialogTitle>Nova fonte de captura</DialogTitle><DialogDescription>Gere um token seguro vinculado à corretora e, opcionalmente, a uma filial.</DialogDescription><form action={onSubmit} className="grid gap-4"><Field><FieldLabel htmlFor="integration-name">Nome da fonte</FieldLabel><Input id="integration-name" name="name" placeholder="Landing page - Filial Centro" required /></Field><Field><FieldLabel>Origem padrão</FieldLabel><Select defaultValue="site_pixel" name="source" labels={{ site_pixel: "Pixel / Site", landing_page: "Landing page" }}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="site_pixel">Pixel / Site</SelectItem><SelectItem value="landing_page">Landing page</SelectItem></SelectContent></Select></Field><Field><FieldLabel>Filial de destino</FieldLabel><Select name="branchId"><SelectTrigger className="w-full"><SelectValue placeholder="Primeira filial ativa" /></SelectTrigger><SelectContent>{branches.map((branch) => <SelectItem key={branch.id} value={branch.id}>{branch.name}</SelectItem>)}</SelectContent></Select></Field><div className="flex gap-2"><Button className="flex-1" disabled={pending} type="submit">{pending ? "Gerando token..." : "Gerar token"}</Button><DialogClose render={<Button disabled={pending} type="button" variant="ghost">Cancelar</Button>} /></div></form></DialogPopup></Dialog>;
}

function HelpIntegrationDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPopup className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogTitle>Como integrar com sua Landing Page</DialogTitle>
        <DialogDescription>
          Cole um snippet no seu site e comece a receber leads automaticamente no CorreTop.
        </DialogDescription>

        <div className="mt-4 space-y-5 text-xs leading-relaxed text-muted-foreground">
          {/* Passo 1 */}
          <div className="space-y-1.5">
            <h4 className="flex items-center gap-2 font-bold text-foreground">
              <span className="grid size-6 place-items-center rounded-full border border-primary/15 bg-primary/[0.07] text-[10px] font-semibold text-primary">1</span>
              Adicione <code>data-corretop-form</code> no seu formulário
            </h4>
            <p>No construtor da sua LP, adicione o atributo <code>data-corretop-form</code> no elemento {"<form>"}. Use os nomes de campo:</p>
            <div className="mt-2 space-y-1">
              <div><code className="rounded bg-muted px-1 py-0.5 text-[11px]">name="nome"</code> <span className="text-muted-foreground">— nome completo (obrigatório)</span></div>
              <div><code className="rounded bg-muted px-1 py-0.5 text-[11px]">name="telefone"</code> <span className="text-muted-foreground">— telefone com DDD (obrigatório)</span></div>
              <div><code className="rounded bg-muted px-1 py-0.5 text-[11px]">name="email"</code> <span className="text-muted-foreground">— e-mail (opcional)</span></div>
              <div><code className="rounded bg-muted px-1 py-0.5 text-[11px]">name="plano_interesse"</code> <span className="text-muted-foreground">— plano desejado (opcional)</span></div>
            </div>
            <p className="mt-2">Se os campos da sua LP já usam nomes diferentes, mapeie com <code>data-corretop-field="nome"</code> em cada input:</p>
            <pre className="rounded-lg border border-border bg-muted/40 p-3 text-[11px] leading-5 text-foreground overflow-x-auto">
{`<form data-corretop-form>
  <input data-corretop-field="nome" name="full_name" required>
  <input data-corretop-field="telefone" name="phone_number" required>
  <input data-corretop-field="email" name="email_address">
</form>`}
            </pre>
          </div>

          {/* Passo 2 */}
          <div className="space-y-1.5">
            <h4 className="flex items-center gap-2 font-bold text-foreground">
              <span className="grid size-6 place-items-center rounded-full border border-primary/15 bg-primary/[0.07] text-[10px] font-semibold text-primary">2</span>
              Cole o script antes do {"</body>"}
            </h4>
            <p>Copie o snippet abaixo e cole antes do {"</body>"} da página. Substitua <code>SEU_TOKEN</code> pelo token gerado:</p>
            <pre className="rounded-lg border border-border bg-muted/40 p-3 text-[11px] leading-5 text-foreground overflow-x-auto">
{`<script
  src="https://app.corretop.com.br/embed/lead-form.js"
  data-token="SEU_TOKEN"></script>`}
            </pre>
            <p>O script é <strong>estático e versionado</strong> — funciona em qualquer construtor (WordPress, Wix, HTML puro, React, etc.).</p>
          </div>

          {/* Passo 3 */}
          <div className="space-y-1.5">
            <h4 className="flex items-center gap-2 font-bold text-foreground">
              <span className="grid size-6 place-items-center rounded-full border border-primary/15 bg-primary/[0.07] text-[10px] font-semibold text-primary">3</span>
              Redirecionamento pós-submit (opcional)
            </h4>
            <p>Para redirecionar o visitante após o envio, adicione <code>data-redirect</code> no script:</p>
            <pre className="rounded-lg border border-border bg-muted/40 p-3 text-[11px] leading-5 text-foreground overflow-x-auto">
{`<script
  src="https://app.corretop.com.br/embed/lead-form.js"
  data-token="SEU_TOKEN"
  data-redirect="/obrigado"></script>`}
            </pre>
          </div>

          {/* Honeypot */}
          <div className="rounded-xl border border-border p-4">
            <h4 className="mb-2 font-bold text-foreground">Proteção contra bots (Honeypot)</h4>
            <p>O formulário inclui um campo invisível <code>name="website"</code>. Bots de spam preenchem campos ocultos — se vier preenchido, o lead é descartado silenciosamente.</p>
            <pre className="mt-2 rounded-lg border border-border bg-muted/40 p-3 text-[11px] leading-5 text-foreground overflow-x-auto">
{`<input type="text" name="website"
  style="display:none" tabindex="-1"
  autocomplete="off">`}
            </pre>
          </div>

          {/* Segurança */}
          <div className="rounded-xl border border-border p-4">
            <h4 className="mb-2 font-bold text-foreground">Segurança</h4>
            <ul className="space-y-1 text-foreground">
              <li>O token só pode <strong>criar</strong> leads — nunca ler ou exportar dados.</li>
              <li>Rate limiting ativo por token.</li>
              <li>Se o token for comprometido, revogue na tela de configurações.</li>
            </ul>
          </div>

          {/* Respostas */}
          <div className="rounded-xl border border-border p-4">
            <h4 className="mb-2 font-bold text-foreground">Códigos de resposta</h4>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-foreground">
              <span><code className="rounded bg-emerald-500/10 px-1 py-0.5 text-[11px] text-emerald-600">201</code> Lead criado com sucesso</span>
              <span><code className="rounded bg-emerald-500/10 px-1 py-0.5 text-[11px] text-emerald-600">200</code> Lead duplicado (idempotente)</span>
              <span><code className="rounded bg-amber-500/10 px-1 py-0.5 text-[11px] text-amber-600">401</code> Token inválido</span>
              <span><code className="rounded bg-amber-500/10 px-1 py-0.5 text-[11px] text-amber-600">422</code> Dados inválidos</span>
              <span><code className="rounded bg-amber-500/10 px-1 py-0.5 text-[11px] text-amber-600">409</code> Conflito de idempotência</span>
              <span><code className="rounded bg-red-500/10 px-1 py-0.5 text-[11px] text-red-600">500</code> Erro interno</span>
            </div>
          </div>

          {/* Teste com curl */}
          <div className="space-y-1.5">
            <h4 className="flex items-center gap-2 font-bold text-foreground">
              <span className="grid size-6 place-items-center rounded-full border border-primary/15 bg-primary/[0.07] text-[10px] font-semibold text-primary">4</span>
              Testar com curl
            </h4>
            <pre className="rounded-lg border border-border bg-muted/40 p-3 text-[11px] leading-5 text-foreground overflow-x-auto">
{`curl -X POST \\
  "https://app.corretop.com.br/api/webhooks/leads/SEU_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{"nome":"Maria","telefone":"+5521999999999"}'`}
            </pre>
          </div>
        </div>

        <div className="mt-5 flex items-center justify-between">
          <Button render={<Link href="/guia/webhook" />} size="sm" variant="ghost">
            Ver tutorial completo
          </Button>
          <DialogClose render={<Button type="button">Fechar</Button>} />
        </div>
      </DialogPopup>
    </Dialog>
  );
}
