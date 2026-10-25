/** Seções de "Atendimento" no visual Lite: as mesmas três seções da navegação atual, em chips de link. */
import { LiteRouteTabs } from "@/components/lite/page/route-tabs";

export function AtendimentoHeadingLite({ active }: { active: "mensagens" | "situacoes" | "fluxo" }) {
  return (
    <LiteRouteTabs
      label="Seções do atendimento"
      active={active}
      tabs={[
        { id: "situacoes", label: "Situações", href: "/atendimento/situacoes" },
        { id: "mensagens", label: "Mensagens", href: "/atendimento/mensagens" },
        { id: "fluxo", label: "Fluxo de atendimento", href: "/atendimento/fluxo" },
      ]}
    />
  );
}
