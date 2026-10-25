"use client";

/**
 * Cargos e permissões no visual Lite. Mesmos dados (getCustomRolesWorkspace), mesmas Server Actions e mesmas regras
 * do CustomRolesWorkspace: busca, filtro de estado, cartões de cargo e o editor (identidade, permissões por escopo,
 * rotas visíveis, membros) em painel lateral, com chaves Arc de 44px e categorias em caixa de frase.
 */
import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { Plus, Search, TriangleAlert, Users } from "lucide-react";

import { Switch } from "@/components/arc/switch/switch";
import { LiteFilterChips, LiteSelect } from "@/components/lite/controls";
import { LiteSidePanel } from "@/components/lite/data/side-panel";
import { liteDateFormatter } from "@/components/lite/format/date";
import form from "@/components/lite/page/lite-form.module.css";
import page from "@/components/lite/page/lite-page.module.css";
import { toast } from "@/components/ui/sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { roleScopeLabel } from "@/features/custom-roles/member-scope";
import type { RouteDefinition } from "@/features/custom-roles/routes";
import { isRoutePermission, routePermissionKey } from "@/features/custom-roles/routes";

import { archiveCustomRoleAction, saveCustomRoleAction } from "../actions";
import styles from "./cargos-lite.module.css";

export type CargoCapability = { key: string; label: string; description: string; category: string; delegable: boolean; scopes: readonly string[] };
export type CargoRole = {
  id: string;
  name: string;
  description: string | null;
  color: string;
  icon: string;
  scope: "none" | "own" | "branch" | "tenant";
  status: "draft" | "active" | "archived";
  version: number;
  updatedAt: Date | string;
  memberCount: number;
  permissions: string[];
};

const STATUS: Record<CargoRole["status"], { label: string; tone?: "success" | "warning" }> = {
  active: { label: "Ativo", tone: "success" },
  draft: { label: "Rascunho", tone: "warning" },
  archived: { label: "Arquivado" },
};
const SCOPE_OPTIONS: Array<{ value: CargoRole["scope"]; label: string }> = [
  { value: "tenant", label: "Empresa inteira: sem restrição nem vínculo obrigatório" },
  { value: "branch", label: "Uma unidade: vincula o profissional à própria filial" },
  { value: "own", label: "Só os próprios dados: visão restrita ao próprio trabalho" },
  { value: "none", label: "Administrativo: não opera registros gerais" },
];
const updatedDate = liteDateFormatter({ dateStyle: "short" });

const sentence = (text: string) => text.charAt(0).toLocaleUpperCase("pt-BR") + text.slice(1).toLocaleLowerCase("pt-BR");

function group<T extends { category: string }>(items: readonly T[]) {
  return Object.entries(items.reduce<Record<string, T[]>>((acc, item) => {
    (acc[item.category] ??= []).push(item);
    return acc;
  }, {}));
}

function ToggleRow({ id, title, description, detail, checked, onToggle }: { id: string; title: string; description: string; detail?: string; checked: boolean; onToggle: () => void }) {
  return (
    <li className={styles.toggleRow}>
      <label htmlFor={id} className={styles.toggleText}>
        <span className={page.cellTitle}>{title}</span>
        <span className={page.cellSub}>{description}</span>
        {detail ? <span className={styles.path}>{detail}</span> : null}
      </label>
      <Switch id={id} checked={checked} onCheckedChange={onToggle} aria-label={title} />
    </li>
  );
}

