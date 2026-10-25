"use client";

/**
 * Dev-only: as telas da Onda 4 (equipe e unidades) no visual Lite dentro da moldura real, com dados de exemplo
 * realistas (nomes longos, muitos pedidos, vários status). Cada tela usa os mesmos componentes Lite da página real.
 */
import { DashboardHeader } from "@/components/dashboard-header";
import litePage from "@/components/lite/page/lite-page.module.css";
import { UnitProfileLite, type UnitProfileLiteData } from "@/features/branches/components/unit-profile-lite";
import { TeamInviteLite } from "@/app/(dashboard)/equipe/_components/team-invite-lite";
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

export const BRANCH_FIXTURES = [
  { id: "11111111-1111-4111-8111-111111111111", name: "Centro" },
  { id: "22222222-2222-4222-8222-222222222222", name: "Barra da Tijuca" },
  { id: "33333333-3333-4333-8333-333333333333", name: "Niterói 1" },
  { id: "44444444-4444-4444-8444-444444444444", name: "Campo Grande e Zona Oeste" },
];

export function ConvidarShellScreen() {
  return (
    <>
      <DashboardHeader breadcrumb="Gestão de equipe" title="Criar membro" />
      <main className={litePage.stack}>
        <section className={`arc-venancor ${litePage.card} ${litePage.narrow}`} data-skin="diretor" aria-labelledby="convidar-titulo">
          <div className={litePage.cardHead}>
            <h2 id="convidar-titulo" className={litePage.sectionTitle}>Novo funcionário</h2>
            <p className={litePage.muted}>Você pode criar diretores, gestores e corretores. A senha é criada pelo colaborador no primeiro acesso.</p>
          </div>
          <TeamInviteLite branches={BRANCH_FIXTURES} canInviteManager canInviteDirector />
        </section>
      </main>
    </>
  );
}

const MEMBER_NAMES = ["Maximiliano Cavalcanti Rocha", "Ana Souza", "Roseleia Oliveira Bittencourt", "Bruno Lima", "Carla Dias", "Justiniano Albuquerque de Souza", "Juliana Prado", "Raimundo Nonato Silva"];

export const UNIT_FIXTURE: UnitProfileLiteData = {
  branch: { id: BRANCH_FIXTURES[1]!.id, name: "Barra da Tijuca", status: "active", acceptingLeads: true, autoDistribute: true },
  metrics: { period: "outubro de 2026", totalLeads: 1842, leadsConvertidos: 312, leadsPerdidos: 401, leadsAtivos: 655, leadsDistribuidos: 87, taxaConversao: 17, taxaPerda: 22, leadsTrend: [212, 260, 241, 288, 270, 301, 270] },
  members: [
    { userId: "m-gestor", name: "Marina Exemplo", email: "marina.exemplo@ancorasaude.com.br", role: "manager", jobTitle: "manager", availabilityStatus: "available", membershipStatus: "active", activeLeads: 0 },
    { userId: "m-sup", name: "Raimundo Nonato Silva", email: "raimundo.silva@ancorasaude.com.br", role: "supervisor", jobTitle: "supervisor", availabilityStatus: "available", membershipStatus: "active", activeLeads: 4 },
    ...MEMBER_NAMES.slice(0, 7).map((name, index) => ({
      userId: `m-${index}`,
      name,
      email: `${name.toLowerCase().normalize("NFD").replace(/[^a-z ]/g, "").split(" ").slice(0, 2).join(".")}@ancorasaude.com.br`,
      role: "broker" as const,
      jobTitle: "broker",
      availabilityStatus: index % 3 === 2 ? ("paused" as const) : ("available" as const),
      membershipStatus: "active" as const,
      activeLeads: [48, 36, 31, 22, 19, 12, 7][index]!,
    })),
  ],
  topBrokers: MEMBER_NAMES.slice(0, 5).map((name, index) => ({ userId: `m-${index}`, name, totalLeads: [210, 188, 160, 142, 97][index]!, converted: [61, 44, 31, 22, 9][index]!, conversionRate: [29, 23, 19, 15, 9][index]! })),
};

export function UnidadeShellScreen() {
  return (
    <>
      <DashboardHeader breadcrumb="Unidade" title="Barra da Tijuca" />
      <main className={litePage.stack}>
        <UnitProfileLite data={UNIT_FIXTURE} period={30} backHref="/equipe?visao=unidades" />
      </main>
    </>
  );
}
