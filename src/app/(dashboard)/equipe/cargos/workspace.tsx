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
} from "@/components/huge-icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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

type Member = {
  id: string;
  name: string | null;
  email: string;
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
        checked
          ? "bg-primary"
          : "bg-input hover:bg-input/80",
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

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyEditor() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 p-12 text-center">
      <div className="flex size-12 items-center justify-center rounded-xl bg-muted">
        <LockKey className="size-6 text-muted-foreground" />
      </div>
      <div>
        <p className="text-sm font-medium text-foreground">Selecione um cargo</p>
        <p className="mt-1 text-xs text-muted-foreground max-w-[240px]">
          Clique em um cargo na lista ao lado para visualizar e editar suas permissões.
        </p>
      </div>
    </div>
  );
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
        <p className="text-sm font-medium text-foreground leading-snug">{item.label}</p>
        <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">{item.description}</p>
      </label>
      <div className="pt-0.5 shrink-0">
        <PermissionToggle checked={checked} onChange={onToggle} id={switchId} />
      </div>
    </div>
  );
}

// ── Role list item ────────────────────────────────────────────────────────────

function RoleListItem({
  role,
  isSelected,
  onClick,
}: {
  role: Role;
  isSelected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "w-full text-left px-3 py-3 rounded-lg border transition-all duration-150",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        isSelected
          ? "border-primary/30 bg-primary/5 shadow-none"
          : "border-transparent hover:border-border hover:bg-muted/40",
      ].join(" ")}
    >
      <div className="flex items-center justify-between gap-2 mb-1">
        <span className="text-sm font-semibold text-foreground truncate">{role.name}</span>
        <StatusBadge status={role.status} />
      </div>
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <UsersThree className="size-3" />
          {role.memberCount}
        </span>
        <span>·</span>
        <span>{role.permissions.length} perm.</span>
        <span>·</span>
        <span className="truncate">{roleScopeLabel(role.scope)}</span>
      </div>
    </button>
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
        <p className="text-sm text-muted-foreground">
          Nenhuma permissão disponível para o escopo selecionado.
          <br />
          Altere o escopo na aba <strong>Identidade</strong>.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-muted-foreground px-4 pt-2">
        {selected.length} de {available.length} permissões ativas.
        Ative apenas o necessário.
      </p>
      <div className="flex flex-col gap-2">
        {grouped.map(([category, items]) => {
          const catSelected = items.filter((item) => selected.includes(item.key)).length;
          return (
            <section
              key={category}
              className="rounded-lg border border-border overflow-hidden"
            >
              <div className="flex items-center justify-between border-b border-border bg-muted/30 px-4 py-2.5">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {category}
                </p>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {catSelected}/{items.length}
                </span>
              </div>
              <div className="divide-y divide-border">
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
  editing,
  scope,
  onScopeChange,
}: {
  editing: Role | null;
  scope: Role["scope"];
  onScopeChange: (scope: Role["scope"]) => void;
}) {
  return (
    <div className="flex flex-col gap-5 px-4 pt-2 pb-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="role-name">Nome do cargo</Label>
          <Input
            id="role-name"
            name="name"
            required
            defaultValue={editing?.name ?? ""}
            placeholder="Ex.: Marketing, Financeiro…"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="role-status">Estado</Label>
          <Select name="status" defaultValue={editing?.status === "active" ? "active" : "draft"}>
            <SelectTrigger id="role-status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="draft">Rascunho</SelectItem>
              <SelectItem value="active">Ativo</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="role-description">Descrição</Label>
          <Input
            id="role-description"
            name="description"
            defaultValue={editing?.description ?? ""}
            placeholder="Explique em uma frase o objetivo deste cargo."
          />
        </div>
      </div>

      <Separator />

      <div className="space-y-2">
        <Label>Abrangência do cargo</Label>
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
            <SelectItem value="tenant">Empresa inteira — sem vínculo de unidade obrigatório</SelectItem>
            <SelectItem value="branch">Uma unidade — cada membro deve ter uma unidade vinculada</SelectItem>
            <SelectItem value="own">Atuação individual — acesso apenas aos próprios registros</SelectItem>
            <SelectItem value="none">Sem operação — acesso somente administrativo</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          A abrangência define quais permissões estarão disponíveis e o isolamento de dados aplicado.
          Ela nunca amplia o acesso do Diretor.
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
          <p className="text-sm text-muted-foreground">
            Nenhum membro usa este cargo ainda.
          </p>
          <Button variant="outline" size="sm" render={<Link href="/equipe" />}>
            Ir para Equipe
          </Button>
        </div>
      ) : (
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground mb-2">
            {role.memberCount} membro{role.memberCount !== 1 ? "s" : ""} com este cargo.
            Gerencie na página de{" "}
            <Link href="/equipe" className="text-primary underline-offset-2 hover:underline">
              Equipe
            </Link>
            .
          </p>
          <div className="rounded-lg border border-border">
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-muted/30">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Membros vinculados
              </span>
              <Badge variant="outline" className="text-[10px]">
                {role.memberCount}
              </Badge>
            </div>
            <div className="p-4 text-sm text-muted-foreground">
              Para ver e gerenciar os membros com este cargo, acesse a lista da{" "}
              <Link href="/equipe" className="text-primary underline-offset-2 hover:underline">
                Equipe
              </Link>{" "}
              e use o filtro de cargo.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Inline editor panel ────────────────────────────────────────────────────────

function RoleEditorPanel({
  editing,
  catalog,
  enabled,
  onClose,
  onSaved,
}: {
  editing: Role | null;
  catalog: Capability[];
  enabled: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [scope, setScope] = useState<Role["scope"]>(editing?.scope ?? "tenant");
  const [selected, setSelected] = useState<string[]>(editing?.permissions ?? []);
  const [pending, startTransition] = useTransition();
  const [archivePending, startArchiveTransition] = useTransition();

  // Re-sync when switching between roles
  useEffect(() => {
    setScope(editing?.scope ?? "tenant");
    setSelected(editing?.permissions ?? []);
  }, [editing?.id, editing?.scope, editing?.permissions]);

  function togglePermission(key: string) {
    setSelected((current) =>
      current.includes(key)
        ? current.filter((item) => item !== key)
        : [...current, key],
    );
  }

  function handleScopeChange(next: Role["scope"]) {
    setScope(next);
    // Remove permissions incompatible with new scope
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

  function submit(formData: FormData) {
    const payload = {
      id: editing?.id,
      name: formData.get("name"),
      description: formData.get("description"),
      color: "primary",
      icon: "shield",
      scope,
      permissions: selected,
      status: formData.get("status"),
    };
    startTransition(async () => {
      try {
        await saveCustomRoleAction(payload);
        toast.success(editing ? "Cargo atualizado." : "Cargo criado.");
        onSaved();
        if (!editing) onClose();
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Não foi possível salvar o cargo.",
        );
      }
    });
  }

  return (
    <div className="flex flex-1 flex-col min-h-0 overflow-hidden">
      {/* Editor header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3 shrink-0">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground truncate">
            {editing ? editing.name : "Novo cargo"}
          </p>
          {editing && (
            <p className="text-xs text-muted-foreground mt-0.5">
              v{editing.version} · atualizado em{" "}
              {new Date(editing.updatedAt).toLocaleDateString("pt-BR")}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar editor"
          className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <X className="size-4" />
        </button>
      </div>

      {/* Tabs */}
      <form action={submit} className="flex flex-1 flex-col min-h-0 overflow-hidden">
        <Tabs defaultValue="identidade" className="flex flex-1 flex-col min-h-0 overflow-hidden">
          <TabsList className="shrink-0 px-4">
            <TabsTrigger value="identidade">Identidade</TabsTrigger>
            <TabsTrigger value="permissoes">
              Permissões
              {selected.length > 0 && (
                <span className="ml-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
                  {selected.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="membros">
              Membros
              {editing && editing.memberCount > 0 && (
                <span className="ml-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-muted px-1 text-[10px] font-semibold text-muted-foreground">
                  {editing.memberCount}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-y-auto">
            <TabsContent value="identidade">
              <IdentidadeTab
                editing={editing}
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

        {/* Footer actions */}
        <div className="flex items-center justify-between gap-2 border-t border-border px-4 py-3 shrink-0 bg-card">
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
              Arquivar
            </Button>
          ) : (
            <div />
          )}
          <Button
            type="submit"
            size="sm"
            disabled={!enabled || pending}
            className="gap-1.5"
          >
            {pending ? (
              "Salvando…"
            ) : (
              <>
                <CheckCircle className="size-3.5" />
                {editing ? "Salvar alterações" : "Criar cargo"}
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
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
  const [savedAt, setSavedAt] = useState(0); // bump to reset list state after save

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

  const isCreating = selectedId === "new";
  const hasEditor = selectedId !== null;

  function openNew() {
    setSelectedId("new");
  }

  function closeEditor() {
    setSelectedId(null);
  }

  function handleSaved() {
    setSavedAt(Date.now());
  }

  return (
    <main className="flex flex-1 flex-col gap-0 overflow-hidden">
      {/* Page header */}
      <div className="flex flex-col gap-4 border-b border-border px-4 pb-4 pt-2 lg:px-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-medium text-primary">GESTÃO DE EQUIPE</p>
          <h1 className="mt-0.5 text-xl font-semibold tracking-tight">Cargos e permissões</h1>
          <p className="mt-1 text-sm text-muted-foreground max-w-xl">
            Defina o que cada cargo pode acessar. O escopo determina o alcance dos dados.
            Cargos não ampliam o acesso do Diretor.
          </p>
        </div>
        <Button
          disabled={!enabled}
          onClick={openNew}
          size="sm"
          className="shrink-0 self-start sm:self-auto gap-1.5"
        >
          <Plus className="size-3.5" />
          Novo cargo
        </Button>
      </div>

      {/* Feature disabled warning */}
      {!enabled && (
        <div className="mx-4 mt-4 lg:mx-6">
          <Card className="border-warning/30 bg-warning/5 shadow-none">
            <CardContent className="flex items-start gap-3 p-4">
              <Warning className="mt-0.5 size-4 text-warning shrink-0" />
              <div>
                <p className="text-sm font-medium">Piloto ainda não liberado</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Peça ao Super-admin para habilitar Cargos personalizados para esta empresa.
                  Nenhum acesso existente será alterado.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Split view */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Left panel — role list */}
        <div
          className={[
            "flex flex-col border-r border-border bg-card",
            // On mobile, hide list when editor is open
            hasEditor ? "hidden lg:flex" : "flex",
            "w-full lg:w-72 xl:w-80 shrink-0",
          ].join(" ")}
        >
          {/* List toolbar */}
          <div className="flex flex-col gap-2 border-b border-border p-3">
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar cargo…"
              className="h-8 text-xs"
            />
            <Select
              value={filter}
              onValueChange={(value) => setFilter((value ?? "all") as typeof filter)}
            >
              <SelectTrigger className="h-8 text-xs">
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

          {/* Role list */}
          <div className="flex-1 overflow-y-auto p-2">
            {visible.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
                <ShieldCheck className="size-8 text-muted-foreground/50" />
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    {roles.length === 0 ? "Nenhum cargo criado" : "Nenhum resultado"}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground/70">
                    {roles.length === 0
                      ? "Crie o primeiro cargo para começar."
                      : "Tente ajustar a busca ou o filtro."}
                  </p>
                </div>
                {roles.length === 0 && enabled && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={openNew}
                    className="mt-1 gap-1.5"
                  >
                    <Plus className="size-3.5" />
                    Criar cargo
                  </Button>
                )}
              </div>
            ) : (
              <div className="flex flex-col gap-1">
                {visible.map((role) => (
                  <RoleListItem
                    key={role.id}
                    role={role}
                    isSelected={selectedId === role.id}
                    onClick={() =>
                      setSelectedId((current) =>
                        current === role.id ? null : role.id,
                      )
                    }
                  />
                ))}
              </div>
            )}
          </div>

          {/* List footer */}
          <div className="border-t border-border px-3 py-2">
            <p className="text-[10px] text-muted-foreground">
              {visible.length} cargo{visible.length !== 1 ? "s" : ""}
              {filter !== "all" && ` · filtro: ${filter}`}
            </p>
          </div>
        </div>

        {/* Right panel — editor */}
        <div
          className={[
            "flex flex-1 flex-col min-w-0 min-h-0 overflow-hidden",
            // On mobile, only show when editor is open
            !hasEditor ? "hidden lg:flex" : "flex",
          ].join(" ")}
        >
          {/* Mobile back button */}
          {hasEditor && (
            <button
              type="button"
              onClick={closeEditor}
              className="flex items-center gap-1.5 px-4 py-2 text-xs text-muted-foreground hover:text-foreground border-b border-border lg:hidden bg-muted/30 transition-colors"
            >
              <Gear className="size-3.5" />
              ← Voltar à lista
            </button>
          )}

          {hasEditor ? (
            <RoleEditorPanel
              key={selectedId} // re-mount editor on role switch for clean state
              editing={isCreating ? null : editingRole}
              catalog={catalog}
              enabled={enabled}
              onClose={closeEditor}
              onSaved={handleSaved}
            />
          ) : (
            <EmptyEditor />
          )}
        </div>
      </div>
    </main>
  );
}