function RoleEditor({ editing, catalog, routeCatalog, enabled, open, onClose }: {
  editing: CargoRole | null;
  catalog: CargoCapability[];
  routeCatalog: readonly RouteDefinition[];
  enabled: boolean;
  open: boolean;
  onClose: () => void;
}) {
  const [name, setName] = useState(editing?.name ?? "");
  const [description, setDescription] = useState(editing?.description ?? "");
  const [status, setStatus] = useState<"draft" | "active">(editing?.status === "active" ? "active" : "draft");
  const [scope, setScope] = useState<CargoRole["scope"]>(editing?.scope ?? "tenant");
  const [selected, setSelected] = useState<string[]>(editing?.permissions ?? []);
  const [tab, setTab] = useState("identidade");
  const [pending, startTransition] = useTransition();
  const [archiving, startArchive] = useTransition();

  useEffect(() => {
    if (open) {
      setName(editing?.name ?? "");
      setDescription(editing?.description ?? "");
      setStatus(editing?.status === "active" ? "active" : "draft");
      setScope(editing?.scope ?? "tenant");
      setSelected(editing?.permissions ?? []);
      setTab("identidade");
    }
  }, [open, editing]);

  const toggle = (key: string) => setSelected((current) => (current.includes(key) ? current.filter((item) => item !== key) : [...current, key]));
  const changeScope = (next: string) => {
    const value = next as CargoRole["scope"];
    setScope(value);
    setSelected((current) => current.filter((key) => isRoutePermission(key) || catalog.some((item) => item.key === key && item.scopes.includes(value))));
  };
  const available = useMemo(() => catalog.filter((item) => item.scopes.includes(scope)), [catalog, scope]);
  const permissionCount = selected.filter((key) => !isRoutePermission(key)).length;
  const routeCount = selected.filter(isRoutePermission).length;

  const archive = () => {
    if (!editing) return;
    startArchive(async () => {
      try {
        await archiveCustomRoleAction(editing.id);
        toast.success(`Cargo "${editing.name}" arquivado.`);
        onClose();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Não foi possível arquivar o cargo.");
      }
    });
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    startTransition(async () => {
      try {
        await saveCustomRoleAction({ id: editing?.id, name, description, color: "primary", icon: "shield", scope, permissions: selected, status });
        toast.success(editing ? "Cargo atualizado com sucesso." : "Cargo criado com sucesso.");
        onClose();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Não foi possível salvar o cargo.");
      }
    });
  };

  return (
    <LiteSidePanel
      open={open}
      onOpenChange={(next) => { if (!next) onClose(); }}
      title={editing ? `Editar cargo: ${editing.name}` : "Novo cargo personalizado"}
      description={editing ? `Versão ${editing.version} · atualizado em ${updatedDate.format(new Date(editing.updatedAt))}` : "Defina nome, abrangência e quais permissões este cargo terá no CRM."}
    >
      <form onSubmit={submit} className={form.form}>
        <Tabs value={tab} onValueChange={(value) => setTab(String(value))} variant="segment" className={styles.tabs}>
          <div className={styles.tabsScroll}>
            <TabsList aria-label="Partes do cargo" className="w-max">
              <TabsTrigger value="identidade">Identidade</TabsTrigger>
              <TabsTrigger value="permissoes">Permissões{permissionCount ? <span className={styles.count}>{permissionCount}</span> : null}</TabsTrigger>
              <TabsTrigger value="rotas">Rotas visíveis{routeCount ? <span className={styles.count}>{routeCount}</span> : null}</TabsTrigger>
              {editing ? <TabsTrigger value="membros">Membros{editing.memberCount ? <span className={styles.count}>{editing.memberCount}</span> : null}</TabsTrigger> : null}
            </TabsList>
          </div>

          <TabsContent value="identidade">
            <div className={form.form}>
              <label className={form.field}>
                <span className={form.label}>Nome do cargo</span>
                <input className={form.input} name="name" required value={name} onChange={(event) => setName(event.target.value)} placeholder="Ex.: Operador de suporte" />
              </label>
              <LiteSelect label="Estado" value={status} onChange={(value) => setStatus(value as "draft" | "active")} options={[{ value: "draft", label: "Rascunho" }, { value: "active", label: "Ativo" }]} />
              <label className={form.field}>
                <span className={form.label}>Descrição</span>
                <input className={form.input} name="description" value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Explique em poucas palavras a atribuição do cargo." />
              </label>
              <div className={form.field}>
                <LiteSelect label="Abrangência operacional do cargo" value={scope} onChange={changeScope} options={SCOPE_OPTIONS} />
                <span className={form.hint}>A abrangência define quais permissões ficam disponíveis e o isolamento de dados aplicado.</span>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="permissoes">
            {available.length === 0 ? (
              <p className={page.muted}>Nenhuma permissão disponível para esta abrangência. Troque a abrangência em Identidade.</p>
            ) : (
              <div className={form.form}>
                <p className={page.muted}>{permissionCount} de {available.length} permissões ativas. Ative só o necessário.</p>
                {group(available).map(([category, items]) => (
                  <section key={category} className={styles.group} aria-label={sentence(category)}>
                    <div className={styles.groupHead}>
                      <span className={page.cellTitle}>{sentence(category)}</span>
                      <span className={page.badge}>{items.filter((item) => selected.includes(item.key)).length}/{items.length}</span>
                    </div>
                    <ul className={styles.toggles}>
                      {items.map((item) => <ToggleRow key={item.key} id={`perm-${item.key}`} title={item.label} description={item.description} checked={selected.includes(item.key)} onToggle={() => toggle(item.key)} />)}
                    </ul>
                  </section>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="rotas">
            <div className={form.form}>
              <div className={styles.info}>
                <span className={page.cellTitle}>Visibilidade no menu</span>
                <span className={page.cellSub}>Escolha quais áreas este cargo enxerga. Sem rota marcada, o acesso segue as permissões.</span>
              </div>
              <p className={page.muted}>{routeCount} de {routeCatalog.length} rotas com regra explícita.</p>
              {group(routeCatalog).map(([category, items]) => (
                <section key={category} className={styles.group} aria-label={sentence(category)}>
                  <div className={styles.groupHead}><span className={page.cellTitle}>{sentence(category)}</span></div>
                  <ul className={styles.toggles}>
                    {items.map((route) => {
                      const key = routePermissionKey(route.key);
                      return <ToggleRow key={route.key} id={`route-${route.key}`} title={route.label} description={route.description} detail={route.path} checked={selected.includes(key)} onToggle={() => toggle(key)} />;
                    })}
                  </ul>
                </section>
              ))}
            </div>
          </TabsContent>

          {editing ? (
            <TabsContent value="membros">
              {editing.memberCount === 0 ? (
                <div className={page.empty}>
                  <p className={page.emptyTitle}>Nenhum membro com este cargo ainda.</p>
                  <Link href="/equipe" className={page.button}><Users aria-hidden="true" size={16} />Ir para a equipe</Link>
                </div>
              ) : (
                <p className={page.muted}>Este cargo está com {editing.memberCount} membro{editing.memberCount === 1 ? "" : "s"}. Para trocar quem tem o cargo, edite o perfil do colaborador na <Link href="/equipe" className={page.cellLink}>equipe</Link>.</p>
              )}
            </TabsContent>
          ) : null}
        </Tabs>

        <div className={styles.footer}>
          {editing && editing.status !== "archived" ? (
            <button type="button" className={page.button} data-tone="danger" disabled={archiving || pending} onClick={archive}>Arquivar cargo</button>
          ) : <span />}
          <span className={styles.footerEnd}>
            <button type="button" className={page.button} disabled={pending} onClick={onClose}>Cancelar</button>
            <button type="submit" className={page.primaryButton} disabled={!enabled || pending}>{pending ? "Salvando..." : editing ? "Salvar alterações" : "Criar cargo"}</button>
          </span>
        </div>
      </form>
    </LiteSidePanel>
  );
}

export function CargosLite({ enabled, catalog, routeCatalog, roles }: { enabled: boolean; catalog: CargoCapability[]; routeCatalog: readonly RouteDefinition[]; roles: CargoRole[] }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | CargoRole["status"]>("all");
  const [selectedId, setSelectedId] = useState<string | "new" | null>(null);
  const needle = query.toLocaleLowerCase("pt-BR");
  const visible = roles.filter((role) => (filter === "all" || role.status === filter) && `${role.name} ${role.description ?? ""}`.toLocaleLowerCase("pt-BR").includes(needle));
  const editing = selectedId && selectedId !== "new" ? roles.find((role) => role.id === selectedId) ?? null : null;
  const count = (status: CargoRole["status"]) => roles.filter((role) => role.status === status).length;

  return (
    <div className={`arc-venancor ${page.stack}`} data-skin="diretor">
      <div className={page.toolbar}>
        <p className={page.muted}>Crie cargos personalizados para definir acessos a dados, rotas, relatórios e ferramentas do CRM.</p>
        <button type="button" className={`${page.primaryButton} ${page.toolbarEnd}`} disabled={!enabled} onClick={() => setSelectedId("new")}><Plus aria-hidden="true" size={16} />Novo cargo</button>
      </div>

      {!enabled ? (
        <div className={styles.warning} role="note">
          <TriangleAlert aria-hidden="true" size={18} />
          <span>
            <span className={page.cellTitle}>Módulo desabilitado</span>
            <span className={page.cellSub}>Peça ao super admin para liberar os cargos personalizados e habilitar a criação e a edição.</span>
          </span>
        </div>
      ) : null}

      <section className={page.group} aria-label="Cargos">
        <div className={page.toolbar}>
          <label className={page.search}>
            <Search aria-hidden="true" size={18} className={page.searchIcon} />
            <input type="search" className={page.searchInput} aria-label="Buscar cargo" placeholder="Buscar cargo por nome ou descrição" value={query} onChange={(event) => setQuery(event.target.value)} />
          </label>
        </div>
        <LiteFilterChips
          label="Estado"
          scroll
          active={[filter]}
          onToggle={(id) => setFilter(id as typeof filter)}
          chips={[
            { id: "all", label: "Todos", count: roles.length },
            { id: "active", label: "Ativos", count: count("active") },
            { id: "draft", label: "Rascunhos", count: count("draft") },
            { id: "archived", label: "Arquivados", count: count("archived") },
          ]}
        />
        {visible.length === 0 ? (
          <div className={page.empty}>
            <p className={page.emptyTitle}>{roles.length === 0 ? "Nenhum cargo configurado" : "Nenhum resultado encontrado"}</p>
            <p className={page.emptyText}>{roles.length === 0 ? "Adicione cargos para organizar as permissões da corretora." : "Ajuste a busca ou o estado para encontrar o cargo."}</p>
            {roles.length === 0 && enabled ? <button type="button" className={page.button} onClick={() => setSelectedId("new")}><Plus aria-hidden="true" size={16} />Criar o primeiro cargo</button> : null}
          </div>
        ) : (
          <ul className={styles.grid}>
            {visible.map((role) => (
              <li key={role.id}>
                <button type="button" className={styles.card} data-status={role.status} onClick={() => setSelectedId(role.id)} aria-label={`Editar cargo ${role.name}`}>
                  <span className={styles.cardHead}>
                    <span className={page.badge} data-tone={STATUS[role.status].tone}>{STATUS[role.status].label}</span>
                    <span className={`${page.cellSub} ${page.numeric}`}>v{role.version}</span>
                  </span>
                  <span className={styles.cardTitle}>{role.name}</span>
                  <span className={styles.cardDescription}>{role.description || "Sem descrição."}</span>
                  <span className={styles.cardFoot}>
                    <span className={page.cellSub}>{role.memberCount} membro{role.memberCount === 1 ? "" : "s"} · {role.permissions.filter((key) => !isRoutePermission(key)).length} permissões · {role.permissions.filter(isRoutePermission).length} rotas</span>
                    <span className={page.badge}>{roleScopeLabel(role.scope)}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <RoleEditor editing={editing} catalog={catalog} routeCatalog={routeCatalog} enabled={enabled} open={selectedId !== null} onClose={() => setSelectedId(null)} />
    </div>
  );
}
