"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { previewPostSaleAutoRuleAction, savePostSaleAutoRuleAction } from "@/features/post-sale-audit/actions";
import { AUTO_RULE_DEFINITIONS, AUTO_RULE_LIMITS, effectiveAutoRuleDailyLimit, isAutoRulePilotMode, type AutoRuleSettings } from "@/features/post-sale-audit/auto-rules";

type Option = { id: string; name: string };
type Preview = Extract<Awaited<ReturnType<typeof previewPostSaleAutoRuleAction>>, { ok: true }>["data"];

type AutoRulesProps = {
  initial: { ready: boolean; canEdit: boolean; rules: AutoRuleSettings[] };
  queues: Option[];
  branches: Option[];
  brokers: Option[];
};

function formatDay(key: string) {
  const [year, month, day] = key.split("-");
  return `${day}/${month}/${year}`;
}

/** Régua automática (Fase 4): R1 a R5, cada uma com chave, atraso, filtros, limite, piloto e prévia. Só o diretor edita. */
export function PostSaleAutoRules({ initial, queues, branches, brokers }: AutoRulesProps) {
  return (
    <Card id="regua-automatica">
      <CardHeader>
        <CardTitle>Régua automática</CardTitle>
        <CardDescription>
          A equipe de qualidade conversa sozinha com o cliente alguns dias úteis depois de cada marco (seg a sex, 8h às 18h), pelo mesmo número em que ele falou com a gente. No número oficial sai o template aprovado pos_venda_apresentacao. Tudo começa desligado.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        {!initial.ready ? <p className="rounded-xl bg-[var(--surface-secondary)] p-4 text-sm text-muted-foreground">A régua ainda não foi ativada no banco (SQL 0224). Todas as regras seguem desligadas.</p> : null}
        <p className="text-xs text-muted-foreground">
          Proteções para todas as regras: no máximo 1 conversa de pós-venda por cliente a cada {AUTO_RULE_LIMITS.cooldownDays} dias (manual e automática somadas), nada se houve conversa humana nas últimas 24 h, se o cliente pediu para parar, se o número é inválido ou se o lead é de um diretor. Até {AUTO_RULE_LIMITS.tenantDailyLimit} conversas por dia na empresa; em piloto, até {AUTO_RULE_LIMITS.pilotDailyLimit} por regra. A IA nunca informa preço e o corretor não vê nada na linha do tempo.
        </p>
        {initial.rules.map((rule) => <AutoRuleEditor key={rule.key} rule={rule} canEdit={initial.canEdit} queues={queues} branches={branches} brokers={brokers} />)}
        {!initial.canEdit && initial.ready ? <p className="text-xs text-muted-foreground">Só a direção pode alterar a régua.</p> : null}
      </CardContent>
    </Card>
  );
}

function CheckList({ legend, options, selected, onToggle, disabled, empty }: { legend: string; options: Option[]; selected: string[]; onToggle: (id: string, checked: boolean) => void; disabled: boolean; empty: string }) {
  return (
    <fieldset className="grid gap-2" disabled={disabled}>
      <legend className="mb-1 text-sm font-medium">{legend}</legend>
      {options.length ? <div className="grid max-h-48 gap-2 overflow-y-auto sm:grid-cols-2 lg:grid-cols-3">
        {options.map((option) => <label key={option.id} className="flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm">
          <Checkbox checked={selected.includes(option.id)} onCheckedChange={(value) => onToggle(option.id, Boolean(value))} disabled={disabled} />
          <span className="truncate">{option.name}</span>
        </label>)}
      </div> : <p className="text-sm text-muted-foreground">{empty}</p>}
    </fieldset>
  );
}

function toggleIn(list: string[], id: string, checked: boolean) {
  return checked ? [...new Set([...list, id])] : list.filter((item) => item !== id);
}

