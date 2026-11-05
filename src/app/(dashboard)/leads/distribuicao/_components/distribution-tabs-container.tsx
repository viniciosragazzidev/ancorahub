"use client";

import { useSearchParams } from "next/navigation";

import { Tabs, TabsContent } from "@/components/ui/tabs";

const VIEW_ALIASES: Record<string, string> = { resumo: "resumo_dia", saude: "saude_historico", historico: "saude_historico" };

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
  // A aba vem da URL (?view=): a barra da área Distribuição troca a query. Sem view, vale a que o servidor resolveu.
  const searchParams = useSearchParams();
  const requested = searchParams?.get("view") ?? null;
  const normalized = requested ? VIEW_ALIASES[requested] ?? requested : null;
  const views = ["resumo_dia", "roteamento", "operar", ...(showQueueDefinition ? ["filas"] : []), "plantao", "saude_historico"];
  const activeTab = normalized && views.includes(normalized) ? normalized : initialView;

  return (
    <Tabs
      value={activeTab}
      variant="underline"
      className="w-full gap-6"
    >

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
