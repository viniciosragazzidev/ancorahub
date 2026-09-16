"use client";

import { useState, useTransition } from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/components/ui/sonner";
import { saveDisqualifiedRoutingSettingAction } from "@/features/lead-distribution/disqualified-routing-actions";

export function DisqualifiedLeadsRoutingPanel({
  initialHoldDisqualifiedLeads,
  canEdit,
}: {
  initialHoldDisqualifiedLeads: boolean;
  canEdit: boolean;
}) {
  const [enabled, setEnabled] = useState(initialHoldDisqualifiedLeads);
  const [isPending, startTransition] = useTransition();

  function save(nextValue: boolean) {
    const previousValue = enabled;
    setEnabled(nextValue);
    startTransition(async () => {
      const result = await saveDisqualifiedRoutingSettingAction({
        holdDisqualifiedLeads: nextValue,
      });
      if (!result.success) {
        setEnabled(previousValue);
        toast.error(result.error);
        return;
      }
      toast.success(
        nextValue
          ? "Leads desqualificados ficarão em espera."
          : "Leads desqualificados podem voltar ao fluxo automático.",
      );
    });
  }

  return (
    <Card variant="overview" className="shadow-sm">
      <CardHeader className="gap-2 border-b border-border/70 px-5 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle>Leads desqualificados</CardTitle>
            <CardDescription className="mt-1 max-w-3xl leading-5">
              Controle global para manter leads desqualificados em espera, sem enviá-los a um
              corretor automaticamente.
            </CardDescription>
          </div>
          <Badge variant={enabled ? "warning" : "secondary"}>
            {enabled ? "Em espera" : "Distribuição normal"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="grid gap-4 px-5 py-4">
        <div className="flex items-start justify-between gap-4 rounded-lg border border-border/70 bg-muted/20 p-3">
          <div className="min-w-0 space-y-1">
            <p className="text-sm font-medium text-foreground">
              Reter desqualificados antes da oferta
            </p>
            <p className="text-xs leading-5 text-muted-foreground">
              Quando ativado, vale para qualquer origem, unidade ou fila. Uma regra de roteamento
              criada manualmente com o status “Desqualificado” pode liberar uma exceção.
            </p>
          </div>
          <Switch
            aria-label="Reter leads desqualificados em espera"
            checked={enabled}
            disabled={!canEdit || isPending}
            onCheckedChange={(checked) => save(checked)}
          />
        </div>
        {canEdit ? (
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              Padrão: desligado. A alteração é registrada na auditoria.
            </p>
            <span className="text-xs font-medium text-muted-foreground" aria-live="polite">
              {isPending ? "Salvando…" : "Salvo"}
            </span>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            Apenas o Diretor pode alterar esta configuração global.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
