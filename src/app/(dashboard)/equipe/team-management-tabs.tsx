import { Buildings, UsersThree } from "@/components/huge-icons";
import { RouteSectionTabs } from "@/components/ui/route-section-tabs";

const TABS = [
  { id: "membros", label: "Equipe", href: "/equipe", icon: UsersThree },
  { id: "unidades", label: "Unidades", href: "/equipe?visao=unidades", icon: Buildings },
] as const;

/** Same underline tab bar as /leads/distribuicao, with links (each view is its own request). */
export function TeamManagementTabs({ active }: { active: "membros" | "unidades" }) {
  return <RouteSectionTabs label="Gestão de equipe e unidades" tabs={TABS} active={active} />;
}
