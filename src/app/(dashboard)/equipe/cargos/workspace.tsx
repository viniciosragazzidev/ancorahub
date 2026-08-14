"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import Link from "next/link";

import {
  CheckCircle,
  Gear,
  LockKey,
  Plus,
  ShieldCheck,
  Trash,
  UsersThree,
  Warning,
  X,
  PencilSimple,
} from "@/components/huge-icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogPopup, DialogTitle, DialogDescription, DialogClose } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { roleScopeLabel } from "@/features/custom-roles/member-scope";
import { archiveCustomRoleAction, saveCustomRoleAction } from "./actions";

// ── Types ────────────────────────────────────────────────────────────────────

type Capability = {
  key: string;
  label: string;
  description: string;
  category: string;
  delegable: boolean;
  scopes: readonly string[];
};

type Role = {
  id: string;
  name: string;
  description: string | null;
  color: string;
  icon: string;
  scope: "none" | "own" | "branch" | "tenant";
  status: "draft" | "active" | "archived";
  version: number;
  updatedAt: Date;
  memberCount: number;
  permissions: string[];
};

// ── Toggle Switch ─────────────────────────────────────────────────────────────

function PermissionToggle({
  checked,
  onChange,
  id,
}: {
  checked: boolean;
  onChange: () => void;
  id: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      id={id}
      onClick={onChange}
      className={[
        "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent",
        "transition-colors duration-150 ease-in-out focus-visible:outline-none focus-visible:ring-2",
        "focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        checked ? "bg-primary" : "bg-input hover:bg-input/80",
      ].join(" ")}
    >
      <span
        aria-hidden="true"
        className={[
          "pointer-events-none inline-block size-4 rounded-full bg-background shadow-sm",
          "ring-0 transition-transform duration-150 ease-in-out",
          checked ? "translate-x-4" : "translate-x-0",
        ].join(" ")}
      />
    </button>
  );
}

// ── Status badge helpers ──────────────────────────────────────────────────────

function StatusBadge({ status }: { status: Role["status"] }) {
  if (status === "active")
    return <Badge variant="success" className="text-[10px] px-1.5 py-0 font-medium">Ativo</Badge>;
  if (status === "archived")
    return <Badge variant="secondary" className="text-[10px] px-1.5 py-0 font-medium text-muted-foreground">Arquivado</Badge>;
  return <Badge variant="warning" className="text-[10px] px-1.5 py-0 font-medium">Rascunho</Badge>;
}

// ── Permission group row ──────────────────────────────────────────────────────

function PermissionRow({
  item,
  checked,
  onToggle,
}: {
  item: Capability;
  checked: boolean;
  onToggle: () => void;
}) {
  const switchId = `perm-${item.key}`;
  return (
    <div className="flex items-start justify-between gap-4 py-3 px-4 hover:bg-muted/30 transition-colors">
      <label htmlFor={switchId} className="flex-1 cursor-pointer min-w-0">
        <p className="text-xs font-semibold text-foreground leading-snug">{item.label}</p>
        <p className="mt-0.5 text-[11px] text-muted-foreground leading-relaxed">{item.description}</p>
      </label>
      <div className="pt-0.5 shrink-0">
        <PermissionToggle checked={checked} onChange={onToggle} id={switchId} />
      </div>
    </div>
  );
}

// ── Permission editor (Permissões tab) ────────────────────────────────────────

