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

  const activeDescription: Record<string, string> = {
    roteamento: "Escolha quais entradas podem chegar a cada fila e revise regras específicas.",
    resumo_dia: "Veja capacidade, recebimento e pendências do dia por unidade e corretor.",
    filas: "Mantenha filas, capacidade e vínculos operacionais em um único lugar.",
    operar: "Trate os leads que aguardam ação e acompanhe a fila de trabalho.",
    plantao: "Defina quando uma fila concorre e quem cobre cada janela de atendimento.",
    saude_historico: "Confirme a saúde do motor e consulte o histórico das alterações.",
  };

  const flowSteps = [
    { label: "Entradas", description: "campanha ou origem", value: "roteamento" },
    ...(showQueueDefinition ? [{ label: "Filas", description: "destino e capacidade", value: "filas" }] : []),
    { label: "Plantões", description: "janela e escala", value: "plantao" },
    { label: "Operação", description: "aceite e próxima ação", value: "operar" },
  ];

  return (
    <Tabs
      value={activeTab}
      onValueChange={handleValueChange}
      variant="segment"
      className="w-full space-y-5"
    >
      <section
        aria-labelledby="fluxo-distribuicao"
        className="rounded-xl border border-border/80 bg-card px-4 py-3 shadow-sm"
      >
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <h2 id="fluxo-distribuicao" className="text-sm font-semibold text-foreground">
              Fluxo da distribuição
            </h2>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              A entrada encontra uma fila, a fila pode usar um plantão e a operação acompanha o próximo passo.
            </p>
          </div>
          <ol className="flex min-w-0 flex-wrap items-center gap-2 text-xs" aria-label="Etapas da distribuição">
            {flowSteps.map((step, index) => (
              <li key={step.value} className="flex min-w-0 items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleValueChange(step.value)}
                  aria-current={activeTab === step.value ? "step" : undefined}
                  className="group flex min-h-10 items-center gap-2 rounded-lg border border-border/70 bg-muted/20 px-2.5 py-1.5 text-left transition-colors hover:border-primary/40 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span
                    className={`grid size-5 shrink-0 place-items-center rounded-full text-[10px] font-semibold ${
                      activeTab === step.value
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {index + 1}
                  </span>
                  <span className="min-w-0">
                    <span className="block font-medium text-foreground">{step.label}</span>
                    <span className="block truncate text-[10px] text-muted-foreground">{step.description}</span>
                  </span>
                </button>
                {index < flowSteps.length - 1 ? (
                  <span className="hidden text-muted-foreground/60 sm:inline" aria-hidden="true">→</span>
                ) : null}
              </li>
            ))}
          </ol>
        </div>
      </section>
      <TabsList
        aria-label="Áreas da distribuição"
        className="sticky top-[var(--header-height)] z-20 w-full justify-start gap-0.5 overflow-x-auto rounded-xl border border-border/80 bg-card/95 p-1 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-card/85 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden max-[559px]:top-[calc(var(--mobile-header-height)+var(--mobile-safe-top))]"
      >
        <TabsTrigger value="roteamento" className="gap-1.5">
          <ArrowsDownUp aria-hidden="true" className="size-4" />
          Entradas & Regras
        </TabsTrigger>
        <TabsTrigger value="resumo_dia" className="gap-1.5">
          <ChartLineUp aria-hidden="true" className="size-4" />
          Resumo
        </TabsTrigger>
        {showQueueDefinition ? (
          <TabsTrigger value="filas" className="gap-1.5">
            <Buildings aria-hidden="true" className="size-4" />
            Filas
          </TabsTrigger>
        ) : null}
        <TabsTrigger value="operar" className="gap-1.5">
          <FileArrowDown aria-hidden="true" className="size-4" />
          Operação
        </TabsTrigger>
        <TabsTrigger value="plantao" className="gap-1.5">
          <CalendarBlank aria-hidden="true" className="size-4" />
          Plantões
        </TabsTrigger>
        <TabsTrigger value="saude_historico" className="gap-1.5">
          <ChartBar aria-hidden="true" className="size-4" />
          Saúde
        </TabsTrigger>
      </TabsList>
      <p className="-mt-2 text-xs leading-5 text-muted-foreground" aria-live="polite">
        {activeDescription[activeTab] ?? "Escolha uma área para continuar."}
      </p>

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
