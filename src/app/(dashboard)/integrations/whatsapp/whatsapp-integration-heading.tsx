import { WhatsappLogo } from "@/components/huge-icons";
import { RouteSectionTabs } from "@/components/ui/route-section-tabs";

export function WhatsAppIntegrationHeading({ active, canViewDirector }: { active: "oficial" | "diretoria" | "materiais"; canViewDirector: boolean }) {
  const tabs = [
    { id: "oficial", label: "Oficial (Meta)", href: "/integrations/whatsapp", icon: WhatsappLogo },
    ...(canViewDirector ? [{ id: "diretoria", label: "Diretoria (WAHA)", href: "/integrations/whatsapp?visao=diretoria", icon: WhatsappLogo }] : []),
    ...(canViewDirector ? [{ id: "materiais", label: "Materiais (grupos)", href: "/integrations/whatsapp?visao=materiais", icon: WhatsappLogo }] : []),
  ];

  return <>
    <RouteSectionTabs label="Canais WhatsApp" tabs={tabs} active={active} />
    <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
      Gerencie o número oficial de atendimento e, quando disponível, o número da diretoria para comunicação com corretores.
    </p>
  </>;
}
