"use client";

import { useEffect, useState } from "react";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { PageTabs } from "@/components/foundations/page-tabs";
import {
  ArrowsDownUp,
  Buildings,
  CalendarBlank,
  ChartBar,
  ChartLineUp,
  FileArrowDown,
} from "@/components/huge-icons";

export function DistributionTabsContainer({
  initialView,
  roteamentoContent,
  resumoDiaContent,
  filasContent,
  operarContent,
  plantaoContent,
  saudeHistoricoContent,
  showQueueDefinition = false,
}: {
  initialView: string;
  roteamentoContent: React.ReactNode;
  resumoDiaContent: React.ReactNode;
  filasContent: React.ReactNode;
  operarContent: React.ReactNode;
  plantaoContent: React.ReactNode;
  saudeHistoricoContent: React.ReactNode;
  showQueueDefinition?: boolean;
}) {
  const [activeTab, setActiveTab] = useState(initialView);

  useEffect(() => {
    const handlePopState = () => {
      const nextView = new URL(window.location.href).searchParams.get("view");
      if (nextView) setActiveTab(nextView);
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const handleValueChange = (val: string) => {
    setActiveTab(val);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("view", val);
      window.history.replaceState({}, "", url.toString());
    }
  };

  const tabMeta: Record<string, { title: string; description: string }> = {
    roteamento: {
      title: "Entradas e regras",
      description: "Defina quais leads entram, para onde seguem e quais condições têm prioridade.",
    },
    resumo_dia: {
      title: "Resumo do dia",
      description: "Acompanhe capacidade, recebimento e pendências por unidade e corretor.",
    },
    filas: {
      title: "Filas de distribuição",
      description: "Organize destinos, capacidade, campanhas vinculadas e participantes.",
    },
    operar: {
      title: "Operação",
      description: "Priorize leads aguardando ação e acompanhe o trabalho em andamento.",
    },
    plantao: {
      title: "Plantões",
      description: "Configure horários e cobertura sem perder o vínculo com a fila de destino.",
    },
    saude_historico: {
      title: "Saúde e histórico",
      description: "Revise o motor de distribuição, exceções e decisões auditáveis.",
    },
  };
  const tabs = [
    { id: "roteamento", label: "Entradas e regras", icon: ArrowsDownUp },
    { id: "resumo_dia", label: "Resumo", icon: ChartLineUp },
    ...(showQueueDefinition ? [{ id: "filas", label: "Filas", icon: Buildings }] : []),
    { id: "operar", label: "Operação", icon: FileArrowDown },
    { id: "plantao", label: "Plantões", icon: CalendarBlank },
    { id: "saude_historico", label: "Saúde", icon: ChartBar },
  ];
  const currentTab = tabMeta[activeTab] ?? {
    title: "Distribuição",
    description: "Escolha uma área para continuar.",
  };

  return (
    <Tabs
      value={activeTab}
      onValueChange={handleValueChange}
      variant="segment"
      className="w-full space-y-6"
    >
      <div className="sticky top-[var(--header-height)] z-20 -mx-1 rounded-xl border border-border/70 bg-background/95 px-2 py-2 shadow-xs backdrop-blur supports-[backdrop-filter]:bg-background/85 max-[559px]:top-[calc(var(--mobile-header-height)+var(--mobile-safe-top))]">
        <PageTabs
          tabs={tabs}
          active={activeTab}
          onTabChange={handleValueChange}
          className="pb-0"
        />
      </div>
      <header className="border-b border-border/70 pb-4" aria-live="polite">
        <h2 className="text-lg font-semibold tracking-tight text-foreground">{currentTab.title}</h2>
        <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
          {currentTab.description}
        </p>
      </header>

      <TabsContent value="roteamento" className="space-y-5">
        {roteamentoContent}
      </TabsContent>
      <TabsContent value="resumo_dia" className="space-y-5">
        {resumoDiaContent}
      </TabsContent>
      {showQueueDefinition ? (
        <TabsContent value="filas" className="space-y-5">
          {filasContent}
        </TabsContent>
      ) : null}
      <TabsContent value="operar" className="space-y-5">
        {operarContent}
      </TabsContent>
      <TabsContent value="plantao" className="space-y-5">
        {plantaoContent}
      </TabsContent>
      <TabsContent value="saude_historico" className="space-y-5">
        {saudeHistoricoContent}
      </TabsContent>
    </Tabs>
  );
}
