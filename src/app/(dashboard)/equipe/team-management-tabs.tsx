import { Buildings, UsersThree } from "@/components/huge-icons";
import { RouteSectionTabs } from "@/components/ui/route-section-tabs";

const TABS = [
  { id: "membros", label: "Equipe", href: "/equipe", icon: UsersThree },
  { id: "unidades", label: "Unidades", href: "/equipe?visao=unidades", icon: Buildings },
  { id: "equipes", label: "Equipes", href: "/equipe?visao=equipes", icon: UsersThree },
] as const;

/** Same underline tab bar as /leads/distribuicao, with links (each view is its own request). */
export function TeamManagementTabs({ active, counts }: { active: "membros" | "unidades" | "equipes"; counts?: Partial<Record<"membros" | "unidades" | "equipes", number>> }) {
  const tabs = counts ? TABS.map((tab) => ({ ...tab, count: counts[tab.id] })) : TABS;
  return <RouteSectionTabs label="Gestão de equipe e unidades" tabs={tabs} active={active} />;
}
