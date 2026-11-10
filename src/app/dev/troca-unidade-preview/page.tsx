import "@/components/arc/venancor-scope.css";

import { notFound } from "next/navigation";

import { LightSettings } from "@/app/(dashboard)/settings/_components/light-settings";
import type { OwnUnitChangeOptions } from "@/features/broker-unit-change/queries";
import { PreviewUnitSection } from "./preview-unit-section";

/**
 * Prévia só em desenvolvimento de Configurações > Minha unidade do corretor (DEC-171), com dados
 * sintéticos e ação simulada. /dev/troca-unidade-preview?tab=unidade&cenario=sem-opcoes|sem-plantao|erro
 */
export default async function TrocaUnidadePreviewPage({ searchParams }: { searchParams: Promise<{ cenario?: string }> }) {
  if (process.env.NODE_ENV !== "development") notFound();
  const { cenario } = await searchParams;
  const data: OwnUnitChangeOptions = {
    current: { id: "unit-centro", name: "Unidade Centro" },
    options: cenario === "sem-opcoes" ? [] : [
      { id: "unit-barra", name: "Unidade Barra da Tijuca" },
      { id: "unit-niteroi", name: "Unidade Niterói" },
      { id: "unit-norte", name: "Unidade Zona Norte" },
    ],
    openDutySlots: cenario === "sem-plantao" ? 0 : 3,
  };
  const placeholder = (text: string) => <p className="rounded-3xl bg-(--surface) p-5 text-sm text-(--text-secondary) shadow-(--shadow-resting)">{text}</p>;
  return (
    <div className="arc-venancor light-canvas min-h-dvh py-4">
      <LightSettings
        sections={[
          { id: "conta", title: "Minha conta", description: "Seus dados de acesso e perfil", node: placeholder("Minha conta (prévia)") },
          { id: "unidade", title: "Minha unidade", description: data.current?.name ?? "Você ainda não está em uma unidade", node: <PreviewUnitSection data={data} failWith={cenario === "erro" ? "A troca de unidade está desligada no momento. Fale com a gestão." : undefined} /> },
          { id: "disponibilidade", title: "Disponibilidade", description: "Pausa manual e horários para receber leads", node: placeholder("Disponibilidade (prévia)") },
          { id: "whatsapp", title: "WhatsApp pessoal", description: "O número que você usa no atendimento", node: placeholder("WhatsApp (prévia)") },
          { id: "seguranca", title: "Segurança", description: "Autenticação em duas etapas e chaves de acesso", node: placeholder("Segurança (prévia)") },
        ]}
      />
    </div>
  );
}
