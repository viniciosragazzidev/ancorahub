import { WhatsappLogo } from "@/components/huge-icons";
import { RouteSectionTabs } from "@/components/ui/route-section-tabs";

export function WhatsAppIntegrationHeading({ active, canViewDirector }: { active: "oficial" | "diretoria"; canViewDirector: boolean }) {
  const tabs = [
    { id: "oficial", label: "Oficial (Meta)", href: "/integrations/whatsapp", icon: WhatsappLogo },
    ...(canViewDirector ? [{ id: "diretoria", label: "Diretoria (WAHA)", href: "/integrations/whatsapp?visao=diretoria", icon: WhatsappLogo }] : []),
  ];

  return <>
    <RouteSectionTabs label="Canais WhatsApp" tabs={tabs} active={active} />
    <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
      Gerencie o número oficial de atendimento e, quando disponível, o número da diretoria para comunicação com corretores.
    </p>
  </>;
}
