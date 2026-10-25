import { notFound } from "next/navigation";

import { ConfirmPresenceView } from "@/app/confirm_presence/confirm-presence-view";
import { OnboardingNotice } from "@/app/primeiro-acesso/onboarding-notice";

import { PublicFixtureClient } from "./public-fixture-client";

/**
 * Só desenvolvimento: as telas públicas da Onda 8 (sem login e sem banco) com dados de exemplo, para os prints.
 * ?tela=plantao | plantao-confirmado | plantao-presencial | planilha | planilha-senha | planilha-erro | erro | convite-invalido
 */
export default async function PublicScreensFixturePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  if (process.env.NODE_ENV !== "development") notFound();
  const params = await searchParams;
  const screen = typeof params.tela === "string" ? params.tela : "plantao";
  const record = {
    id: "00000000-0000-4000-8000-000000000001",
    assignmentId: "00000000-0000-4000-8000-000000000002",
    brokerName: "Cristiane Farizele Monteiro",
    scheduleName: "Plantão noturno Barra da Tijuca",
    branchName: "Barra da Tijuca",
    timezone: "America/Sao_Paulo",
    shiftStartsAt: new Date("2026-10-25T21:00:00.000Z"),
  };

  if (screen === "plantao" || screen === "plantao-confirmado" || screen === "plantao-presencial") {
    return (
      <ConfirmPresenceView
        valid
        record={record}
        confirmed={screen === "plantao-confirmado"}
        late={false}
        active={screen !== "plantao-confirmado"}
        presencial={screen === "plantao-presencial"}
        notOpen={false}
      />
    );
  }
  if (screen === "convite-invalido") {
    return <OnboardingNotice title="Convite inválido ou expirado" description="Este link de ativação é de uso único, expirou ou foi revogado pelo gestor." />;
  }
  return <PublicFixtureClient screen={screen} />;
}