function PermissionsTab({
  scope,
  catalog,
  selected,
  onToggle,
}: {
  scope: Role["scope"];
  catalog: Capability[];
  selected: string[];
  onToggle: (key: string) => void;
}) {
  const available = useMemo(
    () => catalog.filter((item) => item.scopes.includes(scope)),
    [catalog, scope],
  );
  const grouped = useMemo(
    () =>
      Object.entries(
        available.reduce<Record<string, Capability[]>>((acc, item) => {
          if (!acc[item.category]) acc[item.category] = [];
          acc[item.category].push(item);
          return acc;
        }, {}),
      ),
    [available],
  );

  if (available.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-12 text-center px-4">
        <p className="text-xs text-muted-foreground">
          Nenhuma permissão disponível para o escopo selecionado.
          <br />
          Altere o escopo na aba <strong>Identidade</strong>.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 max-h-[50vh] overflow-y-auto pr-1">
      <p className="text-[11px] text-muted-foreground px-4 pt-2">
        {selected.length} de {available.length} permissões ativas. Ative apenas o necessário.
      </p>
      <div className="flex flex-col gap-3 px-4">
        {grouped.map(([category, items]) => {
          const catSelected = items.filter((item) => selected.includes(item.key)).length;
          return (
            <section
              key={category}
              className="rounded-lg border border-border overflow-hidden bg-card"
            >
              <div className="flex items-center justify-between border-b border-border bg-muted/40 px-4 py-2">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  {category}
                </p>
                <span className="text-[10px] font-bold text-muted-foreground tabular-nums bg-background px-1.5 py-0.5 rounded-full border border-border/50">
                  {catSelected}/{items.length}
                </span>
              </div>
              <div className="divide-y divide-border/60">
                {items.map((item) => (
                  <PermissionRow
                    key={item.key}
                    item={item}
                    checked={selected.includes(item.key)}
                    onToggle={() => onToggle(item.key)}
                  />
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

// ── Identidade tab ────────────────────────────────────────────────────────────

function IdentidadeTab({
  name,
  setName,
  description,
  setDescription,
  status,
  setStatus,
  scope,
  onScopeChange,
}: {
  name: string;
  setName: (v: string) => void;
  description: string;
  setDescription: (v: string) => void;
  status: "draft" | "active";
  setStatus: (v: "draft" | "active") => void;
  scope: Role["scope"];
  onScopeChange: (scope: Role["scope"]) => void;
}) {
  return (
    <div className="flex flex-col gap-4 px-4 pt-2 pb-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="role-name">Nome do cargo</Label>
          <Input
            id="role-name"
            name="name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex.: Operador de Suporte, Gerente…"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="role-status">Estado</Label>
          <Select value={status} onValueChange={(v) => { if (v) setStatus(v as "draft" | "active"); }}>
            <SelectTrigger id="role-status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="draft">Rascunho</SelectItem>
              <SelectItem value="active">Ativo</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="role-description">Descrição</Label>
          <Input
            id="role-description"
            name="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Explique resumidamente a atribuição desse cargo."
          />
        </div>
      </div>

      <Separator />

      <div className="space-y-1.5">
        <Label>Abrangência operacional do cargo</Label>
        <Select
          value={scope}
          onValueChange={(value) => {
            if (value) onScopeChange(value as Role["scope"]);
          }}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="tenant">Empresa inteira — Sem restrição ou vínculo obrigatório</SelectItem>
            <SelectItem value="branch">Uma unidade — Vincula o profissional à sua filial específica</SelectItem>
            <SelectItem value="own">Apenas os próprios dados — Visão restrita ao próprio trabalho</SelectItem>
            <SelectItem value="none">Administrativo/Sem operação — Não opera registros gerais</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-[11px] text-muted-foreground leading-normal">
          A abrangência define quais permissões estarão disponíveis e o isolamento de dados aplicado.
        </p>
      </div>
    </div>
  );
}

// ── Members tab ───────────────────────────────────────────────────────────────

function MembersTab({ role }: { role: Role | null }) {
  if (!role) return null;

  return (
    <div className="flex flex-col gap-3 px-4 pt-2 pb-4">
      {role.memberCount === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
          <UsersThree className="size-8 text-muted-foreground" />
          <p className="text-xs text-muted-foreground">
            Nenhum membro possui esse cargo vinculado ainda.
          </p>
          <Button variant="outline" size="sm" render={<Link href="/equipe" />}>
            Ir para Equipe
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            Este cargo está associado a <strong>{role.memberCount} membro(s)</strong> no sistema.
          </p>
          <div className="rounded-lg border border-border bg-muted/20 p-4 text-xs text-muted-foreground">
            Para gerenciar quais corretores ou colaboradores possuem este cargo, acesse a página de{" "}
            <Link href="/equipe" className="text-primary underline hover:text-primary/95">
              Equipe
            </Link>{" "}
            e altere o perfil do colaborador.
          </div>
        </div>
      )}
    </div>
  );
}

// ── Dialog Editor Panel ────────────────────────────────────────────────────────

function RoleEditorDialog({
  editing,
  catalog,
  enabled,
  open,
  onClose,
  onSaved,
}: {
  editing: Role | null;
  catalog: Capability[];
  enabled: boolean;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(editing?.name ?? "");
  const [description, setDescription] = useState(editing?.description ?? "");
  const [status, setStatus] = useState<"draft" | "active">(editing?.status === "active" ? "active" : "draft");
  const [scope, setScope] = useState<Role["scope"]>(editing?.scope ?? "tenant");
  const [selected, setSelected] = useState<string[]>(editing?.permissions ?? []);
  const [pending, startTransition] = useTransition();
  const [archivePending, startArchiveTransition] = useTransition();

  useEffect(() => {
    if (open) {
      setName(editing?.name ?? "");
      setDescription(editing?.description ?? "");
      setStatus(editing?.status === "active" ? "active" : "draft");
      setScope(editing?.scope ?? "tenant");
      setSelected(editing?.permissions ?? []);
    }
  }, [open, editing]);

  function togglePermission(key: string) {
    setSelected((current) =>
      current.includes(key)
        ? current.filter((item) => item !== key)
        : [...current, key],
    );
  }

  function handleScopeChange(next: Role["scope"]) {
    setScope(next);
    setSelected((current) =>
      current.filter((key) =>
        catalog.some((item) => item.key === key && item.scopes.includes(next)),
      ),
    );
  }

  function handleArchive() {
    if (!editing) return;
    startArchiveTransition(async () => {
      try {
        await archiveCustomRoleAction(editing.id);
        toast.success(`Cargo "${editing.name}" arquivado.`);
        onSaved();
        onClose();
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Não foi possível arquivar o cargo.",
        );
      }
    });
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const payload = {
      id: editing?.id,
      name,
      description,
      color: "primary",
      icon: "shield",
      scope,
      permissions: selected,
      status,
    };
    startTransition(async () => {
      try {
        await saveCustomRoleAction(payload);
        toast.success(editing ? "Cargo atualizado com sucesso." : "Cargo criado com sucesso.");
        onSaved();
        onClose();
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Não foi possível salvar o cargo.",
        );
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogPopup className="max-w-2xl max-h-[85vh] flex flex-col p-0 overflow-hidden">
        <div className="flex items-center justify-between border-b border-border px-5 py-4 shrink-0">
          <div>
            <DialogTitle>{editing ? `Editar cargo: ${editing.name}` : "Novo Cargo Personalizado"}</DialogTitle>
            <DialogDescription className="mt-0.5 text-xs">
              {editing
                ? `Versão ${editing.version} · Última atualização em ${new Date(editing.updatedAt).toLocaleDateString("pt-BR")}`
                : "Defina um nome, abrangência e quais permissões de leitura/escrita este cargo terá no CRM."}
            </DialogDescription>
          </div>
          <DialogClose render={<button aria-label="Fechar" className="rounded-md p-1 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"><X className="size-4" /></button>} />
        </div>

        <form onSubmit={submit} className="flex flex-1 flex-col overflow-hidden min-h-0">
          <Tabs defaultValue="identidade" className="flex flex-1 flex-col overflow-hidden min-h-0">
            <TabsList className="shrink-0 px-5 pt-2 border-b border-border/50">
              <TabsTrigger value="identidade">Identidade</TabsTrigger>
              <TabsTrigger value="permissoes">
                Permissões
                {selected.length > 0 && (
                  <Badge variant="indigo" className="ml-1.5 px-1.5 py-0 h-4 min-w-4 text-[10px] flex items-center justify-center font-bold">
                    {selected.length}
                  </Badge>
                )}
              </TabsTrigger>
              {editing && (
                <TabsTrigger value="membros">
                  Membros
                  {editing.memberCount > 0 && (
                    <Badge variant="secondary" className="ml-1.5 px-1.5 py-0 h-4 min-w-4 text-[10px] flex items-center justify-center font-medium">
                      {editing.memberCount}
                    </Badge>
                  )}
                </TabsTrigger>
              )}
            </TabsList>

            <div className="flex-1 overflow-y-auto py-3">
              <TabsContent value="identidade">
                <IdentidadeTab
                  name={name}
                  setName={setName}
                  description={description}
                  setDescription={setDescription}
                  status={status}
                  setStatus={setStatus}
                  scope={scope}
                  onScopeChange={handleScopeChange}
                />
              </TabsContent>

              <TabsContent value="permissoes">
                <PermissionsTab
                  scope={scope}
                  catalog={catalog}
                  selected={selected}
                  onToggle={togglePermission}
                />
              </TabsContent>

              <TabsContent value="membros">
                <MembersTab role={editing} />
              </TabsContent>
            </div>
          </Tabs>

          <div className="flex items-center justify-between gap-3 border-t border-border px-5 py-4 shrink-0 bg-muted/20">
            {editing && editing.status !== "archived" ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive hover:bg-destructive/10 gap-1.5"
                disabled={archivePending || pending}
                onClick={handleArchive}
              >
                <Trash className="size-3.5" />
                Arquivar cargo
              </Button>
            ) : (
              <div />
            )}
            <div className="flex items-center gap-2">
              <DialogClose render={<Button variant="ghost" size="sm" disabled={pending}>Cancelar</Button>} />
              <Button
                type="submit"
                size="sm"
                disabled={!enabled || pending}
                className="gap-1.5"
              >
                {pending ? (
                  "Salvando..."
                ) : (
                  <>
                    <CheckCircle className="size-3.5" />
                    {editing ? "Salvar alterações" : "Criar cargo"}
                  </>
                )}
              </Button>
            </div>
          </div>
        </form>
      </DialogPopup>
    </Dialog>
  );
}

// ── Main workspace ─────────────────────────────────────────────────────────────

export function CustomRolesWorkspace({
  enabled,
  catalog,
  roles,
}: {
  enabled: boolean;
  catalog: Capability[];
  roles: Role[];
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | Role["status"]>("all");
  const [selectedId, setSelectedId] = useState<string | "new" | null>(null);
  const [savedAt, setSavedAt] = useState(0);

  const visible = useMemo(
    () =>
      roles.filter(
        (role) =>
          (filter === "all" || role.status === filter) &&
          `${role.name} ${role.description ?? ""}`
            .toLocaleLowerCase("pt-BR")
            .includes(query.toLocaleLowerCase("pt-BR")),
      ),
    [roles, filter, query, savedAt], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const editingRole = useMemo(
    () => (selectedId && selectedId !== "new" ? roles.find((r) => r.id === selectedId) ?? null : null),
    [selectedId, roles],
  );

  function handleSaved() {
    setSavedAt(Date.now());
  }

  return (
    <main className="flex flex-1 flex-col gap-6 p-4 lg:p-6">
      {/* Page header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold text-primary uppercase tracking-wider">GESTÃO DE EQUIPE</p>
          <h1 className="mt-0.5 text-xl font-bold tracking-tight">Cargos e permissões</h1>
          <p className="mt-1 text-sm text-muted-foreground max-w-xl">
            Crie cargos personalizados para definir acessos granulares a dados, rotas, relatórios e ferramentas do CRM.
          </p>
        </div>
        <Button
          disabled={!enabled}
          onClick={() => setSelectedId("new")}
          className="shrink-0 self-start sm:self-auto gap-1.5"
        >
          <Plus className="size-4" />
          Novo cargo
        </Button>
      </div>

      {/* Feature disabled warning */}
      {!enabled && (
        <Card className="border-warning/30 bg-warning/5 shadow-none">
          <CardContent className="flex items-start gap-3 p-4">
            <Warning className="mt-0.5 size-4 text-warning shrink-0" />
            <div>
              <p className="text-sm font-semibold text-warning-foreground">Módulo desabilitado</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Solicite ao Super-admin a liberação do recurso de Cargos Personalizados para habilitar a criação e edição no sistema.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filter Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between border-b border-border/60 pb-4">
        <div className="flex flex-1 max-w-md items-center gap-2">
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar cargo por nome ou descrição..."
            className="h-9 text-xs"
          />
        </div>
        <div className="flex items-center gap-2">
          <Select value={filter} onValueChange={(value) => setFilter((value ?? "all") as typeof filter)}>
            <SelectTrigger className="w-40 h-9 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os estados</SelectItem>
              <SelectItem value="active">Ativos</SelectItem>
              <SelectItem value="draft">Rascunhos</SelectItem>
              <SelectItem value="archived">Arquivados</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Roles Grid */}
      {visible.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-16 text-center border border-dashed border-border rounded-xl bg-card/30">
          <ShieldCheck className="size-10 text-muted-foreground/60" />
          <div>
            <p className="text-sm font-semibold text-foreground">
              {roles.length === 0 ? "Nenhum cargo configurado" : "Nenhum resultado encontrado"}
            </p>
            <p className="mt-1 text-xs text-muted-foreground max-w-sm">
              {roles.length === 0
                ? "Adicione cargos customizados para organizar as permissões da sua corretora de maneira simples."
                : "Ajuste os filtros de busca para encontrar o cargo desejado."}
            </p>
          </div>
          {roles.length === 0 && enabled && (
            <Button variant="outline" size="sm" onClick={() => setSelectedId("new")} className="gap-1.5">
              <Plus className="size-3.5" />
              Criar o primeiro cargo
            </Button>
          )}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((role) => (
            <Card
              key={role.id}
              className={[
                "group relative hover:border-primary/30 transition-all hover:shadow-md cursor-pointer overflow-hidden border border-border/80 bg-card",
                role.status === "archived" && "opacity-60",
              ].join(" ")}
              onClick={() => setSelectedId(role.id)}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between gap-2">
                  <StatusBadge status={role.status} />
                  <span className="text-[10px] font-mono text-muted-foreground">v{role.version}</span>
                </div>
                <CardTitle className="text-base group-hover:text-primary transition-colors mt-2">{role.name}</CardTitle>
                <CardDescription className="text-xs line-clamp-2 min-h-[32px] mt-1">
                  {role.description || "Nenhuma descrição fornecida."}
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-2 border-t border-border/40 bg-muted/5 flex items-center justify-between text-xs text-muted-foreground">
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1 font-semibold text-foreground">
                    <UsersThree className="size-3.5 text-muted-foreground" />
                    {role.memberCount}
                  </span>
                  <span>·</span>
                  <span>{role.permissions.length} permissões</span>
                </div>
                <Badge variant="outline" className="text-[10px] font-medium tracking-wide">
                  {roleScopeLabel(role.scope)}
                </Badge>
              </CardContent>
              {/* Hover action overlay */}
              <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-background/90 p-1.5 rounded-md border shadow-sm">
                <PencilSimple className="size-3.5 text-primary" />
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Editor Modal / Dialog */}
      <RoleEditorDialog
        editing={editingRole}
        catalog={catalog}
        enabled={enabled}
        open={selectedId !== null}
        onClose={() => setSelectedId(null)}
        onSaved={handleSaved}
      />
    </main>
  );
}