function AutoRuleEditor({ rule, canEdit, queues, branches, brokers }: { rule: AutoRuleSettings; canEdit: boolean; queues: Option[]; branches: Option[]; brokers: Option[] }) {
  const definition = AUTO_RULE_DEFINITIONS[rule.key];
  const [settings, setSettings] = useState(rule);
  const [delay, setDelay] = useState(String(rule.delayBusinessDays));
  const [limit, setLimit] = useState(String(rule.dailyLimit));
  const [open, setOpen] = useState(rule.enabled);
  const [feedback, setFeedback] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, startTransition] = useTransition();
  const disabled = !canEdit || busy;
  const pilotMode = isAutoRulePilotMode(settings.pilot);

  function payload() {
    return {
      key: settings.key,
      enabled: settings.enabled,
      delayBusinessDays: Number(delay),
      dailyLimit: Number(limit),
      filters: settings.filters,
      pilot: settings.pilot,
    };
  }

  function save() {
    setFeedback("");
    startTransition(async () => {
      const result = await savePostSaleAutoRuleAction(payload());
      if (!result.ok) { setFeedback(result.error); return; }
      setSettings(result.data);
      setDelay(String(result.data.delayBusinessDays));
      setLimit(String(result.data.dailyLimit));
      setFeedback(result.data.enabled ? `Regra ligada. Até ${effectiveAutoRuleDailyLimit(result.data)} por dia.` : "Regra salva e desligada.");
    });
  }

  function runPreview() {
    setFeedback("");
    startTransition(async () => {
      const result = await previewPostSaleAutoRuleAction(payload());
      if (!result.ok) { setFeedback(result.error); setPreview(null); return; }
      setPreview(result.data);
    });
  }

  return (
    <section className="rounded-2xl border border-border" aria-labelledby={`regra-${rule.key}`}>
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
        <button type="button" className="min-w-0 text-left" aria-expanded={open} aria-controls={`regra-${rule.key}-detalhes`} onClick={() => setOpen((value) => !value)}>
          <h3 id={`regra-${rule.key}`} className="text-sm font-semibold">{rule.key} · {definition.label}</h3>
          <p className="text-xs text-muted-foreground">D+{settings.delayBusinessDays} útil depois de: {definition.milestoneLabel}. Pergunta: {definition.asks}</p>
        </button>
        <label className="flex items-center gap-2 text-sm font-medium">
          <Switch checked={settings.enabled} onCheckedChange={(value) => setSettings((current) => ({ ...current, enabled: Boolean(value) }))} disabled={disabled} aria-label={`Ligar a regra ${rule.key}`} />
          {settings.enabled ? "Ligada" : "Desligada"}
        </label>
      </div>
      {open ? <div id={`regra-${rule.key}-detalhes`} className="grid gap-4 border-t border-border px-4 py-4">
        <p className="text-xs text-muted-foreground">Condição: {definition.condition}.{rule.key === "R5" ? " Recomendação: ligar só depois do piloto das outras regras." : ""}</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-2 text-sm font-medium">Atraso (dias úteis)
            <Input type="number" inputMode="numeric" min={1} max={AUTO_RULE_LIMITS.maxDelayBusinessDays} value={delay} onChange={(event) => setDelay(event.target.value)} disabled={disabled} />
          </label>
          <label className="grid gap-2 text-sm font-medium">Limite por dia
            <Input type="number" inputMode="numeric" min={1} max={AUTO_RULE_LIMITS.dailyLimit} value={limit} onChange={(event) => setLimit(event.target.value)} disabled={disabled} />
            {pilotMode ? <span className="text-xs font-normal text-muted-foreground">Em piloto, no máximo {AUTO_RULE_LIMITS.pilotDailyLimit} por dia.</span> : null}
          </label>
        </div>
        <CheckList legend="Filtro: filas (vazio = todas)" options={queues} selected={settings.filters.queueIds} disabled={disabled} empty="Nenhuma fila ativa." onToggle={(id, checked) => setSettings((current) => ({ ...current, filters: { ...current.filters, queueIds: toggleIn(current.filters.queueIds, id, checked) } }))} />
        <CheckList legend="Filtro: unidades (vazio = todas)" options={branches} selected={settings.filters.branchIds} disabled={disabled} empty="Nenhuma unidade ativa." onToggle={(id, checked) => setSettings((current) => ({ ...current, filters: { ...current.filters, branchIds: toggleIn(current.filters.branchIds, id, checked) } }))} />
        <CheckList legend="Filtro: tipo (vazio = PF e PJ)" options={[{ id: "PF", name: "Pessoa física (PF)" }, { id: "PJ", name: "Empresa (PJ)" }]} selected={settings.filters.leadTypes} disabled={disabled} empty="" onToggle={(id, checked) => setSettings((current) => ({ ...current, filters: { ...current.filters, leadTypes: toggleIn(current.filters.leadTypes, id, checked).filter((type): type is "PF" | "PJ" => type === "PF" || type === "PJ") } }))} />
        <CheckList legend="Piloto: filas liberadas (marcar fila ou corretor liga o modo piloto)" options={queues} selected={settings.pilot.queueIds} disabled={disabled} empty="Nenhuma fila ativa." onToggle={(id, checked) => setSettings((current) => ({ ...current, pilot: { ...current.pilot, queueIds: toggleIn(current.pilot.queueIds, id, checked) } }))} />
        <CheckList legend="Piloto: corretores liberados" options={brokers} selected={settings.pilot.brokerIds} disabled={disabled} empty="Nenhum corretor ativo." onToggle={(id, checked) => setSettings((current) => ({ ...current, pilot: { ...current.pilot, brokerIds: toggleIn(current.pilot.brokerIds, id, checked) } }))} />
        {canEdit ? <div className="flex flex-wrap items-center gap-3">
          <Button type="button" variant="outline" onClick={runPreview} loading={busy}>Ver prévia de amanhã</Button>
          <Button type="button" onClick={save} loading={busy}>Salvar</Button>
          {feedback ? <p className="text-sm text-[var(--text-secondary)]" role="status">{feedback}</p> : null}
        </div> : null}
        {preview ? <div className="grid gap-2 rounded-xl bg-[var(--surface-secondary)] p-3 text-sm" role="status">
          <p><strong>Amanhã ({formatDay(preview.sendDay)}) sairiam {preview.wouldSend} {preview.wouldSend === 1 ? "mensagem" : "mensagens"}</strong>{preview.eligible > preview.wouldSend ? ` (${preview.eligible} elegíveis, limite de ${preview.limit} por dia)` : ""}.</p>
          <p className="text-xs text-muted-foreground">{preview.candidates} {preview.candidates === 1 ? "lead bate" : "leads batem"} o marco no dia. A conta considera a regra ligada com estas configurações e as proteções de hoje.</p>
          {preview.skipped.length || preview.excluded.length ? <ul className="grid gap-1 text-xs text-muted-foreground">
            {[...preview.skipped, ...preview.excluded].map((item) => <li key={item.reason}>{item.count} fora: {item.reason}</li>)}
          </ul> : null}
        </div> : null}
      </div> : null}
    </section>
  );
}
