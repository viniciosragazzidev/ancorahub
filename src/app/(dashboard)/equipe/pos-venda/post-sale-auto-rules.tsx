"use client";

import { useState, useTransition } from "react";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { previewPostSaleAutoRuleAction, savePostSaleAutoRuleAction } from "@/features/post-sale-audit/actions";
import {
  AUTO_RULE_DEFINITIONS,
  AUTO_RULE_LIMITS,
  autoRuleSavePayload,
  describeAutoRuleScope,
  isAutoRulePilotMode,
  type AutoRuleSettings,
} from "@/features/post-sale-audit/auto-rules";
import { cn } from "@/lib/utils";

export type Option = { id: string; name: string };
type Preview = Extract<Awaited<ReturnType<typeof previewPostSaleAutoRuleAction>>, { ok: true }>["data"];
export type RowFeedback = { text: string; tone: "ok" | "error" } | null;

type AutoRulesProps = {
  initial: { ready: boolean; canEdit: boolean; rules: AutoRuleSettings[] };
  queues: Option[];
  branches: Option[];
  brokers: Option[];
  /** Avisa a página (contador "N ligadas") quando uma regra é gravada. */
  onSaved?: (rule: AutoRuleSettings) => void;
};

function formatDay(key: string) {
  const [year, month, day] = key.split("-");
  return `${day}/${month}/${year}`;
}

/** Selo "Ligada" / "Desligada" das linhas de automação. */
export function StatusChip({ enabled }: { enabled: boolean }) {
  return (
    <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-xs font-medium", enabled ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "bg-[var(--surface-secondary)] text-muted-foreground")}>
      {enabled ? "Ligada" : "Desligada"}
    </span>
  );
}

/** Mensagem da linha: verde ao salvar, vermelha (role=alert) no erro. */
export function RowMessage({ feedback }: { feedback: RowFeedback }) {
  if (!feedback) return null;
  return (
    <p role={feedback.tone === "error" ? "alert" : "status"} className={cn("px-4 pb-3 text-sm", feedback.tone === "error" ? "text-destructive" : "text-emerald-700 dark:text-emerald-300")}>
      {feedback.text}
    </p>
  );
}

/**
 * Linha compacta de uma automação: nome, uma linha de descrição, selo, chave (salva na hora) e
 * "Ajustar", que abre os detalhes. Usada pela R0 e pela régua R1 a R5.
 */
export function AutomationRow({ id, title, description, scope, enabled, canToggle, toggleLabel, onToggle, open, onOpenChange, feedback, children }: {
  id: string;
  title: string;
  description: string;
  scope?: string;
  enabled: boolean;
  canToggle: boolean;
  toggleLabel: string;
  onToggle: (next: boolean) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  feedback: RowFeedback;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border" aria-labelledby={`${id}-titulo`} data-slot="automation-row">
      <div className="flex items-start gap-3 px-4 py-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 id={`${id}-titulo`} className="text-sm font-semibold">{title}</h3>
            <StatusChip enabled={enabled} />
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
          {enabled && scope ? <p className="mt-0.5 text-xs text-[var(--text-secondary)]">{scope}</p> : null}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Switch checked={enabled} onCheckedChange={(value) => onToggle(Boolean(value))} disabled={!canToggle} aria-label={toggleLabel} />
          <button
            type="button"
            className="inline-flex min-h-9 items-center gap-1 rounded-full px-2 text-xs font-medium text-muted-foreground hover:text-foreground"
            aria-expanded={open}
            aria-controls={`${id}-detalhes`}
            aria-label={`Ajustar ${title}`}
            onClick={() => onOpenChange(!open)}
          >
            <span className="hidden sm:inline" aria-hidden="true">Ajustar</span>
            <ChevronDown aria-hidden="true" size={16} className={cn("transition-transform", open && "rotate-180")} />
          </button>
        </div>
      </div>
      <RowMessage feedback={feedback} />
      {open ? <div id={`${id}-detalhes`} className="grid gap-4 border-t border-border px-4 py-4">{children}</div> : null}
    </section>
  );
}

