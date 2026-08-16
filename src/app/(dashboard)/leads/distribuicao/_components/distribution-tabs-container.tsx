"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export function DistributionTabsContainer({
  initialView,
  filasContent,
  operarContent,
  plantaoContent,
  saudeHistoricoContent,
}: {
  initialView: string;
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
      <TabsList className="max-w-2xl w-full justify-start overflow-x-auto">
        <TabsTrigger value="filas">Central de Filas</TabsTrigger>
        <TabsTrigger value="operar">Operar Fila</TabsTrigger>
        <TabsTrigger value="plantao">Plantão & Equipe</TabsTrigger>
        <TabsTrigger value="saude_historico">Saúde & Histórico</TabsTrigger>
      </TabsList>

      <TabsContent value="filas" className="space-y-6">{filasContent}</TabsContent>
      <TabsContent value="operar" className="space-y-6">{operarContent}</TabsContent>
      <TabsContent value="plantao" className="space-y-6">{plantaoContent}</TabsContent>
      <TabsContent value="saude_historico" className="space-y-6">{saudeHistoricoContent}</TabsContent>
    </Tabs>
  );
}
