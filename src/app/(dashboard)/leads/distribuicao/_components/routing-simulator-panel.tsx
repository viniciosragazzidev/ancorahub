"use client";

import { useState } from "react";
import { Play, CheckCircle2, XCircle, Search, HelpCircle, ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/components/ui/sonner";
import { simulateRoutingAction } from "@/features/lead-distribution/routing-actions";

export function RoutingSimulatorPanel({
  queues,
  branches,
  brokers,
}: {
  queues: Array<{ id: string; name: string }>;
  branches: Array<{ id: string; name: string }>;
  brokers: Array<{ id: string; name: string }>;
}) {
  const [planType, setPlanType] = useState("pme");
  const [source, setSource] = useState("meta_ads");
  const [city, setCity] = useState("São Paulo");
  const [lives, setLives] = useState("10");
  const [qualificationStatus, setQualificationStatus] = useState("hot");
  const [isSimulating, setIsSimulating] = useState(false);

  const [simulationResult, setSimulationResult] = useState<{
    matchedRule: any | null;
    evaluations: Array<{ ruleId: string; ruleName: string; matches: boolean; reasons: string[] }>;
  } | null>(null);

  const handleRunSimulation = async () => {
    setIsSimulating(true);
    try {
      const res = await simulateRoutingAction({
        planType,
        source,
        city,
        lives: Number(lives) || 1,
        qualificationStatus,
      });
      setSimulationResult(res);
      if (res.matchedRule) {
        toast.success(`Match encontrado: Regra "${res.matchedRule.name}"`);
      } else {
        toast.info("Nenhuma regra de filtro correspondeu. O lead será direcionado para o fluxo padrão.");
      }
    } catch {
      toast.error("Erro ao executar simulação de roteamento.");
    } finally {
      setIsSimulating(false);
    }
  };

  const resolveTargetName = (type: string, id: string) => {
    if (type === "queue") return queues.find((q) => q.id === id)?.name ?? `Fila #${id}`;
    if (type === "branch") return branches.find((b) => b.id === id)?.name ?? `Filial #${id}`;
    if (type === "specific_broker") return brokers.find((b) => b.id === id)?.name ?? `Corretor #${id}`;
    return id;
  };

  return (
    <Card variant="overview" className="space-y-6 p-6">
      <CardHeader className="p-0">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Play className="h-5 w-5 text-primary" />
          Simulador de Roteamento de Leads (Dry-Run Test)
        </CardTitle>
        <CardDescription className="mt-1 text-xs">
          Informe parâmetros hipotéticos de um lead para testar em tempo real qual regra da Matriz será ativada e para onde ele será enviado.
        </CardDescription>
      </CardHeader>

      <CardContent className="p-0 space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5 bg-muted/20 p-4 rounded-xl border">
          <div className="space-y-1.5">
            <Label className="text-xs">Tipo de Plano</Label>
            <Select value={planType} onValueChange={setPlanType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pme">PME / Empresarial</SelectItem>
                <SelectItem value="individual">Individual</SelectItem>
                <SelectItem value="familia">Familiar</SelectItem>
                <SelectItem value="adesao">Adesão</SelectItem>
                <SelectItem value="odonto">Odonto</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Origem do Lead</Label>
            <Select value={source} onValueChange={setSource}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="meta_ads">Meta Ads</SelectItem>
                <SelectItem value="google_ads">Google Ads</SelectItem>
                <SelectItem value="whatsapp">WhatsApp Direto</SelectItem>
                <SelectItem value="indicacao">Indicação</SelectItem>
                <SelectItem value="site">Site / Orgânico</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Cidade</Label>
            <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Ex: São Paulo" />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Qtd. Vidas</Label>
            <Input type="number" value={lives} onChange={(e) => setLives(e.target.value)} placeholder="Ex: 10" />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Status IA</Label>
            <Select value={qualificationStatus} onValueChange={setQualificationStatus}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="hot">Lead Quente</SelectItem>
                <SelectItem value="warm">Lead Morno</SelectItem>
                <SelectItem value="cold">Lead Frio</SelectItem>
                <SelectItem value="handoff">Transf. Humana</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <Button onClick={handleRunSimulation} disabled={isSimulating} className="w-full sm:w-auto gap-2">
          <Play className="h-4 w-4" />
          {isSimulating ? "Executando Simulação..." : "Simular Roteamento do Lead"}
        </Button>

        {/* RESULTS SECTION */}
        {simulationResult && (
          <div className="space-y-4 pt-4 border-t border-border/60">
            <h4 className="font-semibold text-sm flex items-center gap-2">
              <Search className="h-4 w-4 text-primary" /> Resultado da Análise de Roteamento
            </h4>

            {simulationResult.matchedRule ? (
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
                <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-semibold text-sm">
                  <CheckCircle2 className="h-5 w-5" /> Regra Vencedora: "{simulationResult.matchedRule.name}"
                </div>
                <p className="text-xs text-muted-foreground mt-1 flex items-center gap-2">
                  Destino Calculado:
                  <Badge variant="success" className="gap-1 font-bold">
                    <ArrowRight className="h-3 w-3" />
                    {resolveTargetName(simulationResult.matchedRule.targetType, simulationResult.matchedRule.targetId)}
                  </Badge>
                </p>
              </div>
            ) : (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
                <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 font-semibold text-sm">
                  <HelpCircle className="h-5 w-5" /> Nenhuma regra de prioridade correspondeu a estes parâmetros.
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  O lead entrará no fluxo normal da Fila Geral da Unidade por Roleta/Capacidade.
                </p>
              </div>
            )}

            {/* EVALUATIONS BREAKDOWN */}
            <div className="space-y-2 mt-4">
              <p className="text-xs font-semibold text-muted-foreground">Detalhamento da avaliação por regra:</p>
              <div className="space-y-2">
                {simulationResult.evaluations.map((ev) => (
                  <div
                    key={ev.ruleId}
                    className={`rounded-lg border p-3 text-xs flex flex-col gap-1 ${
                      ev.matches ? "bg-emerald-500/5 border-emerald-500/20" : "bg-muted/10 border-border/60"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">{ev.ruleName}</span>
                      <Badge variant={ev.matches ? "success" : "outline"} className="text-[10px]">
                        {ev.matches ? "Match Confirmado" : "Não Correspondeu"}
                      </Badge>
                    </div>
                    {ev.reasons.length > 0 && (
                      <ul className="text-[11px] text-muted-foreground list-disc list-inside mt-1 space-y-0.5">
                        {ev.reasons.map((r, i) => (
                          <li key={i}>{r}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
