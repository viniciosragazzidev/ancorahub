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

  return (
    <Tabs
      value={activeTab}
      onValueChange={handleValueChange}
      variant="segment"
      className="w-full space-y-5"
    >
      <TabsList
        aria-label="Áreas da distribuição"
        className="sticky top-[var(--header-height)] z-20 w-full justify-start gap-0.5 overflow-x-auto rounded-xl border border-border/80 bg-card/95 p-1 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-card/85 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden max-[559px]:top-[calc(var(--mobile-header-height)+var(--mobile-safe-top))]"
      >
        <TabsTrigger value="roteamento" className="gap-1.5">
          <ArrowsDownUp aria-hidden="true" className="size-4" />
          Matriz de Roteamento
        </TabsTrigger>
        <TabsTrigger value="resumo_dia" className="gap-1.5">
          <ChartLineUp aria-hidden="true" className="size-4" />
          Resumo do Dia
        </TabsTrigger>
        {showQueueDefinition ? (
          <TabsTrigger value="filas" className="gap-1.5">
            <Buildings aria-hidden="true" className="size-4" />
            Filas & Unidades
          </TabsTrigger>
        ) : null}
        <TabsTrigger value="operar" className="gap-1.5">
          <FileArrowDown aria-hidden="true" className="size-4" />
          Operar & Inbox
        </TabsTrigger>
        <TabsTrigger value="plantao" className="gap-1.5">
          <CalendarBlank aria-hidden="true" className="size-4" />
          Plantão & Escala
        </TabsTrigger>
        <TabsTrigger value="saude_historico" className="gap-1.5">
          <ChartBar aria-hidden="true" className="size-4" />
          Saúde & Auditoria
        </TabsTrigger>
      </TabsList>

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
