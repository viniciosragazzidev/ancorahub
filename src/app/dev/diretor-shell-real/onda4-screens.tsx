"use client";

/**
 * Dev-only: as telas da Onda 4 (equipe e unidades) no visual Lite dentro da moldura real, com dados de exemplo
 * realistas (nomes longos, muitos pedidos, vários status). Cada tela usa os mesmos componentes Lite da página real.
 */
import { DashboardHeader } from "@/components/dashboard-header";
import litePage from "@/components/lite/page/lite-page.module.css";
import { RecoveryLite, type RecoveryLiteRequest } from "@/app/(dashboard)/equipe/recuperacoes/_components/recovery-lite";

const PEOPLE = [
  ["Maximiliano Cavalcanti Rocha", "maximiliano.rocha@ancorasaude.com.br"],
  ["Ana Souza", "ana.souza@ancorasaude.com.br"],
  ["Roseleia Oliveira Bittencourt", "roseleia.bittencourt@ancorasaude.com.br"],
  ["Bruno Lima", "bruno.lima@ancorasaude.com.br"],
  ["Carla Dias", "carla.dias@ancorasaude.com.br"],
  ["Justiniano Albuquerque de Souza", "justiniano.souza@ancorasaude.com.br"],
] as const;
const RECOVERY_STATUSES = ["requested", "requested", "approved", "rejected", "completed", "requested", "approved", "rejected"];

export const RECOVERY_FIXTURES: RecoveryLiteRequest[] = Array.from({ length: 14 }, (_, index) => {
  const [name, email] = PEOPLE[index % PEOPLE.length]!;
  const status = RECOVERY_STATUSES[index % RECOVERY_STATUSES.length]!;
  const createdAt = new Date(Date.UTC(2026, 9, 25, 1, 30) - index * 7 * 3_600_000);
  return {
    id: `rec-${index + 1}`,
    userId: `user-${index % PEOPLE.length}`,
    userEmail: email,
    userName: name,
    status,
    createdAt: createdAt.toISOString(),
    reviewedAt: status === "requested" ? null : new Date(createdAt.getTime() + 40 * 60_000).toISOString(),
    directorNotes: status === "rejected" && index % 2 === 1 ? "Procurar o RH presencialmente para confirmar a identidade antes de liberar o acesso." : null,
  };
});

export function RecuperacoesShellScreen() {
  return (
    <>
      <DashboardHeader breadcrumb="Equipe" title="Recuperação de senha" />
      <main className={litePage.stack}>
        <RecoveryLite requests={RECOVERY_FIXTURES} />
      </main>
    </>
  );
}
