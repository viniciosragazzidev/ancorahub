"use client";

import { useTransition } from "react";
import { Sparkle, CheckCircle, Warning, ChatCircleText, ArrowRight, Lightbulb } from "@phosphor-icons/react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { acceptAiSuggestedTransitionAction, triggerManualConversationAnalysisAction } from "../actions";
import type { ConversationAssessment, PolicyExecutionResult } from "../types";

interface AiConversationInsightCardProps {
  leadId: string;
  assessment?: ConversationAssessment | null;
  policyResult?: {
    action: string;
    confidence: number;
    targetStatus?: string | null;
    reason?: string;
  } | null;
  lastAnalyzedAt?: string | null;
  canManage?: boolean;
}

const sentimentVariantMap: Record<string, "success" | "secondary" | "destructive"> = {
  POSITIVE: "success",
  NEUTRAL: "secondary",
  NEGATIVE: "destructive",
};

const sentimentLabelMap: Record<string, string> = {
  POSITIVE: "Sentimento Positivo",
  NEUTRAL: "Sentimento Neutro",
  NEGATIVE: "Sentimento Negativo",
};

const intentLabelMap: Record<string, string> = {
  VERY_HIGH: "Intenção Altíssima",
  HIGH: "Alta Intenção",
  MEDIUM: "Intenção Média",
  LOW: "Baixa Intenção",
  NONE: "Sem Interesse",
  UNKNOWN: "Intenção a Confirmar",
};

const stageLabelMap: Record<string, string> = {
  INITIAL_CONTACT: "1º Contato",
  DISCOVERY: "Descoberta",
  QUALIFICATION: "Qualificação",
  QUOTE_PREPARATION: "Montagem de Cotação",
  QUOTE_PRESENTED: "Cotação Apresentada",
  NEGOTIATION: "Negociação",
  DOCUMENT_COLLECTION: "Coleta de Documentos",
  ANALYSIS: "Análise da Operadora",
  CLOSING: "Fechamento",
  POST_SALE: "Pós-Venda",
  UNKNOWN: "Em Andamento",
};

export function AiConversationInsightCard({
  leadId,
  assessment,
  policyResult,
  lastAnalyzedAt,
  canManage = true,
}: AiConversationInsightCardProps) {
  const [isPending, startTransition] = useTransition();

  if (!assessment) {
    return (
      <Card className="border-border/60 bg-gradient-to-br from-primary/[0.03] to-muted/20">
        <CardContent className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4">
          <div className="flex items-center gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
              <Sparkle className="size-5" />
            </span>
            <div>
              <h4 className="text-sm font-semibold">Inteligência Conversacional IA</h4>
              <p className="text-xs text-muted-foreground">
                A IA analisa automaticamente as mensagens do WhatsApp a cada interação com o corretor.
              </p>
            </div>
          </div>
          {canManage && (
            <Button
              size="xs"
              variant="outline"
              disabled={isPending}
              onClick={() => {
                startTransition(async () => {
                  toast.info("Analisando mensagens do WhatsApp com IA...");
                  const res = await triggerManualConversationAnalysisAction(leadId);
                  if (res.success) {
                    toast.success("Análise concluída com sucesso!");
                  } else {
                    toast.error(res.error || "Não foi possível analisar.");
                  }
                });
              }}
            >
              <Sparkle className="mr-1.5 size-3.5 text-primary" />
              {isPending ? "Analisando..." : "Analisar agora"}
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  const hasSuggestion =
    policyResult?.action === "SUGGEST" &&
    Boolean(policyResult.targetStatus);

  const handleAcceptSuggestion = () => {
    if (!policyResult?.targetStatus) return;
    startTransition(async () => {
      const res = await acceptAiSuggestedTransitionAction({
        leadId,
        suggestedStatus: policyResult.targetStatus!,
      });
      if (res.success) {
        toast.success(`Status atualizado para '${policyResult.targetStatus}'!`);
      } else {
        toast.error(res.error || "Erro ao atualizar status.");
      }
    });
  };

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/[0.04] via-background to-card shadow-sm">
      <CardHeader className="p-4 pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="grid size-7 shrink-0 place-items-center rounded-md bg-primary/15 text-primary">
              <Sparkle className="size-4" />
            </span>
            <div>
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                Diagnóstico de Conversa IA
                <Badge variant="outline" className="text-[10px] font-normal border-primary/30 text-primary">
                  {stageLabelMap[assessment.conversationStage] || assessment.conversationStage}
                </Badge>
              </CardTitle>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant={sentimentVariantMap[assessment.sentiment] || "secondary"} className="text-[11px]">
              {sentimentLabelMap[assessment.sentiment] || assessment.sentiment}
            </Badge>
            <Badge variant="outline" className="text-[11px]">
              {intentLabelMap[assessment.customerIntent] || assessment.customerIntent}
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-4 pt-1 space-y-3">
        {/* Resumo executivo */}
        <p className="text-xs sm:text-sm leading-relaxed text-foreground/90 bg-muted/30 p-2.5 rounded-md border border-border/40">
          {assessment.summary}
        </p>

        {/* Objeções e Sinais de Compra */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
          {assessment.objections && assessment.objections.length > 0 && (
            <div className="rounded-md border border-amber-500/20 bg-amber-500/[0.04] p-2 space-y-1">
              <span className="font-semibold text-amber-700 dark:text-amber-400 flex items-center gap-1">
                <Warning className="size-3.5" /> Objeções detectadas
              </span>
              <ul className="list-disc list-inside text-muted-foreground space-y-0.5">
                {assessment.objections.map((obj, i) => (
                  <li key={i} className="truncate">{obj}</li>
                ))}
              </ul>
            </div>
          )}

          {assessment.buyingSignals && assessment.buyingSignals.length > 0 && (
            <div className="rounded-md border border-emerald-500/20 bg-emerald-500/[0.04] p-2 space-y-1">
              <span className="font-semibold text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                <CheckCircle className="size-3.5" /> Sinais de compra
              </span>
              <ul className="list-disc list-inside text-muted-foreground space-y-0.5">
                {assessment.buyingSignals.map((sig, i) => (
                  <li key={i} className="truncate">{sig}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Próxima Melhor Ação Recomendada */}
        <div className="flex items-start gap-2 rounded-md border border-primary/25 bg-primary/[0.06] p-2.5 text-xs text-foreground">
          <Lightbulb className="size-4 shrink-0 text-primary mt-0.5" />
          <div className="space-y-0.5">
            <span className="font-semibold text-primary">Próxima melhor ação do corretor:</span>
            <p className="text-muted-foreground leading-normal">{assessment.nextBestAction}</p>
          </div>
        </div>

        {/* Banner de Sugestão de Transição de Status se houver */}
        {hasSuggestion && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 rounded-md border border-primary/30 bg-primary/10 p-2.5">
            <div className="space-y-0.5">
              <p className="text-xs font-semibold text-primary">
                Sugestão da IA: Mover para &ldquo;{policyResult?.targetStatus}&rdquo;
              </p>
              <p className="text-[11px] text-muted-foreground">
                Confiança: {(policyResult?.confidence ? policyResult.confidence * 100 : 0).toFixed(0)}% · {policyResult?.reason}
              </p>
            </div>
            {canManage && (
              <Button
                size="xs"
                variant="default"
                disabled={isPending}
                onClick={handleAcceptSuggestion}
                className="shrink-0"
              >
                <CheckCircle className="mr-1 size-3.5" />
                {isPending ? "Atualizando..." : `Mover para ${policyResult?.targetStatus}`}
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
