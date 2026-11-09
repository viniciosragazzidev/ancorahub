import Link from "next/link";
import { DashboardHeader } from "@/components/dashboard-header";
import { ArrowLeft } from "@/components/huge-icons";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const OUT_OF_TEAM_PROFILE_MESSAGE = "Este corretor não é da sua equipe.";

/** Supervisor que abre /equipe/[id] de um corretor de fora da equipe dele. */
export function OutOfTeamProfile() {
  return <>
    <DashboardHeader breadcrumb="Equipe" title="Perfil do membro" rightSlot={<Button render={<Link href="/equipe" />} size="sm" variant="outline"><ArrowLeft className="size-4" /> Voltar à equipe</Button>} />
    <main className="mx-auto flex min-h-full w-full max-w-[1440px] flex-col gap-5 bg-background p-4 lg:p-6">
      <Card>
        <CardHeader>
          <CardTitle role="alert">{OUT_OF_TEAM_PROFILE_MESSAGE}</CardTitle>
          <CardDescription>Você vê o perfil só dos corretores que supervisiona. Para acompanhar este corretor, fale com o gestor da unidade.</CardDescription>
        </CardHeader>
      </Card>
    </main>
  </>;
}
