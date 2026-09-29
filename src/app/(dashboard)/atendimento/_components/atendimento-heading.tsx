import { ChatCircleText, Lightning } from "@/components/huge-icons";
import { RouteSectionTabs } from "@/components/ui/route-section-tabs";

/**
 * Sections of "Atendimento". Each one joins the tabs when it is ready
 * (Perguntas, Fluxos and Desempenho come next), so no empty tab is shown.
 */
export function AtendimentoHeading({ active }: { active: "mensagens" | "situacoes" }) {
  const tabs = [
    { id: "situacoes", label: "Situações", href: "/atendimento/situacoes", icon: Lightning },
    { id: "mensagens", label: "Mensagens", href: "/atendimento/mensagens", icon: ChatCircleText },
  ];
  return <RouteSectionTabs label="Seções do atendimento" tabs={tabs} active={active} />;
}
