"use client";

import { Children, type ReactNode, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const tabs = [
  { id: "platform", label: "Plataforma" },
  { id: "operations", label: "Operação" },
  { id: "intelligence", label: "IA e treinamento" },
  { id: "channels", label: "Canais" },
] as const;

type SettingsTab = (typeof tabs)[number]["id"];

const tabForCard: SettingsTab[] = [
  "platform", "platform", "operations", "operations", "channels", "platform", "platform",
  "platform", "platform", "intelligence", "channels", "intelligence", "intelligence", "intelligence",
];

type SuperAdminSettingsTabsProps = { children: ReactNode };

export function SuperAdminSettingsTabs({ children }: SuperAdminSettingsTabsProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeTab = useMemo<SettingsTab>(() => {
    const requested = searchParams.get("tab");
    return tabs.some((tab) => tab.id === requested) ? (requested as SettingsTab) : "platform";
  }, [searchParams]);

  function selectTab(tab: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", tab);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  const visibleCards = Children.toArray(children).filter((_, index) => tabForCard[index] === activeTab);

  return (
    <Tabs value={activeTab} onValueChange={selectTab} className="gap-5">
      <div className="sticky top-0 z-10 -mx-4 border-y border-border/70 bg-background/95 px-4 backdrop-blur-sm lg:-mx-6 lg:px-6">
        <TabsList variant="line" aria-label="Categorias de configurações" className="max-w-full overflow-x-auto">
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
