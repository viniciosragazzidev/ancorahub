"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import {
  Calculator,
  MagnifyingGlass,
  PencilSimple,
  Plus,
  Power,
  Trash,
} from "@/components/huge-icons";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createCommissionRuleAction,
  deleteCommissionRuleAction,
  toggleCommissionRuleAction,
  updateCommissionRuleAction,
} from "@/features/commissions/actions";
import type { CommissionRuleRecord } from "@/features/commissions/queries";
import type { CommissionActionState } from "@/features/commissions/schema";

type CommissionRuleFormProps = {
  rule?: CommissionRuleRecord | null;
  carriers: { id: string; name: string }[];
  onDone: () => void;
};

function ActionFeedback({ state }: { state: CommissionActionState }) {
  useEffect(() => {
    if (state.success) toast.success("Regra de comissão salva.");
    if (state.error) toast.error(state.error);
  }, [state.success, state.error]);
  return null;
}

function formatPercentage(percent: number): string {
  return `${percent.toFixed(percent % 1 === 0 ? 0 : 1)}%`;
}

function CommissionRuleForm({ rule, carriers, onDone }: CommissionRuleFormProps) {
  const action = rule ? updateCommissionRuleAction : createCommissionRuleAction;
  const [state, formAction, pending] = useActionState<CommissionActionState, FormData>(action, {});
  const formRef = useRef<HTMLFormElement>(null);
  const hiddenPercentagesRef = useRef<HTMLInputElement>(null);

  const [ruleType, setRuleType] = useState<"unica" | "escalonada">(rule?.type ?? "escalonada");
  const [months, setMonths] = useState<{ percent: number }[]>(() => {
    if (rule?.percentages?.length) {
      return rule.percentages.map((p) => ({ percent: p }));
    }
    return [{ percent: 100 }, { percent: 25 }, { percent: 5 }];
  });
  const [appliesToAll, setAppliesToAll] = useState(rule?.appliesToAll ?? false);
  const [selectedCarrier, setSelectedCarrier] = useState(rule?.carrierId ?? "");
  const [selectedPlan, setSelectedPlan] = useState(rule?.planId ?? "");

  // Sync percentages to hidden input whenever months change
  useEffect(() => {
    if (hiddenPercentagesRef.current) {
      hiddenPercentagesRef.current.value = JSON.stringify(months.map((m) => m.percent));
    }
  }, [months]);

  useEffect(() => {
    if (state.success) {
      formRef.current?.reset();
      onDone();
    }
  }, [state.success, onDone]);

  // When switching to "unica", collapse to a single month
  function handleTypeChange(newType: "unica" | "escalonada") {
    setRuleType(newType);
    if (newType === "unica" && months.length > 1) {
      setMonths([months[0]]);
    }
  }

  function addMonth() {
    if (months.length < 60) setMonths([...months, { percent: 0 }]);
  }

  function removeMonth(index: number) {
    if (months.length > 1) setMonths(months.filter((_, i) => i !== index));
  }

  function updatePercent(index: number, value: string) {
    const newMonths = [...months];
    newMonths[index] = { percent: Math.max(0, Math.min(1000, parseFloat(value) || 0)) };
    setMonths(newMonths);
  }

  const totalPercent = months.reduce((sum, m) => sum + m.percent, 0);
  const isValid = months.every((m) => m.percent > 0);

  return (
    <form ref={formRef} action={formAction} className="space-y-5">
      {rule && <input type="hidden" name="ruleId" value={rule.id} />}
      <input
        ref={hiddenPercentagesRef}
        type="hidden"
        name="percentages"
        defaultValue={JSON.stringify(months.map((m) => m.percent))}
      />

      {/* Nome da regra */}
      <div className="space-y-2">
        <Label htmlFor="rule-name">Nome da regra</Label>
        <Input
          id="rule-name"
          name="name"
          defaultValue={rule?.name ?? ""}
          placeholder="Ex.: Comissão padrão individual"
          required
        />
      </div>

      {/* Escopo — a quem se aplica */}
      <fieldset className="space-y-3 rounded-lg border p-4">
        <legend className="text-sm font-medium">Aplicar a</legend>

        <label className="flex items-start gap-3 rounded-md border border-border p-3 hover:bg-muted/30 cursor-pointer">
          <input
            type="checkbox"
            name="appliesToAll"
            checked={appliesToAll}
            onChange={(e) => setAppliesToAll(e.target.checked)}
            className="mt-0.5 size-4 warning-primary"
          />
          <div>
            <p className="text-sm font-medium">Aplicar a todos os planos e operadoras</p>
            <p className="text-xs text-muted-foreground mt-0.5">Regra geral usada quando não houver regra específica.</p>
          </div>
        </label>

        {!appliesToAll && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="rule-carrier">Operadora</Label>
              <select
                id="rule-carrier"
                name="carrierId"
                value={selectedCarrier}
                onChange={(e) => {
                  setSelectedCarrier(e.target.value);
                  setSelectedPlan("");
                }}
                className="flex h-9 w-full rounded-lg border border-input bg-input/30 px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                <option value="">Selecione uma operadora</option>
                {carriers.map((carrier) => (
                  <option key={carrier.id} value={carrier.id}>
                    {carrier.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="rule-plan">Plano</Label>
              <select
                id="rule-plan"
                name="planId"
                value={selectedPlan}
                onChange={(e) => setSelectedPlan(e.target.value)}
                className="flex h-9 w-full rounded-lg border border-input bg-input/30 px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                <option value="">Todos os planos</option>
                {selectedCarrier && (
                  <option value="__all__">Todos os planos desta operadora</option>
                )}
              </select>
              <p className="text-xs text-muted-foreground">
                {selectedPlan && selectedPlan !== "__all__" ? "Regra específica para este plano." : selectedCarrier ? "Regra para todos os planos da operadora." : "Defina a operadora primeiro."}
              </p>
            </div>
          </div>
        )}
      </fieldset>

      {/* Tipo de comissão */}
      <fieldset className="space-y-3 rounded-lg border p-4">
        <legend className="text-sm font-medium">Tipo de comissão</legend>

        <div className="flex gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="type"
              value="unica"
              checked={ruleType === "unica"}
              onChange={() => handleTypeChange("unica")}
              className="size-4 warning-primary"
            />
            <span className="text-sm">Comissão única</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="type"
              value="escalonada"
              checked={ruleType === "escalonada"}
              onChange={() => handleTypeChange("escalonada")}
              className="size-4 warning-primary"
            />
            <span className="text-sm">Comissão escalonada</span>
          </label>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Parcelas
            </p>
            {ruleType === "escalonada" && months.length < 60 && (
              <Button type="button" size="xs" variant="outline" onClick={addMonth}>
                <Plus className="size-3" /> Adicionar mês
              </Button>
            )}
          </div>

          <div className="space-y-2">
            {months.map((month, index) => (
              <div key={index} className="flex items-center gap-2">
                <span className="w-16 text-xs text-muted-foreground shrink-0">
                  {index === 0 ? "1º mês" : `${index + 1}º mês`}
                </span>
                <div className="relative flex-1">
                  <Input
                    type="number"
                    min="0"
                    max="1000"
                    step="0.1"
                    value={month.percent || ""}
                    onChange={(e) => updatePercent(index, e.target.value)}
                    className="pr-8"
                    placeholder="0"
                  />
                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
                </div>
                {months.length > 1 && (
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="ghost"
                    onClick={() => removeMonth(index)}
                    aria-label={`Remover ${index + 1}º mês`}
                    className="text-destructive shrink-0"
                  >
                    <Trash className="size-3.5" />
                  </Button>
                )}
              </div>
            ))}
          </div>

          {months.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 pt-2">
              <span className="text-xs text-muted-foreground">Preview:</span>
              {months.map((month, index) => (
                <Badge
                  key={index}
                  variant={month.percent > 0 ? "secondary" : "outline"}
                  className={month.percent > 0 ? "bg-primary/10 text-primary" : ""}
                >
                  M{index + 1}: {formatPercentage(month.percent)}
                </Badge>
              ))}
              {ruleType === "escalonada" && months.length > 1 && (
                <Badge variant="outline" className="text-muted-foreground">
                  Total: {formatPercentage(totalPercent)}
                </Badge>
              )}
            </div>
          )}

          {!isValid && (
            <p className="text-xs text-destructive">Todos os percentuais devem ser maiores que zero.</p>
          )}
        </div>
      </fieldset>

      <Button className="w-full" type="submit" disabled={pending || !isValid}>
        {pending ? "Salvando..." : rule ? "Salvar alterações" : "Criar regra de comissão"}
      </Button>
      <ActionFeedback state={state} />
    </form>
  );
}

function CommissionRuleCard({
  rule,
  carriers,
}: {
  rule: CommissionRuleRecord;
  carriers: { id: string; name: string }[];
}) {
  const [toggleState, toggleAction, togglePending] = useActionState<CommissionActionState, FormData>(
    toggleCommissionRuleAction,
    {},
  );
  const [deleteState, deleteAction, deletePending] = useActionState<CommissionActionState, FormData>(
    deleteCommissionRuleAction,
    {},
  );
  const [editing, setEditing] = useState(false);

  const carrierName = rule.carrierName ?? (rule.appliesToAll ? "Todas" : "—");
  const planName = rule.planName ?? (rule.appliesToAll ? "Todos" : rule.carrierId ? "Todos da operadora" : "—");
  const typeLabel = rule.type === "unica" ? "Única" : "Escalonada";
  const pcts = Array.isArray(rule.percentages) ? rule.percentages : [100];

  if (editing) {
    return (
      <Card className="border-primary/20 bg-primary/[0.03] shadow-none">
        <CardContent className="p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div>
              <h4 className="font-medium">Editar: {rule.name}</h4>
              <p className="text-xs text-muted-foreground mt-0.5">Altere os dados da regra de comissão.</p>
            </div>
            <Button size="icon-sm" variant="ghost" onClick={() => setEditing(false)} aria-label="Cancelar">
              <Trash className="size-4" />
            </Button>
          </div>
          <CommissionRuleForm rule={rule} carriers={carriers} onDone={() => setEditing(false)} />
        </CardContent>
      </Card>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, ease: [0, 0, 0.2, 1] }}
    >
      <Card className="border-border bg-card shadow-none transition-all duration-200 hover:border-primary/25 hover:shadow-sm">
        <CardContent className="p-4 sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm font-semibold">{rule.name}</h3>
                <Badge
                  variant={rule.active ? "success" : "outline"}
                  className={rule.active ? "" : "text-muted-foreground"}
                >
                  {rule.active ? "Ativa" : "Inativa"}
                </Badge>
                <Badge variant="secondary">{typeLabel}</Badge>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span>Operadora: <strong>{carrierName}</strong></span>
                <span>Plano: <strong>{planName}</strong></span>
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <form action={toggleAction}>
                <input type="hidden" name="ruleId" value={rule.id} />
                <Button type="submit" size="icon-sm" variant="ghost" disabled={togglePending} aria-label={rule.active ? "Desativar" : "Ativar"}>
                  <Power className="size-4" />
                </Button>
              </form>
              <Button size="icon-sm" variant="ghost" onClick={() => setEditing(true)} aria-label="Editar">
                <PencilSimple className="size-4" />
              </Button>
              <form action={deleteAction}>
                <input type="hidden" name="ruleId" value={rule.id} />
                <Button type="submit" size="icon-sm" variant="ghost" disabled={deletePending} aria-label="Excluir" className="text-destructive hover:text-destructive">
                  <Trash className="size-4" />
                </Button>
              </form>
            </div>
          </div>

          {/* Timeline visual dos percentuais */}
          <div className="mt-4 flex flex-wrap items-center gap-1.5">
            {pcts.map((pct, index) => (
              <div
                key={index}
                className="flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1"
              >
                <span className="text-[10px] font-medium text-primary">
                  M{index + 1}
                </span>
                <span className="text-[11px] font-semibold text-primary">
                  {formatPercentage(pct)}
                </span>
                {index < pcts.length - 1 && (
                  <span className="text-[10px] text-muted-foreground mx-0.5">→</span>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
      <ActionFeedback state={toggleState} />
      <ActionFeedback state={deleteState} />
    </motion.div>
  );
}

export function CommissionRulesManager({
  rules,
  carriers,
}: {
  rules: CommissionRuleRecord[];
  carriers: { id: string; name: string }[];
}) {
  const [search, setSearch] = useState("");
  const [filterActive, setFilterActive] = useState<"all" | "active" | "inactive">("all");
  const [showCreate, setShowCreate] = useState(false);

  const normalizedQuery = search
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR");

  const visibleRules = rules.filter((rule) => {
    const matchesSearch =
      !normalizedQuery ||
      rule.name.toLocaleLowerCase("pt-BR").includes(normalizedQuery) ||
      (rule.carrierName ?? "").toLocaleLowerCase("pt-BR").includes(normalizedQuery);
    const matchesFilter =
      filterActive === "all" ||
      (filterActive === "active" && rule.active) ||
      (filterActive === "inactive" && !rule.active);
    return matchesSearch && matchesFilter;
  });

  const activeCount = rules.filter((r) => r.active).length;

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <motion.div
        className="grid gap-3 sm:grid-cols-3"
        initial="hidden"
        animate="visible"
        variants={{
          hidden: { opacity: 0 },
          visible: { opacity: 1, transition: { staggerChildren: 0.06, delayChildren: 0.04 } },
        }}
      >
        {[
          { label: "Regras cadastradas", value: rules.length },
          { label: "Regras ativas", value: activeCount },
          { label: "Operadoras com regra", value: new Set(rules.filter((r) => r.carrierId).map((r) => r.carrierId)).size },
        ].map((item) => (
          <motion.div
            key={item.label}
            variants={{
              hidden: { opacity: 0, y: 8 },
              visible: { opacity: 1, y: 0, transition: { duration: 0.18, ease: [0, 0, 0.2, 1] } },
            }}
            whileHover={{ y: -2, transition: { duration: 0.2, ease: [0, 0, 0.2, 1] } }}
            whileTap={{ scale: 0.995, transition: { duration: 0.1 } }}
          >
            <Card size="sm" className="group/card border-border bg-card shadow-none transition-all duration-200 hover:border-primary/25 hover:shadow-sm">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground transition-colors duration-200 group-hover/card:text-foreground">{item.label}</p>
                <p className="mt-2 font-mono text-2xl font-semibold transition-colors duration-200 group-hover/card:text-primary">{item.value}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </motion.div>

      {/* Create trigger */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-base font-medium">Regras de comissão</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Defina como os corretores serão comissionados por operadora e plano.
          </p>
        </div>
        {!showCreate && (
          <Button onClick={() => setShowCreate(true)}>
            <Plus className="size-4" /> Nova regra
          </Button>
        )}
      </div>

      {/* Create form inline */}
      {showCreate && (
        <Card className="border-primary/20 bg-primary/[0.03] shadow-none">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div>
                <h4 className="font-medium">Nova regra de comissão</h4>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Configure os percentuais de repasse para vendas realizadas.
                </p>
              </div>
              <Button size="icon-sm" variant="ghost" onClick={() => setShowCreate(false)} aria-label="Cancelar">
                <Trash className="size-4" />
              </Button>
            </div>
            <CommissionRuleForm
              carriers={carriers}
              onDone={() => setShowCreate(false)}
            />
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1 sm:max-w-xs">
          <MagnifyingGlass className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
            placeholder="Buscar por nome ou operadora..."
            aria-label="Buscar regra de comissão"
          />
        </div>
        <select
          value={filterActive}
          onChange={(e) => setFilterActive(e.target.value as "all" | "active" | "inactive")}
          className="h-9 rounded-lg border border-input bg-input/30 px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
          aria-label="Filtrar por status"
        >
          <option value="all">Todas</option>
          <option value="active">Ativas</option>
          <option value="inactive">Inativas</option>
        </select>
      </div>

      {/* Rules list / empty states */}
      {rules.length === 0 && !showCreate ? (
        <div className="flex flex-col items-center rounded-xl border border-dashed px-6 py-14 text-center">
          <div className="flex size-11 items-center justify-center rounded-xl bg-muted">
            <Calculator className="size-5 text-muted-foreground" />
          </div>
          <p className="mt-3 font-medium">Nenhuma regra de comissão</p>
          <p className="mt-1 text-sm text-muted-foreground max-w-sm">
            Crie a primeira regra para definir como as vendas serão repassadas aos corretores.
          </p>
          <Button className="mt-4" onClick={() => setShowCreate(true)} variant="outline">
            <Plus className="size-4" /> Criar primeira regra
          </Button>
        </div>
      ) : visibleRules.length === 0 && !showCreate ? (
        <div className="flex flex-col items-center px-6 py-12 text-center">
          <p className="text-sm font-medium">Nenhuma regra encontrada</p>
          <p className="text-sm text-muted-foreground mt-1">
            Ajuste a busca ou o filtro para ver outros resultados.
          </p>
          <Button
            variant="outline"
            className="mt-4"
            onClick={() => { setSearch(""); setFilterActive("all"); }}
          >
            Limpar filtros
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {visibleRules.map((rule) => (
            <CommissionRuleCard
              key={rule.id}
              rule={rule}
              carriers={carriers}
            />
          ))}
        </div>
      )}
    </div>
  );
}
