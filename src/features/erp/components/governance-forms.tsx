"use client";

import { startTransition, useActionState, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { StatCard } from "@/components/dashboard/metric-card";
import { ErpCell, ErpList, ErpNote, ErpPanel, ErpStats, ErpStatus } from "../ui/erp-kit";
import type { ErpColumn } from "../ui/erp-kit";
import { formatInstant } from "../ui/format";
import { ERP_AUDIENCES, ERP_IMPLEMENTED_MODULES, ERP_MODULES, type ErpActionResult, type ErpModuleKey } from "../contracts";
import { saveErpModuleAction } from "../governance-actions";
import { updateErpPlatformAction } from "../platform-actions";
import type { getErpGovernance } from "../governance";
import page from "@/components/lite/page/lite-page.module.css";

/**
 * Submits without React's automatic form reset. These forms use Base UI checkboxes, whose visual state survives the
 * reset while their hidden inputs go back to the initial value: the next save would send everything unchecked.
 */
function keepValues(action: (form: FormData) => void) {
  return (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    startTransition(() => action(data));
  };
}

type Governance = Awaited<ReturnType<typeof getErpGovernance>>;
type ModuleRow = Governance["modules"][number];
type EventRow = Governance["events"][number];

const INITIAL: ErpActionResult = { ok: true, message: "" };
const roleLabels: Record<(typeof ERP_AUDIENCES)[number], string> = {
  director: "Diretor", manager: "Gestor", supervisor: "Supervisor", broker: "Corretor",
  finance: "Financeiro", operations: "Operações", marketing: "Marketing", support: "Suporte",
};

function Result({ state }: { state: ErpActionResult }) {
  if (!state.message) return null;
  return <p role={state.ok ? "status" : "alert"} className={state.ok ? "text-sm text-muted-foreground" : "text-sm text-destructive"}>{state.message}</p>;
}

function moduleLabel(key: string) {
  return ERP_MODULES.find((item) => item.key === key)?.label ?? "Módulo";
}

function formatMoment(value: Date | string) {
  return formatInstant(value);
}

function ModuleStatus({ module }: { module: ModuleRow }) {
  if (!module.ready) return <ErpStatus>Em preparação</ErpStatus>;
  if (!module.globallyAvailable) return <ErpStatus tone="warning">Liberação pendente</ErpStatus>;
  return module.enabled ? <ErpStatus tone="success">Ativo</ErpStatus> : <ErpStatus>Desativado</ErpStatus>;
}

/** One setting: title and hint on the left, the switch on the right (44px row). */
function SettingRow({ id, title, hint, checked, onChange, disabled }: {
  id: string; title: string; hint?: string; checked: boolean; onChange: (checked: boolean) => void; disabled?: boolean;
}) {
  return <div className="flex min-h-11 items-center justify-between gap-4">
    <div className="flex min-w-0 flex-col gap-0.5">
      <label htmlFor={id} className="text-sm font-medium">{title}</label>
      {hint ? <p className="text-xs leading-5 text-muted-foreground">{hint}</p> : null}
    </div>
    <Switch id={id} aria-label={title} checked={checked} disabled={disabled} onCheckedChange={(value: boolean) => onChange(value === true)} />
  </div>;
}

function audiencesSummary(module: ModuleRow) {
  if (!module.enabled) return "Sem acesso";
  return module.roles.map((role) => roleLabels[role as keyof typeof roleLabels] ?? role).join(", ");
}

/**
 * Module settings form (inside the module drawer). Controls are controlled and travel in hidden inputs, so neither the
 * Arc switch nor a form reset can send a value different from what the screen shows.
 */
export function ErpModuleForm({ module }: { module: ModuleRow }) {
  const [state, action, pending] = useActionState(saveErpModuleAction, INITIAL);
  const [enabled, setEnabled] = useState(module.enabled);
  const [roles, setRoles] = useState<string[]>([...module.roles]);
  const [showNames, setShowNames] = useState(module.params.showNames);
  const prefix = `erp-module-${module.key}`;
  const locked = pending || !module.ready;
  const toggleRole = (role: string, checked: boolean) => setRoles((current) => checked ? [...new Set([...current, role])] : current.filter((item) => item !== role));
  return <form onSubmit={keepValues(action)} className="flex flex-col gap-6" aria-label={`Configuração de ${module.label}`}>
    <input type="hidden" name="module" value={module.key} />
    <input type="hidden" name="version" value={module.version} />
    {enabled ? <input type="hidden" name="enabled" value="on" /> : null}
    {roles.map((role) => <input key={role} type="hidden" name="roles" value={role} />)}
    {module.key === "tv" && showNames ? <input type="hidden" name="showNames" value="on" /> : null}

    <SettingRow id={`${prefix}-enabled`} title="Ativar nesta empresa" checked={enabled} onChange={setEnabled} disabled={locked}
      hint={module.dependencies.length ? `Depende de ${module.dependencies.map(moduleLabel).join(", ")} ativo para os mesmos perfis.` : "Desligar preserva o histórico e impede novas operações."} />

    <fieldset disabled={locked} className="flex flex-col gap-3">
      <legend className="text-sm font-medium">Quem pode acessar</legend>
      <p className="text-xs leading-5 text-muted-foreground">Cada pessoa continua limitada ao próprio papel, cargo e escopo. Habilitar um perfil não abre a empresa inteira.</p>
      <div className="grid grid-cols-2 gap-x-4">{ERP_AUDIENCES.map((role) => <label key={role} className="flex min-h-11 items-center gap-3 text-sm">
        <Checkbox checked={roles.includes(role)} onCheckedChange={(checked) => toggleRole(role, checked === true)} aria-label={roleLabels[role]} />{roleLabels[role]}
      </label>)}</div>
    </fieldset>

    {module.key === "imports"
      ? <Field><FieldLabel htmlFor={`${prefix}-rows`}>Linhas por importação</FieldLabel>
        <Input id={`${prefix}-rows`} name="maxImportRows" type="number" min={1} max={500} defaultValue={module.maxImportRows} required disabled={pending} className="max-w-40" />
        <FieldDescription>Limite de linhas de cada arquivo, entre 1 e 500.</FieldDescription></Field>
      : <input type="hidden" name="maxImportRows" value={module.maxImportRows} />}

    {module.key === "tv" ? <fieldset disabled={pending} className="flex flex-col gap-3">
      <legend className="text-sm font-medium">Exibição na TV</legend>
      <SettingRow id={`${prefix}-names`} title="Mostrar nomes dos corretores" checked={showNames} onChange={setShowNames} disabled={pending}
        hint="Desligado, o ranking mostra só unidades. Valores de remuneração nunca aparecem." />
      <Field><FieldLabel htmlFor={`${prefix}-interval`}>Segundos por tela</FieldLabel>
        <Input id={`${prefix}-interval`} name="intervalSeconds" type="number" min={5} max={300} defaultValue={module.params.intervalSeconds} required className="max-w-40" />
        <FieldDescription>Tempo de cada indicador antes de trocar, entre 5 e 300 segundos.</FieldDescription></Field>
    </fieldset> : null}

    {!module.ready ? <ErpNote>Este módulo só poderá ser ativado após a conclusão de sua preparação.</ErpNote> : null}
    {enabled && !roles.length ? <ErpNote>Marque ao menos um perfil para salvar o módulo ativo.</ErpNote> : null}
    <Result state={state} />
    <div><Button type="submit" loading={pending} disabled={!module.ready}>Salvar configuração</Button></div>
  </form>;
}

function ModuleHistory({ events }: { events: EventRow[] }) {
  return <section aria-label="Histórico do módulo" className="flex flex-col gap-2">
    <h3 className="text-sm font-medium">Histórico</h3>
    {events.length ? <ul className="flex flex-col gap-2">{events.map((event) => <li key={event.id} className="text-sm">
      {event.actor ?? "Responsável registrado"}<span className="text-muted-foreground"> · {formatMoment(event.createdAt)}</span>
    </li>)}</ul> : <ErpNote>Nenhuma alteração recente neste módulo.</ErpNote>}
  </section>;
}

export function ErpGovernanceWorkspace({ workspace }: { workspace: Governance }) {
  const [selectedKey, setSelectedKey] = useState<ErpModuleKey | null>(null);
  const [open, setOpen] = useState(false);
  const selected = workspace.modules.find((module) => module.key === selectedKey) ?? null;
  const moduleColumns: ErpColumn<ModuleRow>[] = [
    { id: "module", label: "Módulo", primary: true, render: (module) => <ErpCell title={module.label} sub={module.description} /> },
    { id: "status", label: "Situação", render: (module) => <ModuleStatus module={module} /> },
    { id: "audiences", label: "Perfis com acesso", render: audiencesSummary },
    { id: "dependencies", label: "Depende de", secondary: true, render: (module) => module.dependencies.length ? module.dependencies.map(moduleLabel).join(", ") : "Nenhum" },
  ];
  const eventColumns: ErpColumn<EventRow>[] = [
    { id: "module", label: "Módulo", primary: true, render: (event) => moduleLabel(event.entityId) },
    { id: "actor", label: "Responsável", nowrap: true, render: (event) => event.actor ?? "Responsável registrado" },
    { id: "when", label: "Quando", nowrap: true, render: (event) => formatMoment(event.createdAt) },
  ];
  function openModule(module: ModuleRow) {
    setSelectedKey(module.key);
    setOpen(true);
  }
  const active = workspace.modules.filter((module) => module.ready && module.enabled && module.globallyAvailable).length;
  const pending = workspace.modules.filter((module) => module.ready && !module.globallyAvailable).length;
  const audiences = new Set(workspace.modules.filter((module) => module.enabled).flatMap((module) => module.roles)).size;
  return <>
    <ErpStats>
      <StatCard label="Módulos ativos" value={`${active} de ${workspace.modules.length}`} sublabel="nesta empresa" />
      <StatCard label="Perfis com acesso" value={audiences} sublabel="em ao menos um módulo" />
      <StatCard label="Aguardando liberação" value={pending} sublabel="dependem do Super-admin" />
    </ErpStats>
    {!workspace.platform.enabled
      ? <ErpNote>O ERP está desativado globalmente. Você pode preparar as configurações e solicitar a liberação ao Super-admin.</ErpNote>
      : null}
    <ErpList title="Módulos" count={workspace.modules.length} countLabel={["módulo", "módulos"]} columns={moduleColumns} rows={[...workspace.modules]}
      rowKey={(module) => module.key} onRowOpen={openModule} emptyTitle="Nenhum módulo disponível" emptyText="Os módulos aparecem aqui após a liberação do ERP." />
    <ErpList title="Alterações recentes" count={workspace.events.length} countLabel={["alteração", "alterações"]} columns={eventColumns} rows={workspace.events} rowKey={(event) => event.id}
      emptyTitle="Nenhuma alteração" emptyText="Nenhuma configuração alterada nesta empresa." />
    <ErpPanel open={open && !!selected} onOpenChange={setOpen} title={selected?.label ?? "Módulo"} description={selected?.description}>
      {selected ? <>
        <div><ModuleStatus module={selected} /></div>
        <ErpModuleForm key={`${selected.key}-${selected.version}`} module={selected} />
        <ModuleHistory events={workspace.events.filter((event) => event.entityId === selected.key)} />
      </> : null}
    </ErpPanel>
  </>;
}

/** Super-admin platform control (settings page card). */
export function ErpPlatformControl({ enabled, modules }: { enabled: boolean; modules: readonly ErpModuleKey[] }) {
  const [state, action, pending] = useActionState(updateErpPlatformAction, INITIAL);
  return <Card data-settings-tab="platform"><CardHeader><CardTitle>ERP operacional</CardTitle>
    <CardDescription>Libera módulos para configuração nas empresas. Desligar impede novas operações e preserva o histórico. Aprovação financeira é independente e não realiza transferências bancárias.</CardDescription>
  </CardHeader><CardContent>
    <form onSubmit={keepValues(action)} className={page.group}>
      <label className="flex items-center gap-2 text-sm"><Checkbox name="enabled" defaultChecked={enabled} disabled={pending} />Habilitar ERP</label>
      <fieldset disabled={pending} className={page.group}><legend className="text-sm font-medium">Módulos liberados</legend>
        {ERP_MODULES.map((module) => <label key={module.key} className="flex items-center gap-2 text-sm">
          <Checkbox name="modules" value={module.key} defaultChecked={modules.includes(module.key)} disabled={!ERP_IMPLEMENTED_MODULES.has(module.key)} />
          {module.label}{!ERP_IMPLEMENTED_MODULES.has(module.key) ? " · em preparação" : ""}
        </label>)}
      </fieldset>
      <Result state={state} />
      <div><Button type="submit" variant="outline" loading={pending}>Salvar disponibilidade</Button></div>
    </form>
  </CardContent></Card>;
}
