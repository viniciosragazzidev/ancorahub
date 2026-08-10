"use client";

import React, { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { HelpCircle, BookOpen, Sparkles, CheckCircle2, ArrowRight } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DOMAIN_GLOSSARY } from "@/shared/glossary";

type RouteHelpInfo = {
  title: string;
  subtitle: string;
  overview: string;
  steps: string[];
  glossaryTerms: string[];
  tourId?: string;
};

const ROUTE_HELP_MAP: Record<string, RouteHelpInfo> = {
  "/dashboard": {
    title: "Resumo da Operação",
    subtitle: "Visão executiva do funil comercial e indicadores ao vivo.",
    overview: "O Dashboard consolida a saúde da operação comercial, atitudes pendentes dos corretores e status de atendimento de IA.",
    steps: [
      "Monitore os números da operação no topo (Leads hoje, qualificados, vendas).",
      "Acompanhe alertas operacionais ou estouro de SLA.",
      "Acesse links diretos para Minha Fila ou Plantão.",
    ],
    glossaryTerms: ["sla", "lead_quente", "plantao"],
  },
  "/leads": {
    title: "Central de Leads",
    subtitle: "Gestão completa de oportunidades e distribuição.",
    overview: "Área central de entrada e tratamento de leads. Alterne entre as abas para ver todos os leads, sua fila individual, regras de distribuição ou plantão ao vivo.",
    steps: [
      "Use os filtros de status e classificação para localizar oportunidades.",
      "Clique no lead para ver a ficha completa e acionar cotações.",
      "Acesse a aba 'Minha Fila' para priorizar seus atendimentos pendentes.",
    ],
    glossaryTerms: ["lead_quente", "lead_morno", "lead_frio", "sla"],
  },
  "/qualificacao": {
    title: "Qualificação por IA & WhatsApp",
    subtitle: "Treinamento, parâmetros e diagnóstico do robô de atendimento.",
    overview: "Configure como a IA recebe os clientes no WhatsApp, faz perguntas de triagem, calcula o score e transfere para os corretores.",
    steps: [
      "Visão Geral: Ative ou pause a operação da IA.",
      "WhatsApp Diagnóstico: Verifique a conexão do QR Code e envie mensagens de teste.",
      "Regras de Follow-up: Defina mensagens automáticas para conversas inativas.",
    ],
    glossaryTerms: ["qualificacao", "handoff", "score", "mcp", "followup"],
  },
  "/vendas": {
    title: "Vendas & Propostas",
    subtitle: "Contratos fechados e acompanhamento da esteira comercial.",
    overview: "Gerencie todas as propostas enviadas e contratos formalizados com as operadoras de saúde.",
    steps: [
      "Acompanhe o status da esteira (Em análise, Aprovado, Emitido).",
      "Anexe a documentação necessária diretamente pela ficha da proposta.",
      "Consulte o comissionamento associado a cada venda.",
    ],
    glossaryTerms: ["comissao", "sla"],
  },
  "/settings": {
    title: "Parâmetros do Sistema",
    subtitle: "Configurações gerais do tenant, integrações e comissões.",
    overview: "Centralize todas as configurações administrativas da corretora em um único local seguro.",
    steps: [
      "Gerencie o perfil do tenant e logotipo da empresa.",
      "Configure integrações com Meta Lead Ads e webhooks.",
      "Ajuste as tabelas de comissionamento da equipe.",
    ],
    glossaryTerms: ["comissao", "opt_out"],
  },
};

export function ContextualHelpDrawer() {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handleCustomOpen = () => setOpen(true);
    window.addEventListener("open-contextual-help", handleCustomOpen);
    return () => window.removeEventListener("open-contextual-help", handleCustomOpen);
  }, []);

  // Find best match in ROUTE_HELP_MAP
  const helpInfo = ROUTE_HELP_MAP[pathname] || {
    title: "Guia da Área",
    subtitle: "Entenda as funcionalidades desta seção do AncoraHub.",
    overview: "Esta página pertence à sua plataforma integrada. Navegue pelos cards e filtros para executar suas tarefas comerciais.",
    steps: [
      "Verifique as ações principais no topo da tela.",
      "Utilize os filtros contextuais para refinar a busca.",
      "Acesse a busca global (Cmd+K) para encontrar qualquer recurso rapidamente.",
    ],
    glossaryTerms: ["sla", "lead_quente", "handoff"],
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent className="w-full sm:max-w-md p-6 space-y-6 overflow-y-auto">
        <SheetHeader className="space-y-1">
          <Badge variant="outline" className="w-fit text-[10px] gap-1">
            <BookOpen className="size-3 text-primary" />
            Ajuda Contextual
          </Badge>
          <SheetTitle className="text-lg font-bold">{helpInfo.title}</SheetTitle>
          <SheetDescription className="text-xs">{helpInfo.subtitle}</SheetDescription>
        </SheetHeader>

        <div className="space-y-6 text-xs pt-2">
          <div className="rounded-xl border border-border/80 bg-muted/30 p-4 space-y-2">
            <div className="font-semibold text-foreground flex items-center gap-1.5">
              <Sparkles className="size-4 text-primary" />
              Sobre esta área
            </div>
            <p className="text-muted-foreground leading-relaxed">{helpInfo.overview}</p>
          </div>

          <div className="space-y-3 pt-2">
            <div className="font-bold text-xs uppercase tracking-wider text-muted-foreground/80 pb-1">
              Passo a Passo Recomendado
            </div>
            <div className="space-y-2.5">
              {helpInfo.steps.map((step, idx) => (
                <div key={idx} className="flex items-start gap-2.5 rounded-xl border border-border/80 p-3 bg-card shadow-2xs">
                  <CheckCircle2 className="size-4 text-emerald-500 shrink-0 mt-0.5" />
                  <span className="text-foreground leading-snug">{step}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-3 pt-2">
            <div className="font-bold text-xs uppercase tracking-wider text-muted-foreground/80 pb-1">
              Conceitos de Domínio
            </div>
            <div className="space-y-2.5">
              {helpInfo.glossaryTerms.map((termKey) => {
                const term = DOMAIN_GLOSSARY[termKey];
                if (!term) return null;
                return (
                  <div key={termKey} className="rounded-xl border border-border/80 p-3.5 bg-card space-y-1 shadow-2xs">
                    <div className="font-semibold text-foreground text-xs">{term.title}</div>
                    <p className="text-muted-foreground text-[11px] leading-relaxed">{term.description}</p>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="pt-4 pb-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setOpen(false);
                router.push("/guia");
              }}
              className="w-full justify-between text-xs font-semibold h-10 rounded-xl"
            >
              <span>Abrir Manual Completo & Glossário</span>
              <ArrowRight className="size-4" />
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