export function CheckList({ legend, options, selected, onToggle, disabled, empty }: { legend: string; options: Option[]; selected: string[]; onToggle: (id: string, checked: boolean) => void; disabled: boolean; empty: string }) {
  return (
    <fieldset className="grid min-w-0 gap-2" disabled={disabled}>
      <legend className="mb-1 text-sm font-medium">{legend}</legend>
      {options.length ? <div className="grid max-h-48 gap-2 overflow-y-auto sm:grid-cols-2 lg:grid-cols-3">
        {options.map((option) => <label key={option.id} className="flex min-w-0 items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm">
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

/** Régua automática (Fase 4): R1 a R5 em linhas compactas. A chave salva na hora; os detalhes têm o próprio Salvar. Só o diretor edita. */
export function PostSaleAutoRules({ initial, queues, branches, brokers, onSaved }: AutoRulesProps) {
  return (
    <div className="grid gap-3" id="regua-automatica">
      {!initial.ready ? <p className="rounded-xl bg-[var(--surface-secondary)] p-4 text-sm text-muted-foreground">A régua ainda não foi ativada no banco (SQL 0224). Todas as regras seguem desligadas.</p> : null}
      {initial.rules.map((rule) => <AutoRuleRow key={rule.key} rule={rule} canEdit={initial.canEdit} queues={queues} branches={branches} brokers={brokers} onSaved={onSaved} />)}
    </div>
  );
}

export function AutoRuleRow({ rule, canEdit, queues, branches, brokers, onSaved }: { rule: AutoRuleSettings; canEdit: boolean; queues: Option[]; branches: Option[]; brokers: Option[]; onSaved?: (rule: AutoRuleSettings) => void }) {
  const definition = AUTO_RULE_DEFINITIONS[rule.key];
  /** O que está gravado no banco. A chave mostra isto (com atualização otimista). */
  const [saved, setSaved] = useState(rule);
  /** Rascunho do painel de detalhes. */
  const [draft, setDraft] = useState(rule);
  const [delay, setDelay] = useState(String(rule.delayBusinessDays));
  const [limit, setLimit] = useState(String(rule.dailyLimit));
  const [open, setOpen] = useState(false);
  const [feedback, setFeedback] = useState<RowFeedback>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, startTransition] = useTransition();
  const disabled = !canEdit || busy;
  const dirty = JSON.stringify(autoRuleSavePayload(draft, { delay, limit, enabled: saved.enabled })) !== JSON.stringify(autoRuleSavePayload(saved));

  function applySaved(next: AutoRuleSettings) {
    setSaved(next);
    setDraft(next);
    setDelay(String(next.delayBusinessDays));
    setLimit(String(next.dailyLimit));
    onSaved?.(next);
  }

  function toggle(next: boolean) {
    const previous = saved;
    // A chave só muda o "ligada" com os ajustes já salvos; o rascunho do painel só vai com "Salvar ajustes"
    // (Vigia, 09/11). Enquanto grava, a chave fica desabilitada (busy), então os cliques não se cruzam.
    const payload = { ...autoRuleSavePayload(saved), enabled: next };
    setSaved({ ...saved, enabled: next });
    setFeedback(null);
    startTransition(async () => {
      const result = await savePostSaleAutoRuleAction(payload);
      if (!result.ok) {
        setSaved(previous);
        setFeedback({ tone: "error", text: `Não salvou: ${result.error}` });
        return;
      }
      applySaved(result.data);
      setFeedback({ tone: "ok", text: result.data.enabled ? `Regra ${rule.key} ligada. ${describeAutoRuleScope(result.data)}` : `Regra ${rule.key} desligada.` });
    });
  }

  function save() {
    setFeedback(null);
    startTransition(async () => {
      const result = await savePostSaleAutoRuleAction(autoRuleSavePayload(draft, { delay, limit, enabled: saved.enabled }));
      if (!result.ok) { setFeedback({ tone: "error", text: `Não salvou: ${result.error}` }); return; }
      applySaved(result.data);
      setFeedback({ tone: "ok", text: result.data.enabled ? `Ajustes da ${rule.key} salvos. ${describeAutoRuleScope(result.data)}` : `Ajustes da ${rule.key} salvos. A regra segue desligada.` });
    });
  }

  function runPreview() {
    setFeedback(null);
    startTransition(async () => {
      const result = await previewPostSaleAutoRuleAction(autoRuleSavePayload(draft, { delay, limit, enabled: saved.enabled }));
      if (!result.ok) { setFeedback({ tone: "error", text: result.error }); setPreview(null); return; }
      setPreview(result.data);
    });
  }

  return (
    <AutomationRow
      id={`regra-${rule.key}`}
      title={`${rule.key} · ${definition.label}`}
      description={`D+${saved.delayBusinessDays} útil depois de: ${definition.milestoneLabel}.`}
      scope={describeAutoRuleScope(saved)}
      enabled={saved.enabled}
      canToggle={!disabled}
      toggleLabel={`Ligar a regra ${rule.key}`}
      onToggle={toggle}
      open={open}
      onOpenChange={setOpen}
      feedback={feedback}
    >
      <p className="text-xs text-muted-foreground">Pergunta: {definition.asks}. Condição: {definition.condition}.{rule.key === "R5" ? " Recomendação: ligar só depois do piloto das outras regras." : ""}</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-2 text-sm font-medium">Atraso (dias úteis)
          <Input type="number" inputMode="numeric" min={1} max={AUTO_RULE_LIMITS.maxDelayBusinessDays} value={delay} onChange={(event) => setDelay(event.target.value)} disabled={disabled} />
        </label>
        <label className="grid gap-2 text-sm font-medium">Limite por dia
          <Input type="number" inputMode="numeric" min={1} max={AUTO_RULE_LIMITS.dailyLimit} value={limit} onChange={(event) => setLimit(event.target.value)} disabled={disabled} />
          {isAutoRulePilotMode(draft.pilot) ? <span className="text-xs font-normal text-muted-foreground">Em piloto, no máximo {AUTO_RULE_LIMITS.pilotDailyLimit} por dia.</span> : null}
        </label>
      </div>
      <CheckList legend="Filtro: filas (vazio = todas)" options={queues} selected={draft.filters.queueIds} disabled={disabled} empty="Nenhuma fila ativa." onToggle={(id, checked) => setDraft((current) => ({ ...current, filters: { ...current.filters, queueIds: toggleIn(current.filters.queueIds, id, checked) } }))} />
      <CheckList legend="Filtro: unidades (vazio = todas)" options={branches} selected={draft.filters.branchIds} disabled={disabled} empty="Nenhuma unidade ativa." onToggle={(id, checked) => setDraft((current) => ({ ...current, filters: { ...current.filters, branchIds: toggleIn(current.filters.branchIds, id, checked) } }))} />
      <CheckList legend="Filtro: tipo (vazio = PF e PJ)" options={[{ id: "PF", name: "Pessoa física (PF)" }, { id: "PJ", name: "Empresa (PJ)" }]} selected={draft.filters.leadTypes} disabled={disabled} empty="" onToggle={(id, checked) => setDraft((current) => ({ ...current, filters: { ...current.filters, leadTypes: toggleIn(current.filters.leadTypes, id, checked).filter((type): type is "PF" | "PJ" => type === "PF" || type === "PJ") } }))} />
      <CheckList legend="Piloto: filas liberadas (opcional; vazio = todas)" options={queues} selected={draft.pilot.queueIds} disabled={disabled} empty="Nenhuma fila ativa." onToggle={(id, checked) => setDraft((current) => ({ ...current, pilot: { ...current.pilot, queueIds: toggleIn(current.pilot.queueIds, id, checked) } }))} />
      <CheckList legend="Piloto: corretores liberados (opcional)" options={brokers} selected={draft.pilot.brokerIds} disabled={disabled} empty="Nenhum corretor ativo." onToggle={(id, checked) => setDraft((current) => ({ ...current, pilot: { ...current.pilot, brokerIds: toggleIn(current.pilot.brokerIds, id, checked) } }))} />
      {canEdit ? <div className="flex flex-wrap items-center gap-3">
        <Button type="button" onClick={save} loading={busy} disabled={!dirty}>Salvar ajustes</Button>
        <Button type="button" variant="outline" onClick={runPreview} loading={busy}>Ver prévia de amanhã</Button>
        {dirty ? <span className="text-xs text-muted-foreground">Alterações não salvas.</span> : null}
      </div> : <p className="text-xs text-muted-foreground">Só a direção pode alterar a régua.</p>}
      {preview ? <div className="grid gap-2 rounded-xl bg-[var(--surface-secondary)] p-3 text-sm" role="status">
        <p><strong>Amanhã ({formatDay(preview.sendDay)}) sairiam {preview.wouldSend} {preview.wouldSend === 1 ? "mensagem" : "mensagens"}</strong>{preview.eligible > preview.wouldSend ? ` (${preview.eligible} elegíveis, limite de ${preview.limit} por dia)` : ""}.</p>
        <p className="text-xs text-muted-foreground">{preview.candidates} {preview.candidates === 1 ? "lead bate" : "leads batem"} o marco no dia. A conta considera a regra ligada com estas configurações e as proteções de hoje.</p>
        {preview.skipped.length || preview.excluded.length ? <ul className="grid gap-1 text-xs text-muted-foreground">
          {[...preview.skipped, ...preview.excluded].map((item) => <li key={item.reason}>{item.count} fora: {item.reason}</li>)}
        </ul> : null}
      </div> : null}
    </AutomationRow>
  );
}
