"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ERP_AUDIENCES, ERP_IMPLEMENTED_MODULES, ERP_MODULES, type ErpActionResult, type ErpModuleKey } from "../contracts";
import { saveErpModuleAction } from "../governance-actions";
import { updateErpPlatformAction } from "../platform-actions";
import page from "@/components/lite/page/lite-page.module.css";

const INITIAL: ErpActionResult = { ok: true, message: "" };
const roleLabels = { director: "Diretor", manager: "Gestor", supervisor: "Supervisor", broker: "Corretor", finance: "Financeiro", operations: "Operações", marketing: "Marketing", support: "Suporte" };

function Result({ state }: { state: ErpActionResult }) {
  return state.message ? <p role={state.ok ? "status" : "alert"} className={state.ok ? "text-sm text-muted-foreground" : "text-sm text-destructive"}>{state.message}</p> : null;
}

export function ErpModuleForm({ module }: { module: {
  key: ErpModuleKey; label: string; description: string; dependencies: readonly ErpModuleKey[];
  ready: boolean; globallyAvailable: boolean; enabled: boolean; roles: readonly string[]; maxImportRows: number; version: number; params: { showNames: boolean; intervalSeconds: number };
} }) {
  const [state, action, pending] = useActionState(saveErpModuleAction, INITIAL);
  return <Card><CardHeader><div className="flex flex-wrap items-center justify-between gap-2"><CardTitle>{module.label}</CardTitle><Badge variant={module.ready && module.enabled && module.globallyAvailable ? "default" : "secondary"}>{!module.ready ? "Em preparação" : !module.globallyAvailable ? "Liberação global pendente" : module.enabled ? "Ativo nesta empresa" : "Desativado"}</Badge></div><CardDescription>{module.description}</CardDescription></CardHeader>
    <CardContent><form action={action} className={page.group}>
      <input type="hidden" name="module" value={module.key} /><input type="hidden" name="version" value={module.version} />
      <label className="flex items-center gap-2 text-sm"><Checkbox name="enabled" defaultChecked={module.enabled} disabled={pending || !module.ready} />Ativar nesta empresa</label>
      <fieldset disabled={pending || !module.ready} className={page.group}><legend className="text-sm font-medium">Quem pode acessar</legend><p className="text-sm text-muted-foreground">Cada pessoa continua limitada ao próprio papel, cargo e escopo. Habilitar um perfil não concede acesso à empresa inteira.</p><div className="flex flex-wrap gap-4">{ERP_AUDIENCES.map((role) => <label key={role} className="flex items-center gap-2 text-sm"><Checkbox name="roles" value={role} defaultChecked={module.roles.includes(role)} />{roleLabels[role]}</label>)}</div></fieldset>
      {module.key === "imports" ? <label htmlFor="erp-max-rows" className={page.group}>Linhas por importação<Input id="erp-max-rows" name="maxImportRows" type="number" min={1} max={500} defaultValue={module.maxImportRows} required disabled={pending} /></label> : <input type="hidden" name="maxImportRows" value={module.maxImportRows} />}
      {module.key === "tv" ? <fieldset disabled={pending} className={page.group}><legend className="text-sm font-medium">Exibição na TV</legend><label className="flex items-center gap-2 text-sm"><Checkbox name="showNames" defaultChecked={module.params.showNames} />Mostrar nomes dos corretores no ranking</label><p className="text-sm text-muted-foreground">Desligado, a TV mostra apenas unidades. Valores individuais de remuneração nunca aparecem.</p><label htmlFor="erp-tv-interval" className={page.group}>Segundos por tela<Input id="erp-tv-interval" name="intervalSeconds" type="number" min={5} max={300} defaultValue={module.params.intervalSeconds} required /></label></fieldset> : null}
      {module.dependencies.length ? <p className="text-sm text-muted-foreground">Depende de: {module.dependencies.map((key) => ERP_MODULES.find((item) => item.key === key)?.label).join(", ")}.</p> : null}
      {!module.ready ? <p className="text-sm text-muted-foreground">Este módulo só poderá ser ativado após a conclusão de sua preparação.</p> : null}<Result state={state} /><div><Button type="submit" variant="outline" loading={pending} disabled={!module.ready}>Salvar configuração</Button></div>
    </form></CardContent></Card>;
}

export function ErpPlatformControl({ enabled, modules }: { enabled: boolean; modules: readonly ErpModuleKey[] }) {
  const [state, action, pending] = useActionState(updateErpPlatformAction, INITIAL);
  return <Card data-settings-tab="platform"><CardHeader><CardTitle>ERP operacional</CardTitle><CardDescription>Libera módulos para configuração nas empresas. Desligar impede novas operações e preserva o histórico. Aprovação financeira é independente e não realiza transferências bancárias.</CardDescription></CardHeader><CardContent>
    <form action={action} className={page.group}><label className="flex items-center gap-2 text-sm"><Checkbox name="enabled" defaultChecked={enabled} disabled={pending} />Habilitar ERP</label>
      <fieldset disabled={pending} className={page.group}><legend className="text-sm font-medium">Módulos liberados</legend>{ERP_MODULES.map((module) => <label key={module.key} className="flex items-center gap-2 text-sm"><Checkbox name="modules" value={module.key} defaultChecked={modules.includes(module.key)} disabled={!ERP_IMPLEMENTED_MODULES.has(module.key)} />{module.label}{!ERP_IMPLEMENTED_MODULES.has(module.key) ? " · em preparação" : ""}</label>)}</fieldset>
      <Result state={state} /><div><Button type="submit" variant="outline" loading={pending}>Salvar disponibilidade</Button></div></form>
  </CardContent></Card>;
}
