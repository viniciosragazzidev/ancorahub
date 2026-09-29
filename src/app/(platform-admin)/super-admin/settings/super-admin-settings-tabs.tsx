"use client";

import { Children, type ReactNode, useMemo, useState, useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const tabs = [
  { id: "platform", label: "Plataforma" },
  { id: "operations", label: "Operação" },
  { id: "intelligence", label: "IA e treinamento" },
  { id: "channels", label: "Canais" },
] as const;

type SettingsTab = (typeof tabs)[number]["id"];

// Maps each <Card> in page.tsx, by render order, to the tab that shows it.
// Keep this in sync whenever a card is added, removed or reordered there —
// a card with no entry here (index beyond this array) never renders in any
// tab. See src/app/(platform-admin)/super-admin/settings/page.tsx.
const tabForCard: SettingsTab[] = [
  "platform", "platform", "platform", "platform", "platform", "operations", "platform",
  "channels", "channels", "platform", "platform", "platform", "operations", "intelligence",
  "operations", "channels", "intelligence", "intelligence", "intelligence",
  "channels", "channels",
  // Workspace do Corretor … Busca global (index 0-20) end here.
  "platform", // Movimento da interface
  "operations", // Painel e Ações Administrativas no Lead
  "operations", // Escolha de oferta na atribuição manual
  "operations", // Confirmação de presença em plantões
  "intelligence", // Motor de Inteligência Artificial
  "operations", // Outbox do recebimento de leads
  "channels", // Cadência de WhatsApp
  "intelligence", // CorreTop Assistant
  "platform", // Armazenamento de arquivos
  "intelligence", // Qualificação automática no WhatsApp
  "intelligence", // Quick Reply determinístico
  "intelligence", // Reset de memória do agente de WhatsApp
  "intelligence", // Centro de Treinamento do Agente
  "channels", // Identidade pública do Lead Ads
  "channels", // Liberação por empresa
];

type SuperAdminSettingsTabsProps = { children: ReactNode };

export function SuperAdminSettingsTabs({ children }: SuperAdminSettingsTabsProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  const requested = searchParams.get("tab");
  const defaultTab = tabs.some((tab) => tab.id === requested) ? (requested as SettingsTab) : "platform";

  const [activeTab, setActiveTab] = useState<SettingsTab>(defaultTab);

  useEffect(() => {
    if (requested && tabs.some((tab) => tab.id === requested)) {
      setActiveTab(requested as SettingsTab);
    } else {
      setActiveTab("platform");
    }
  }, [requested]);

  function selectTab(tab: string) {
    setActiveTab(tab as SettingsTab);
    try {
      const params = new URLSearchParams(searchParams.toString());
      params.set("tab", tab);
      const newUrl = `${pathname}?${params.toString()}`;
      window.history.replaceState(null, "", newUrl);
      router.replace(newUrl, { scroll: false });
    } catch (e) {
      // Fallback
    }
  }

  const visibleCards = Children.toArray(children).filter((_, index) => tabForCard[index] === activeTab);

  return (
    <Tabs value={activeTab} onValueChange={selectTab} variant="underline" className="gap-5">
      <div className="sticky top-0 z-10 -mx-4 border-y border-border/70 bg-background/95 px-4 backdrop-blur-sm lg:-mx-6 lg:px-6">
        <TabsList aria-label="Categorias de configurações" className="max-w-full overflow-x-auto">
          {tabs.map((tab) => (
            <TabsTrigger key={tab.id} value={tab.id} className="shrink-0">
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>

      <TabsContent value={activeTab} className="space-y-4">
        {visibleCards}
      </TabsContent>
    </Tabs>
  );
}
