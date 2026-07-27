"use client";

import { useActionState, useEffect, useState } from "react";
import { motion } from "motion/react";
import {
  MagnifyingGlass,
  PencilSimple,
  Plus,
  Power,
  Target,
  Trash,
} from "@/components/huge-icons";
import { EmptyState } from "@/components/empty-state";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  deleteGoalAction,
  recalculateGoalProgressAction,
  toggleGoalAction,
} from "@/features/goals/actions";
import { GoalForm } from "./goal-form";
import type { GoalRecord, TeamMemberOption } from "@/features/goals/queries";
import type { GoalActionState } from "@/features/goals/schema";

type GoalsManagerProps = {
  goals: GoalRecord[];
  teamMembers: TeamMemberOption[];
  branches: { id: string; name: string }[];
};

const targetTypeLabels: Record<string, string> = {
  sales_count: "Vendas",
  revenue: "Receita",
  conversion_rate: "Conversão",
  leads_contacted: "Contatos",
};

const scopeLabels: Record<string, string> = {
  broker: "Corretor",
  team: "Equipe",
  branch: "Filial",
  tenant: "Corretora",
};

function ActionFeedback({ state }: { state: GoalActionState }) {
  useEffect(() => {
    if (state.success) toast.success(state.success);
    if (state.error) toast.error(state.error);
  }, [state.success, state.error]);
  return null;
}

function GoalCard({
  goal,
  teamMembers,
  branches,
}: {
  goal: GoalRecord;
  teamMembers: TeamMemberOption[];
  branches: { id: string; name: string }[];
}) {
  const [toggleState, toggleAction, togglePending] = useActionState<GoalActionState, FormData>(
    toggleGoalAction,
    {},
  );
  const [deleteState, deleteAction, deletePending] = useActionState<GoalActionState, FormData>(
    deleteGoalAction,
    {},
  );
  const [recalcState, recalcAction, recalcPending] = useActionState<GoalActionState, FormData>(
    recalculateGoalProgressAction,
    {},
  );
  const [editing, setEditing] = useState(false);

  const pct = goal.progressPercentage
    ? Math.min(100, Math.max(0, parseFloat(goal.progressPercentage)))
    : 0;

  const progressColor =
    pct >= 100 ? "bg-emerald-500" :
    pct >= 60 ? "bg-primary" :
    pct >= 30 ? "bg-amber-500" :
    "bg-rose-500";

  if (editing) {
    return (
      <Card className="border-primary/20 bg-primary/[0.03] shadow-none">
        <CardContent className="p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div>
              <h4 className="font-medium">Editar: {goal.name}</h4>
              <p className="text-xs text-muted-foreground mt-0.5">Altere os dados da meta.</p>
            </div>
            <Button size="icon-sm" variant="ghost" onClick={() => setEditing(false)} aria-label="Cancelar">
              <Trash className="size-4" />
            </Button>
          </div>
          <GoalForm goal={goal} teamMembers={teamMembers} branches={branches} onDone={() => setEditing(false)} />
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
          {/* Header */}
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <Target className="size-4 text-primary shrink-0" />
                <h3 className="text-sm font-semibold">{goal.name}</h3>
                <Badge
                  variant={goal.active ? "success" : "outline"}
                  className={goal.active ? "" : "text-muted-foreground"}
                >
                  {goal.active ? "Ativa" : "Inativa"}
                </Badge>
                <Badge variant="secondary">{scopeLabels[goal.scope]}</Badge>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span>Período: <strong>{goal.period}</strong></span>
                <span>Tipo: <strong>{targetTypeLabels[goal.targetType]}</strong></span>
                {goal.scopeName && <span>Destino: <strong>{goal.scopeName}</strong></span>}
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <form action={recalcAction}>
                <input type="hidden" name="goalId" value={goal.id} />
                <Button type="submit" size="icon-sm" variant="ghost" disabled={recalcPending} aria-label="Recalcular" title="Recalcular progresso">
                  <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M1 4v6h6" /><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
                  </svg>
                </Button>
              </form>
              <form action={toggleAction}>
                <input type="hidden" name="goalId" value={goal.id} />
                <Button type="submit" size="icon-sm" variant="ghost" disabled={togglePending} aria-label={goal.active ? "Desativar" : "Ativar"}>
                  <Power className="size-4" />
                </Button>
              </form>
              <Button size="icon-sm" variant="ghost" onClick={() => setEditing(true)} aria-label="Editar">
                <PencilSimple className="size-4" />
              </Button>
              <form action={deleteAction}>
                <input type="hidden" name="goalId" value={goal.id} />
                <Button type="submit" size="icon-sm" variant="ghost" disabled={deletePending} aria-label="Excluir" className="text-destructive hover:text-destructive">
                  <Trash className="size-4" />
                </Button>
              </form>
            </div>
          </div>

          {/* Progress bar */}
          <div className="mt-4">
            <div className="relative h-2.5 overflow-hidden rounded-full bg-muted">
              <motion.div
                className={`absolute inset-y-0 left-0 rounded-full ${progressColor}`}
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 0.8, ease: [0, 0, 0.2, 1] }}
              />
            </div>
            <div className="mt-2 flex items-center justify-between text-xs">
              <span className="text-muted-foreground">
                Meta: {goal.targetValue}
                {goal.targetType === "revenue" ? " (R$)" : ""}
              </span>
              <span className="font-mono font-semibold tabular-nums">
                {goal.progressCurrentValue ?? "0"} / {goal.targetValue}
                <span className={`ml-1.5 ${pct >= 100 ? "text-emerald-600 dark:text-emerald-400" : "text-foreground"}`}>
                  ({pct.toFixed(0)}%)
                </span>
              </span>
            </div>
            {goal.progressCalculatedAt && (
              <p className="mt-1.5 text-[10px] text-muted-foreground">
                Último cálculo: {new Intl.DateTimeFormat("pt-BR", {
                  dateStyle: "short",
                  timeStyle: "short",
                }).format(new Date(goal.progressCalculatedAt))}
              </p>
            )}
          </div>
        </CardContent>
      </Card>
      <ActionFeedback state={toggleState} />
      <ActionFeedback state={deleteState} />
      <ActionFeedback state={recalcState} />
    </motion.div>
  );
}

