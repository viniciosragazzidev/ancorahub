"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { CheckCircle, Gear, Plus, ShieldCheck, Trash, Warning } from "@/components/huge-icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogClose, DialogFooter, DialogHeader, DialogPanel, DialogPopup, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { archiveCustomRoleAction, saveCustomRoleAction } from "./actions";

type Capability = { key: string; label: string; description: string; category: string; delegable: boolean; scopes: readonly string[] };
type Role = { id: string; name: string; description: string | null; color: string; icon: string; scope: "none" | "own" | "branch" | "tenant"; status: "draft" | "active" | "archived"; version: number; updatedAt: Date; memberCount: number; permissions: string[] };

export function CustomRolesWorkspace({ enabled, catalog, roles }: { enabled: boolean; catalog: Capability[]; roles: Role[] }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | Role["status"]>("all");
  const [editing, setEditing] = useState<Role | null>(null);
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const visible = roles.filter((role) => (filter === "all" || role.status === filter) && `${role.name} ${role.description ?? ""}`.toLocaleLowerCase("pt-BR").includes(query.toLocaleLowerCase("pt-BR")));

  function archive(role: Role) {
    startTransition(async () => {
      try { await archiveCustomRoleAction(role.id); toast.success(`Cargo ${role.name} arquivado. Os membros voltaram ao perfil legado.`); }
      catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível arquivar o cargo."); }
    });
  }

  return <main className="flex flex-1 flex-col gap-6 p-4 lg:p-6">
    <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-medium text-primary">GESTÃO DE EQUIPE</p><h1 className="mt-1 text-2xl font-semibold tracking-tight">Cargos e permissões</h1><p className="mt-1 max-w-2xl text-sm text-muted-foreground">Crie cargos próprios sem conceder acesso operacional por herança. Cada permissão informa o que libera e onde funciona.</p></div><Button disabled={!enabled} onClick={() => { setEditing(null); setOpen(true); }}><Plus /> Novo cargo</Button></section>
    {!enabled ? <Card className="border-warning/30 bg-warning/10 shadow-none"><CardContent className="flex items-start gap-3 p-4"><Warning className="mt-0.5 size-5 text-warning" /><div><p className="font-medium">Piloto ainda não liberado</p><p className="mt-1 text-sm text-muted-foreground">Peça ao Super-admin para habilitar Cargos personalizados para esta empresa. Nenhum acesso existente será alterado.</p></div></CardContent></Card> : null}
    <div className="flex flex-col gap-3 sm:flex-row"><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar cargo por nome ou descrição..." className="sm:max-w-sm" /><Select value={filter} onValueChange={(value) => setFilter((value ?? "all") as typeof filter)}><SelectTrigger className="w-full sm:w-44"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Todos os estados</SelectItem><SelectItem value="active">Ativos</SelectItem><SelectItem value="draft">Rascunhos</SelectItem><SelectItem value="archived">Arquivados</SelectItem></SelectContent></Select></div>
    <div className="grid gap-3 xl:grid-cols-2">{visible.map((role) => <Card key={role.id} className="border-border bg-card shadow-none"><CardContent className="flex gap-4 p-5"><div className="rounded-lg bg-primary/10 p-2 text-primary"><ShieldCheck className="size-5" /></div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="font-semibold">{role.name}</p><Badge variant={role.status === "active" ? "success" : role.status === "archived" ? "outline" : "warning"}>{role.status === "active" ? "Ativo" : role.status === "archived" ? "Arquivado" : "Rascunho"}</Badge></div><p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{role.description || "Sem descrição."}</p><p className="mt-3 text-xs text-muted-foreground">{role.memberCount} usuário(s) · {role.permissions.length} permissões · Escopo {scopeLabel(role.scope)}</p><div className="mt-4 flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={() => { setEditing(role); setOpen(true); }}><Gear /> Editar</Button><Button size="sm" variant="outline" disabled={role.status === "archived" || pending} onClick={() => archive(role)}><Trash /> Arquivar</Button></div></div></CardContent></Card>)}{!visible.length ? <Card className="border-dashed shadow-none xl:col-span-2"><CardContent className="p-10 text-center"><ShieldCheck className="mx-auto size-7 text-muted-foreground" /><p className="mt-3 font-medium">Nenhum cargo encontrado</p><p className="mt-1 text-sm text-muted-foreground">Crie um cargo para começar a compor acessos específicos da empresa.</p></CardContent></Card> : null}</div>
    <RoleEditor open={open} onOpenChange={setOpen} editing={editing} catalog={catalog} enabled={enabled} />
  </main>;
}

function RoleEditor({ open, onOpenChange, editing, catalog, enabled }: { open: boolean; onOpenChange: (open: boolean) => void; editing: Role | null; catalog: Capability[]; enabled: boolean }) {
  const [scope, setScope] = useState<Role["scope"]>(editing?.scope ?? "none");
  const [selected, setSelected] = useState<string[]>(editing?.permissions ?? []);
  const [pending, startTransition] = useTransition();
  const available = useMemo(() => catalog.filter((item) => item.scopes.includes(scope)), [catalog, scope]);
  const grouped = useMemo(() => Object.entries(Object.groupBy(available, (item) => item.category)), [available]);
  function toggle(key: string) { setSelected((current) => current.includes(key) ? current.filter((item) => item !== key) : [...current, key]); }
  function submit(formData: FormData) { const payload = { id: editing?.id, name: formData.get("name"), description: formData.get("description"), color: "primary", icon: "shield", scope, permissions: selected, status: formData.get("status") }; startTransition(async () => { try { await saveCustomRoleAction(payload); toast.success(editing ? "Cargo atualizado." : "Cargo criado."); onOpenChange(false); } catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível salvar o cargo."); } }); }
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogPopup className="max-w-4xl p-0"><DialogPanel><DialogHeader className="border-b border-border p-6"><DialogTitle>{editing ? `Editar ${editing.name}` : "Novo cargo"}</DialogTitle><p className="text-sm text-muted-foreground">Defina um escopo seguro antes de selecionar permissões. Cargos personalizados substituem permissões herdadas.</p></DialogHeader><form action={submit}><div className="max-h-[65dvh] overflow-y-auto p-6"><div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="role-name">Nome</Label><Input id="role-name" name="name" required defaultValue={editing?.name ?? ""} placeholder="Ex.: Marketing" /></div><div className="space-y-2"><Label htmlFor="role-status">Estado</Label><Select name="status" defaultValue={editing?.status === "active" ? "active" : "draft"}><SelectTrigger id="role-status"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="draft">Rascunho</SelectItem><SelectItem value="active">Ativo</SelectItem></SelectContent></Select></div><div className="space-y-2 sm:col-span-2"><Label htmlFor="role-description">Descrição</Label><Input id="role-description" name="description" defaultValue={editing?.description ?? ""} placeholder="Explique em uma frase o objetivo deste cargo." /></div></div><div className="mt-6 space-y-2"><Label>Escopo operacional</Label><Select value={scope} onValueChange={(value) => { const next = value as Role["scope"]; setScope(next); setSelected((current) => current.filter((key) => catalog.some((item) => item.key === key && item.scopes.includes(next)))); }}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Sem acesso operacional</SelectItem><SelectItem value="own">Carteira própria</SelectItem><SelectItem value="branch">Unidade vinculada</SelectItem><SelectItem value="tenant">Dados não operacionais da empresa</SelectItem></SelectContent></Select><p className="text-xs text-muted-foreground">O escopo limita as permissões disponíveis e não pode conceder visão global de Diretor.</p></div><div className="mt-6 space-y-4"><div className="flex items-end justify-between gap-3"><div><Label>Permissões</Label><p className="mt-1 text-xs text-muted-foreground">{selected.length} selecionada(s). Selecione apenas o necessário.</p></div><Badge variant="outline">{scopeLabel(scope)}</Badge></div>{grouped.map(([category, items]) => <section key={category} className="rounded-lg border border-border"><div className="border-b border-border px-4 py-3"><p className="text-sm font-semibold">{category}</p></div><div className="divide-y divide-border">{items?.map((item) => <label className="flex cursor-pointer items-start gap-3 px-4 py-3 hover:bg-muted/30" key={item.key}><Checkbox checked={selected.includes(item.key)} onCheckedChange={() => toggle(item.key)} /><span><span className="text-sm font-medium">{item.label}</span><span className="mt-0.5 block text-xs text-muted-foreground">{item.description}</span></span></label>)}</div></section>)}</div></div><DialogFooter className="border-t border-border px-6 py-4"><DialogClose render={<Button variant="outline">Cancelar</Button>} /><Button disabled={!enabled || pending} type="submit">{pending ? "Salvando…" : <><CheckCircle /> Salvar cargo</>}</Button></DialogFooter></form></DialogPanel></DialogPopup></Dialog>;
}

function scopeLabel(scope: Role["scope"]) { return ({ none: "sem operação", own: "carteira", branch: "unidade", tenant: "empresa" } as const)[scope]; }
