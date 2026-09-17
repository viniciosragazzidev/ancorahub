"use client";

import { useEffect, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

  const tabs = [
    { id: "roteamento", label: "Entradas e regras", icon: ArrowsDownUp },
    { id: "resumo_dia", label: "Resumo", icon: ChartLineUp },
    { id: "operar", label: "Operação", icon: FileArrowDown },
    ...(showQueueDefinition ? [{ id: "filas", label: "Filas", icon: Buildings }] : []),
    { id: "plantao", label: "Plantões", icon: CalendarBlank },
    { id: "saude_historico", label: "Saúde", icon: ChartBar },
  ];
  return (
    <Tabs
      value={activeTab}
      onValueChange={handleValueChange}
      variant="underline"
      className="w-full gap-6"
    >
      <nav
        aria-label="Áreas da distribuição"
        className="sticky top-[var(--header-height)] z-20 -mx-4 border-b border-border/70 bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/85 sm:-mx-6 sm:px-6 max-[559px]:top-[calc(var(--mobile-header-height)+var(--mobile-safe-top))]"
      >
        <TabsList
          aria-label="Áreas da distribuição"
          className="h-auto w-full justify-start gap-1 overflow-x-auto border-0 bg-transparent p-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <TabsTrigger
                key={tab.id}
                value={tab.id}
                className="min-h-12 shrink-0 gap-2 px-3.5 py-0 text-[13px] font-medium transition-colors duration-150"
                indicatorClassName="left-3.5 right-3.5 rounded-full"
              >
                <Icon aria-hidden="true" className="size-4" />
                {tab.label}
              </TabsTrigger>
            );
          })}
        </TabsList>
      </nav>

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