export function GoalsManager({ goals, teamMembers, branches }: GoalsManagerProps) {
  const [search, setSearch] = useState("");
  const [filterActive, setFilterActive] = useState<"all" | "active" | "inactive">("all");
  const [filterScope, setFilterScope] = useState<string>("all");
  const [showCreate, setShowCreate] = useState(false);

  const normalizedQuery = search
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR");

  const visibleGoals = goals.filter((goal) => {
    const matchesSearch =
      !normalizedQuery ||
      goal.name.toLocaleLowerCase("pt-BR").includes(normalizedQuery) ||
      (goal.scopeName ?? "").toLocaleLowerCase("pt-BR").includes(normalizedQuery);
    const matchesFilter =
      filterActive === "all" ||
      (filterActive === "active" && goal.active) ||
      (filterActive === "inactive" && !goal.active);
    const matchesScope =
      filterScope === "all" || goal.scope === filterScope;
    return matchesSearch && matchesFilter && matchesScope;
  });

  const activeCount = goals.filter((g) => g.active).length;

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <motion.div
        className="grid gap-3 sm:grid-cols-4"
        initial="hidden"
        animate="visible"
        variants={{
          hidden: { opacity: 0 },
          visible: { opacity: 1, transition: { staggerChildren: 0.06, delayChildren: 0.04 } },
        }}
      >
        {[
          { label: "Metas cadastradas", value: goals.length },
          { label: "Metas ativas", value: activeCount },
          { label: "Corretores com meta", value: goals.filter((g) => g.scope === "broker" && g.active).length },
          { label: "Períodos", value: new Set(goals.map((g) => g.period)).size },
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
          <h2 className="text-base font-medium">Metas comerciais</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Defina metas de desempenho para corretores, equipes, filiais ou toda a corretora.
          </p>
        </div>
        {!showCreate && (
          <Button onClick={() => setShowCreate(true)}>
            <Plus className="size-4" /> Nova meta
          </Button>
        )}
      </div>

      {/* Create form inline */}
      {showCreate && (
        <Card className="border-primary/20 bg-primary/[0.03] shadow-none">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div>
                <h4 className="font-medium">Nova meta comercial</h4>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Defina o escopo, tipo, valor e período da meta.
                </p>
              </div>
              <Button size="icon-sm" variant="ghost" onClick={() => setShowCreate(false)} aria-label="Cancelar">
                <Trash className="size-4" />
              </Button>
            </div>
            <GoalForm
              teamMembers={teamMembers}
              branches={branches}
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
            placeholder="Buscar por nome ou destino..."
            aria-label="Buscar meta"
          />
        </div>
        <select
          value={filterScope}
          onChange={(e) => setFilterScope(e.target.value)}
          className="h-9 rounded-lg border border-input bg-input/30 px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
          aria-label="Filtrar por escopo"
        >
          <option value="all">Todos os escopos</option>
          <option value="broker">Corretor</option>
          <option value="team">Equipe</option>
          <option value="branch">Filial</option>
          <option value="tenant">Corretora</option>
        </select>
        <select
          value={filterActive}
          onChange={(e) => setFilterActive(e.target.value as "all" | "active" | "inactive")}
          className="h-9 rounded-lg border border-input bg-input/30 px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
          aria-label="Filtrar por status"
        >
          <option value="all">Ativas e inativas</option>
          <option value="active">Ativas</option>
          <option value="inactive">Inativas</option>
        </select>
      </div>

      {/* Goals list / empty states */}
      {goals.length === 0 && !showCreate ? (
        <EmptyState
          icon={Target}
          title="Nenhuma meta cadastrada"
          description="Crie a primeira meta para acompanhar o desempenho comercial da sua equipe."
          action={
            <Button onClick={() => setShowCreate(true)} variant="outline">
              <Plus className="size-4" /> Criar primeira meta
            </Button>
          }
        />
      ) : visibleGoals.length === 0 && !showCreate ? (
        <EmptyState
          title="Nenhuma meta encontrada"
          description="Ajuste a busca ou os filtros para ver outros resultados."
          action={
            <Button
              variant="outline"
              onClick={() => { setSearch(""); setFilterActive("all"); setFilterScope("all"); }}
            >
              Limpar filtros
            </Button>
          }
        />
      ) : (
        <div className="space-y-4">
          {visibleGoals.map((goal) => (
            <GoalCard
              key={goal.id}
              goal={goal}
              teamMembers={teamMembers}
              branches={branches}
            />
          ))}
        </div>
      )}
    </div>
  );
}
