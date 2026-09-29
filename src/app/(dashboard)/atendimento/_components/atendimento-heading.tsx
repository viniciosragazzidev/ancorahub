import { ChatCircleText } from "@/components/huge-icons";
import { RouteSectionTabs } from "@/components/ui/route-section-tabs";

/**
 * Sections of "Atendimento". Each one joins the tabs when it is ready
 * (Situações, Perguntas, Fluxos and Desempenho come next), so no empty tab
 * is ever shown.
 */
export function AtendimentoHeading({ active }: { active: "mensagens" }) {
  const tabs = [{ id: "mensagens", label: "Mensagens", href: "/atendimento/mensagens", icon: ChatCircleText }];
  return <RouteSectionTabs label="Seções do atendimento" tabs={tabs} active={active} />;
}
