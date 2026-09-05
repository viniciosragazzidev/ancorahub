"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowsDownUp, Buildings, CalendarBlank, ChartBar, ChartLineUp, FileArrowDown } from "@/components/huge-icons";

export function DistributionTabsContainer({
  initialView,
  roteamentoContent,
  resumoDiaContent,
  filasContent,
  operarContent,
  plantaoContent,
  saudeHistoricoContent,
}: {
  initialView: string;
  roteamentoContent: React.ReactNode;
  resumoDiaContent: React.ReactNode;
  filasContent: React.ReactNode;
  operarContent: React.ReactNode;
  plantaoContent: React.ReactNode;
  saudeHistoricoContent: React.ReactNode;
}) {
  const [activeTab, setActiveTab] = useState(initialView);

  const handleValueChange = (val: string) => {
    setActiveTab(val);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("view", val);
      window.history.replaceState({}, "", url.toString());
    }
  };

  return (
    <Tabs value={activeTab} onValueChange={handleValueChange} variant="segment" className="w-full space-y-6">
      <TabsList className="max-w-5xl w-full justify-start overflow-x-auto">
        <TabsTrigger value="roteamento" className="gap-1.5"><ArrowsDownUp aria-hidden="true" className="size-4" />Matriz de Roteamento</TabsTrigger>
        <TabsTrigger value="resumo_dia" className="gap-1.5"><ChartLineUp aria-hidden="true" className="size-4" />Resumo do Dia</TabsTrigger>
        <TabsTrigger value="filas" className="gap-1.5"><Buildings aria-hidden="true" className="size-4" />Filas & Unidades</TabsTrigger>
        <TabsTrigger value="operar" className="gap-1.5"><FileArrowDown aria-hidden="true" className="size-4" />Operar & Inbox</TabsTrigger>
        <TabsTrigger value="plantao" className="gap-1.5"><CalendarBlank aria-hidden="true" className="size-4" />Plantão & Escala</TabsTrigger>
        <TabsTrigger value="saude_historico" className="gap-1.5"><ChartBar aria-hidden="true" className="size-4" />Saúde & Auditoria</TabsTrigger>
      </TabsList>

      <TabsContent value="roteamento" className="space-y-6">{roteamentoContent}</TabsContent>
      <TabsContent value="resumo_dia" className="space-y-6">{resumoDiaContent}</TabsContent>
      <TabsContent value="filas" className="space-y-6">{filasContent}</TabsContent>
      <TabsContent value="operar" className="space-y-6">{operarContent}</TabsContent>
      <TabsContent value="plantao" className="space-y-6">{plantaoContent}</TabsContent>
      <TabsContent value="saude_historico" className="space-y-6">{saudeHistoricoContent}</TabsContent>
    </Tabs>
  );
}
