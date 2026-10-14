"use client";

import "@/components/arc/venancor-scope.css";

import { notFound } from "next/navigation";
import { Suspense } from "react";

import { LightSettings } from "@/app/(dashboard)/settings/_components/light-settings";
import { ManagerLiteSettingsFooter, ManagerLiteSettingsHeader, ManagerLiteUnitSection } from "@/features/manager-workspace/manager-lite-settings-parts";

/** Dev-only showcase of the manager's Lite settings. /dev/e11-config-preview?tab=unidade */
function Showcase() {
  const placeholder = (text: string) => <div className="rounded-3xl bg-(--surface) p-5 text-sm text-(--text-secondary) shadow-(--shadow-resting)">{text}</div>;
  return (
    <div className="arc-venancor min-h-dvh bg-(--background) py-6">
      <LightSettings
        intro="Sua conta, sua unidade e a segurança do acesso."
        header={<ManagerLiteSettingsHeader user={{ name: "Ana Gestora", image: null }} branchName="Central" />}
        sections={[
          { id: "conta", title: "Minha conta", description: "Seus dados de acesso e perfil", node: placeholder("Dados da conta") },
          { id: "unidade", title: "Minha unidade", description: "Central", node: <ManagerLiteUnitSection unit={{ name: "Central", active: true, acceptingLeads: true, autoDistribute: true, brokers: 12, supervisors: 2 }} /> },
          { id: "whatsapp", title: "WhatsApp pessoal", description: "O número que você usa no atendimento", node: placeholder("WhatsApp") },
          { id: "notificacoes", title: "Notificações", description: "Avisos no celular e no navegador", node: placeholder("Notificações") },
          { id: "seguranca", title: "Segurança", description: "Autenticação em duas etapas e chaves de acesso", node: placeholder("Segurança") },
          { id: "extensao", title: "Extensão para o WhatsApp Web", description: "Atendimento contextual no navegador", node: placeholder("Extensão") },
          { id: "acessibilidade", title: "Acessibilidade", description: "Texto maior, menos animação e alto contraste", node: placeholder("Acessibilidade") },
        ]}
        footer={<ManagerLiteSettingsFooter />}
      />
    </div>
  );
}

export default function ManagerSettingsShowcasePage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <Suspense><Showcase /></Suspense>;
}
