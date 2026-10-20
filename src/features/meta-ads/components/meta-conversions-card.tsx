"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/components/ui/sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

import { saveMetaConversionSettingsAction } from "../meta-conversion-actions";
import type { MetaConversionsPanel } from "../meta-conversion-service";

/**
 * Conversions API for CRM: the director turns on sending the lead stages
 * (Lead recebido, Qualificado, Quente, Venda) to a Meta dataset so Lead Ads
 * campaigns can optimize for conversion leads.
 */
export function MetaConversionsCard({
  panel,
  datasets,
}: {
  panel: MetaConversionsPanel;
  datasets: Array<{ id: string; name: string }>;
}) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(panel.enabled);
  const [datasetId, setDatasetId] = useState(panel.datasetId ?? (datasets.length === 1 ? datasets[0]!.id : ""));
  const [testEventCode, setTestEventCode] = useState(panel.testEventCode ?? "");
  const [saving, startSaving] = useTransition();
  const dirty = enabled !== panel.enabled || datasetId !== (panel.datasetId ?? "") || testEventCode.trim() !== (panel.testEventCode ?? "");
  const selected = datasets.find((dataset) => dataset.id === datasetId);

  const save = () => {
    startSaving(async () => {
      const result = await saveMetaConversionSettingsAction({ enabled, datasetId: datasetId || null, testEventCode: testEventCode.trim() || null });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success(enabled ? "Envio de etapas ligado." : "Configuração salva.", {
        description: result.backfilled ? `${result.backfilled} etapa(s) dos últimos 7 dias entraram na fila de envio.` : undefined,
      });
      router.refresh();
    });
  };

  return (
    <Card className="border-border bg-card shadow-none">
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle>Enviar etapas dos leads para a Meta</CardTitle>
          <CardDescription>
            Os leads de formulário (Lead Ads) avisam a Meta quando chegam, ficam qualificados, quentes e quando viram venda. A Meta usa isso para buscar mais leads parecidos com os que fecham.
          </CardDescription>
        </div>
        <Badge variant={panel.enabled ? "success" : "outline"}>{panel.enabled ? "Ligado" : "Desligado"}</Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        {!panel.available ? (
          <div role="alert" className="rounded-lg border border-warning/35 bg-warning/10 p-3 text-sm">
            <p className="font-medium text-foreground">Recurso ainda não liberado</p>
            <p className="mt-1 text-muted-foreground">O banco de dados ainda não recebeu a atualização deste recurso. Fale com o suporte técnico.</p>
          </div>
        ) : (
          <>
            <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/20 p-3">
              <Switch checked={enabled} disabled={saving} onCheckedChange={(checked) => setEnabled(checked === true)} aria-label={enabled ? "Desligar envio de etapas" : "Ligar envio de etapas"} className="mt-0.5" />
              <div className="min-w-0">
                <p className="text-sm font-medium">Enviar etapas</p>
                <p className="text-xs leading-5 text-muted-foreground">Ao ligar, os leads de formulário dos últimos 7 dias também são enviados. Leads do WhatsApp ficam para uma próxima etapa.</p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Fonte de dados (dataset)</Label>
                {datasets.length ? (
                  <Select value={datasetId} disabled={saving} onValueChange={(value) => setDatasetId(typeof value === "string" ? value : "")}>
                    <SelectTrigger aria-label="Fonte de dados que recebe as etapas">
                      <SelectValue>{selected ? selected.name : "Escolha a fonte de dados"}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {datasets.map((dataset) => (
                        <SelectItem key={dataset.id} value={dataset.id}>{dataset.name} · {dataset.id}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <p className="text-sm text-muted-foreground">Nenhuma fonte sincronizada. Use Sincronizar ou Revisar ativos acima.</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="meta-conversions-test-code">Código de teste (opcional)</Label>
                <Input
                  id="meta-conversions-test-code"
                  value={testEventCode}
                  disabled={saving}
                  maxLength={64}
                  placeholder="TEST12345"
                  onChange={(event) => setTestEventCode(event.target.value)}
                />
                <p className="text-xs text-muted-foreground">Com código, os eventos aparecem só em Testar eventos e não otimizam campanhas. Apague depois do teste.</p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <Count label="Pendentes" value={panel.counts.pending} />
              <Count label="Enviados" value={panel.counts.sent} />
              <Count label="Recusados" value={panel.counts.failed} />
            </div>
            {panel.lastError ? (
              <div className="rounded-lg border border-warning/35 bg-warning/10 p-3 text-sm">
                <p className="font-medium text-foreground">Último erro</p>
                <p className="mt-1 break-words text-muted-foreground">{panel.lastError.message}</p>
                <p className="mt-1 text-xs text-muted-foreground">{new Date(panel.lastError.at).toLocaleString("pt-BR")}</p>
              </div>
            ) : null}

            <div className="flex justify-end">
              <Button disabled={saving || !dirty || (enabled && !datasetId)} onClick={save}>
                {saving ? "Salvando…" : "Salvar"}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function Count({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border bg-muted/20 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </div>
  );
}
