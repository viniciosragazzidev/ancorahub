"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createGoalAction,
  updateGoalAction,
} from "@/features/goals/actions";
import type { GoalRecord, TeamMemberOption } from "@/features/goals/queries";
import type { GoalActionState } from "@/features/goals/schema";

type GoalFormProps = {
  goal?: GoalRecord | null;
  teamMembers: TeamMemberOption[];
  branches: { id: string; name: string }[];
  onDone: () => void;
};

const targetTypeLabels: Record<string, string> = {
  sales_count: "Quantidade de vendas",
  revenue: "Receita (R$)",
  conversion_rate: "Taxa de conversão (%)",
  leads_contacted: "Leads contatados",
};

const targetTypeSuffixes: Record<string, string> = {
  sales_count: "vendas",
  revenue: "R$",
  conversion_rate: "%",
  leads_contacted: "contatos",
};

export function GoalForm({ goal, teamMembers, branches, onDone }: GoalFormProps) {
  const action = goal ? updateGoalAction : createGoalAction;
  const [state, formAction, pending] = useActionState<GoalActionState, FormData>(action, {});
  const formRef = useRef<HTMLFormElement>(null);

  const [scope, setScope] = useState<string>(goal?.scope ?? "broker");
  const [scopeId, setScopeId] = useState<string>(goal?.scopeId ?? "");
  const [targetType, setTargetType] = useState<string>(goal?.targetType ?? "sales_count");

  // Generate default period (current month)
  const now = new Date();
  const defaultPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const defaultStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
  const defaultEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0];

  useEffect(() => {
    if (state.success) {
      formRef.current?.reset();
      toast.success(goal ? "Meta atualizada!" : "Meta criada!");
      onDone();
    }
  }, [state.success, onDone, goal]);

  return (
    <form ref={formRef} action={formAction} className="space-y-5">
      {goal && <input type="hidden" name="goalId" value={goal.id} />}

      {/* Nome da meta */}
      <div className="space-y-2">
        <Label htmlFor="goal-name">Nome da meta</Label>
        <Input
          id="goal-name"
          name="name"
          defaultValue={goal?.name ?? ""}
          placeholder="Ex.: Meta de vendas Julho/2026"
          required
        />
      </div>

      {/* Escopo */}
      <fieldset className="space-y-3 rounded-lg border p-4">
        <legend className="text-sm font-medium">Escopo</legend>

        <div className="grid gap-3 sm:grid-cols-2">
          {(["broker", "team", "branch", "tenant"] as const).map((value) => (
            <label
              key={value}
              className={`flex cursor-pointer items-center gap-3 rounded-md border p-3 transition-colors hover:bg-muted/30 ${scope === value ? "border-primary bg-primary/5" : "border-border"}`}
            >
              <input
                type="radio"
                name="scope"
                value={value}
                checked={scope === value}
                onChange={(e) => {
                  setScope(e.target.value);
                  setScopeId("");
                }}
                className="size-4 warning-primary"
              />
              <div>
                <p className="text-sm font-medium">
                  {value === "broker" ? "Corretor" :
                    value === "team" ? "Equipe" :
                      value === "branch" ? "Filial" : "Corretora"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {value === "broker" ? "Meta individual por corretor" :
                    value === "team" ? "Meta para um grupo" :
                      value === "branch" ? "Meta para toda a filial" :
                        "Meta para toda a corretora"}
                </p>
              </div>
            </label>
          ))}
        </div>

        {scope !== "tenant" && (
          <div className="space-y-2">
            <Label htmlFor="goal-scopeId">
              {scope === "broker" ? "Corretor" :
                scope === "branch" ? "Filial" : "Equipe"}
            </Label>
            <select
              id="goal-scopeId"
              name="scopeId"
              value={scopeId}
              onChange={(e) => setScopeId(e.target.value)}
              className="flex h-9 w-full rounded-lg border border-input bg-input/30 px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
              required={scope !== "tenant"}
            >
              <option value="">
                Selecione {scope === "broker" ? "um corretor" :
                  scope === "branch" ? "uma filial" : "uma equipe"}
              </option>
              {scope === "broker" && teamMembers.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}{m.branchName ? ` — ${m.branchName}` : ""}
                </option>
              ))}
              {scope === "branch" && branches.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
              {scope === "team" && teamMembers.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>
        )}
      </fieldset>

      {/* Tipo de meta */}
      <fieldset className="space-y-3 rounded-lg border p-4">
        <legend className="text-sm font-medium">Tipo de meta</legend>

        <div className="grid gap-2 sm:grid-cols-2">
          {(["sales_count", "revenue", "conversion_rate", "leads_contacted"] as const).map((type) => (
            <label
              key={type}
              className={`flex cursor-pointer items-center gap-3 rounded-md border p-3 transition-colors hover:bg-muted/30 ${targetType === type ? "border-primary bg-primary/5" : "border-border"}`}
            >
              <input
                type="radio"
                name="targetType"
                value={type}
                checked={targetType === type}
                onChange={(e) => setTargetType(e.target.value)}
                className="size-4 warning-primary"
              />
              <span className="text-sm font-medium">{targetTypeLabels[type]}</span>
            </label>
          ))}
        </div>

        <div className="space-y-2">
          <Label htmlFor="goal-targetValue">
            Meta ({targetTypeSuffixes[targetType]})
          </Label>
          <Input
            id="goal-targetValue"
            name="targetValue"
            type="number"
            step={targetType === "conversion_rate" ? "0.01" : "1"}
            min="0"
            defaultValue={goal?.targetValue ?? ""}
            placeholder={targetType === "conversion_rate" ? "Ex.: 50" : "Ex.: 100"}
            required
          />
          {targetType === "conversion_rate" && (
            <p className="text-xs text-muted-foreground">
              Valor em porcentagem (ex.: 50 = 50% de conversão)
            </p>
          )}
        </div>
      </fieldset>

      {/* Período */}
      <fieldset className="space-y-3 rounded-lg border p-4">
        <legend className="text-sm font-medium">Período</legend>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="goal-period">Período (mês)</Label>
            <Input
              id="goal-period"
              name="period"
              defaultValue={goal?.period ?? defaultPeriod}
              placeholder="YYYY-MM"
              pattern="\d{4}-\d{2}"
              required
            />
            <p className="text-xs text-muted-foreground">Formato: YYYY-MM</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="goal-startDate">Data início</Label>
            <Input
              id="goal-startDate"
              name="startDate"
              type="date"
              defaultValue={goal?.startDate ? new Date(goal.startDate).toISOString().split("T")[0] : defaultStart}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="goal-endDate">Data fim</Label>
            <Input
              id="goal-endDate"
              name="endDate"
              type="date"
              defaultValue={goal?.endDate ? new Date(goal.endDate).toISOString().split("T")[0] : defaultEnd}
              required
            />
          </div>
        </div>
      </fieldset>

      {/* Active toggle (hidden for create) */}
      {goal && (
        <input type="hidden" name="active" value="true" />
      )}

      <Button className="w-full" type="submit" disabled={pending}>
        {pending ? "Salvando..." : goal ? "Salvar alterações" : "Criar meta"}
      </Button>
    </form>
  );
}
