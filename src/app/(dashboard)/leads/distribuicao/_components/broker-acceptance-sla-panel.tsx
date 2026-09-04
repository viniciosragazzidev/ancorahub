"use client";

import { useState, useTransition } from "react";
import { toast } from "@/components/ui/sonner";
import { Clock, ShieldCheck, ArrowsClockwise, Warning, Check } from "@phosphor-icons/react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { saveBrokerAcceptanceSlaAction } from "@/features/lead-distribution/sla-actions";

interface BrokerAcceptanceSlaPanelProps {
  initialMinutes: number;
  initialAutoRedistribute?: boolean;
  canEdit: boolean;
}

const PRESET_MINUTES = [5, 10, 15, 30, 60] as const;

export function BrokerAcceptanceSlaPanel({
  initialMinutes = 15,
  initialAutoRedistribute = true,
  canEdit = true,
}: BrokerAcceptanceSlaPanelProps) {
  const [minutes, setMinutes] = useState<number>(initialMinutes || 15);
  const [autoRedistribute, setAutoRedistribute] = useState<boolean>(initialAutoRedistribute);
  const [isPending, startTransition] = useTransition();

  const handlePreset = (val: number) => {
    if (!canEdit) return;
    setMinutes(val);
  };

  const handleSave = () => {
    if (!canEdit) return;
    startTransition(async () => {
      const res = await saveBrokerAcceptanceSlaAction({
        slaFirstContactMinutes: minutes,
        autoRedistribute,
      });

      if (res.success) {
        toast.success("Parâmetros de SLA de aceite salvos com sucesso!");
      } else {
        toast.error(res.error || "Não foi possível salvar os parâmetros.");
      }
    });
  };

  return (
    <Card className="border-border/80 shadow-xs">
      <CardHeader className="p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <span className="grid size-9 place-items-center rounded-xl bg-primary/10 text-primary">
              <Clock className="size-5" />
            </span>
            <div>
              <CardTitle className="text-base">SLA de Aceite & Início de Atendimento</CardTitle>
              <CardDescription className="text-xs">
                Controle quanto tempo o corretor pode demorar para aceitar o lead e iniciar o primeiro contato antes de perder a oportunidade.
              </CardDescription>
            </div>
          </div>
          <Badge variant={autoRedistribute ? "success" : "secondary"} className="text-xs px-2.5 py-0.5">
            {autoRedistribute ? "Redistribuição Ativa" : "Apenas Alertas"}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="p-4 sm:p-5 pt-0 space-y-5">
        {/* Toggle de Redistribuição Automática */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-border/70 bg-muted/30 p-3.5">
          <div className="space-y-0.5">
            <label htmlFor="auto-redistribute-toggle" className="text-xs font-semibold text-foreground cursor-pointer">
              Tirar lead e passar para o próximo corretor
            </label>
            <p className="text-[11px] text-muted-foreground">
              Se o corretor não iniciar o atendimento dentro do prazo, o lead é redistribuído automaticamente para o próximo corretor da escala/plantão.
            </p>
          </div>
          <Switch
            id="auto-redistribute-toggle"
            checked={autoRedistribute}
            onCheckedChange={setAutoRedistribute}
            disabled={!canEdit || isPending}
          />
        </div>

        {/* Seleção do Tempo Limite em Minutos */}
        <div className="space-y-2.5">
          <FieldLabel className="text-xs font-semibold text-foreground">
            Tempo limite para o corretor aceitar/iniciar o contato:
          </FieldLabel>

          <div className="flex flex-wrap items-center gap-2">
            {PRESET_MINUTES.map((preset) => {
              const isSelected = minutes === preset;
              return (
                <button
                  key={preset}
                  type="button"
                  disabled={!canEdit || isPending}
                  onClick={() => handlePreset(preset)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all duration-150 active:scale-95 disabled:opacity-50",
                    isSelected
                      ? "border-primary bg-primary text-primary-foreground shadow-xs font-bold"
                      : "border-border bg-card text-foreground hover:bg-muted",
                  )}
                >
                  {isSelected && <Check className="size-3.5 stroke-[2.5]" />}
                  <span>{preset} min</span>
                </button>
              );
            })}

            <div className="flex items-center gap-1.5 ml-auto min-w-[140px]">
              <Input
                type="number"
                min={1}
                max={1440}
                value={minutes}
                onChange={(e) => setMinutes(Math.max(1, Number(e.target.value) || 1))}
                disabled={!canEdit || isPending}
                className="h-8 w-20 text-xs text-center"
              />
              <span className="text-xs text-muted-foreground">minutos</span>
            </div>
          </div>
        </div>

        {/* Alerta explicativo do Worker */}
        <div className="flex items-start gap-2.5 rounded-lg border border-primary/20 bg-primary/[0.03] p-3 text-xs text-foreground">
          <ShieldCheck className="size-4 text-primary shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            O <strong>worker periódico de SLA</strong> verifica a cada minuto os leads com status <code>distribuído</code>. Caso o tempo ultrapasse <strong>{minutes} minutos</strong> sem que o corretor registre o primeiro contato ou abra o atendimento, o lead é transferido de forma transparente e auditável.
          </p>
        </div>

        {/* Botão Salvar */}
        {canEdit && (
          <div className="flex justify-end pt-1">
            <Button
              size="sm"
              disabled={isPending}
              onClick={handleSave}
              className="gap-2 font-semibold"
            >
              {isPending && <ArrowsClockwise className="size-4 animate-spin" />}
              <span>{isPending ? "Salvando..." : "Salvar Configuração de SLA"}</span>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
