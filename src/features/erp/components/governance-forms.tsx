"use client";

import { startTransition, useActionState, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Field, FieldLabel } from "@/components/ui/field";
import { ErpList, ErpNote, ErpPanel, type ErpColumn } from "../ui/erp-kit";
import { ERP_AUDIENCES, ERP_IMPLEMENTED_MODULES, ERP_MODULES, type ErpActionResult, type ErpModuleKey } from "../contracts";
import { saveErpModuleAction } from "../governance-actions";
import { updateErpPlatformAction } from "../platform-actions";
import { ERP_TIME_ZONE } from "../shared";
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
  return new Date(value).toLocaleString("pt-BR", { timeZone: ERP_TIME_ZONE, dateStyle: "short", timeStyle: "short" });
}

function ModuleStatus({ module }: { module: ModuleRow }) {
  const active = module.ready && module.enabled && module.globallyAvailable;
  const label = !module.ready ? "Em preparação" : !module.globallyAvailable ? "Liberação global pendente" : module.enabled ? "Ativo nesta empresa" : "Desativado";
  return <Badge variant={active ? "default" : "secondary"}>{label}</Badge>;
}

function audiencesSummary(module: ModuleRow) {
  if (!module.enabled) return "Sem acesso";
  return module.roles.map((role) => roleLabels[role as keyof typeof roleLabels] ?? role).join(", ");
}

/** Module settings form (inside the module drawer). */
export function ErpModuleForm({ module }: { module: ModuleRow }) {
  const [state, action, pending] = useActionState(saveErpModuleAction, INITIAL);
  const prefix = `erp-module-${module.key}`;
  return <form onSubmit={keepValues(action)} className="flex flex-col gap-4" aria-label={`Configuração de ${module.label}`}>
    <input type="hidden" name="module" value={module.key} />
    <input type="hidden" name="version" value={module.version} />
    <label className="flex items-center gap-2 text-sm"><Checkbox name="enabled" defaultChecked={module.enabled} disabled={pending || !module.ready} />Ativar nesta empresa</label>
    <fieldset disabled={pending || !module.ready} className="flex flex-col gap-2">
      <legend className="text-sm font-medium">Quem pode acessar</legend>
      <ErpNote>Cada pessoa continua limitada ao próprio papel, cargo e escopo. Habilitar um perfil não concede acesso à empresa inteira.</ErpNote>
      <div className="flex flex-wrap gap-4">{ERP_AUDIENCES.map((role) => <label key={role} className="flex items-center gap-2 text-sm">
        <Checkbox name="roles" value={role} defaultChecked={module.roles.includes(role)} />{roleLabels[role]}
      </label>)}</div>
    </fieldset>
    {module.key === "imports"
      ? <Field><FieldLabel htmlFor={`${prefix}-rows`}>Linhas por importação</FieldLabel>
        <Input id={`${prefix}-rows`} name="maxImportRows" type="number" min={1} max={500} defaultValue={module.maxImportRows} required disabled={pending} /></Field>
      : <input type="hidden" name="maxImportRows" value={module.maxImportRows} />}
    {module.key === "tv" ? <fieldset disabled={pending} className="flex flex-col gap-2">
      <legend className="text-sm font-medium">Exibição na TV</legend>
      <label className="flex items-center gap-2 text-sm"><Checkbox name="showNames" defaultChecked={module.params.showNames} />Mostrar nomes dos corretores no ranking</label>
      <ErpNote>Desligado, a TV mostra apenas unidades. Valores individuais de remuneração nunca aparecem.</ErpNote>
      <Field><FieldLabel htmlFor={`${prefix}-interval`}>Segundos por tela</FieldLabel>
        <Input id={`${prefix}-interval`} name="intervalSeconds" type="number" min={5} max={300} defaultValue={module.params.intervalSeconds} required /></Field>
    </fieldset> : null}
    {module.dependencies.length ? <ErpNote>Depende de: {module.dependencies.map(moduleLabel).join(", ")}.</ErpNote> : null}
    {!module.ready ? <ErpNote>Este módulo só poderá ser ativado após a conclusão de sua preparação.</ErpNote> : null}
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
    { id: "module", label: "Módulo", primary: true, render: (module) => module.label },
    { id: "description", label: "Descrição", secondary: true, render: (module) => module.description },
    { id: "status", label: "Situação", render: (module) => <ModuleStatus module={module} /> },
    { id: "audiences", label: "Perfis com acesso", render: audiencesSummary },
    { id: "dependencies", label: "Depende de", render: (module) => module.dependencies.length ? module.dependencies.map(moduleLabel).join(", ") : "Nenhum" },
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
  return <>
    <ErpNote>Escolha os módulos da empresa e os perfis que poderão usá-los. Valores financeiros exigem conferência e aprovação de outra pessoa.</ErpNote>
    {!workspace.platform.enabled
      ? <ErpNote>O ERP está desativado globalmente. Você pode preparar as configurações e solicitar a liberação ao Super-admin.</ErpNote>
      : null}
    <ErpList title="Módulos" description="Clique em um módulo para ativar e definir quem pode acessar." columns={moduleColumns} rows={[...workspace.modules]}
      rowKey={(module) => module.key} onRowOpen={openModule} emptyTitle="Nenhum módulo disponível" emptyText="Os módulos aparecem aqui após a liberação do ERP." />
    <ErpList title="Alterações recentes" columns={eventColumns} rows={workspace.events} rowKey={(event) => event.id}
      emptyTitle="Nenhuma alteração" emptyText="Nenhuma configuração alterada nesta empresa." />
    <ErpPanel open={open && !!selected} onOpenChange={setOpen} title={selected?.label ?? "Módulo"} description={selected?.description}>
      {selected ? <>
        <ModuleStatus module={selected} />
        <ErpModuleForm key={selected.key} module={selected} />
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
