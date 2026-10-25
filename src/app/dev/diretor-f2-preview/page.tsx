import { notFound } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { DashboardHeader } from "@/components/dashboard-header";
import { Button } from "@/components/arc/button/button";
import type { UserDisplayInfo } from "@/shared/auth/actions";

const permissions = [
  "acessar_dashboard",
  "acessar_conversas",
  "acessar_leads",
  "acessar_qualificacao_ia",
  "acessar_vendas",
  "convidar_corretor",
  "acessar_configuracoes_pessoais",
  "acessar_campanhas_meta",
  "acessar_ferramentas",
];

const previewUser: UserDisplayInfo = {
  name: "Renata Alves",
  role: "Diretor",
  roleKey: "director",
  jobTitle: "director",
  permissions,
  redirectLogout: "/dashboard",
  isPlatformAdmin: false,
  userProfileEnabled: true,
  relationshipCenterEnabled: true,
};

/** Prévia local do shell real, sem consulta de usuário ou dados do tenant. */
export default async function DirectorF2PreviewPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (process.env.NODE_ENV !== "development") notFound();
  const params = await searchParams;
  const directorLiteEnabled = params.skin !== "off";

  return (
    <AppShell
      directorLiteEnabled={directorLiteEnabled}
      initialSidebarUser={previewUser}
      initialSidebarPathname="/dashboard"
      user={{ name: previewUser.name, email: "renata@ancora.example", role: previewUser.role ?? "Diretor", jobTitle: previewUser.jobTitle }}
      branding={{ brandColor: null, logoUrl: null, tenantName: "Âncora Saúde" }}
      viewAs={{ canViewAs: false, viewingAs: null }}
    >
      <div className={directorLiteEnabled ? "director-f2-preview" : "min-h-full bg-background"}>
        <DashboardHeader
          breadcrumb="Início"
          title="Visão da operação"
          rightSlot={<Button variant="secondary" size="sm">Hoje</Button>}
        />
        <main className={directorLiteEnabled ? "director-f2-preview-content" : "mx-auto flex w-full max-w-7xl flex-col gap-6 p-6"} aria-label="Prévia do painel">
          <div className={directorLiteEnabled ? "director-f2-preview-heading" : "flex items-end justify-between gap-4"}>
            <div>
              <p className={directorLiteEnabled ? undefined : "text-sm text-muted-foreground"}>Resumo do dia</p>
              <h1 className={directorLiteEnabled ? undefined : "mt-1 text-2xl font-semibold"}>Bom dia, Renata</h1>
            </div>
            <span className={directorLiteEnabled ? undefined : "text-sm text-muted-foreground"}>Atualizado agora</span>
          </div>
          <section className={directorLiteEnabled ? "director-f2-preview-metrics" : "grid grid-cols-1 gap-4 sm:grid-cols-3"} aria-label="Indicadores">
            <article className={directorLiteEnabled ? undefined : "rounded-xl border bg-card p-5 shadow-sm"}><span className="block text-sm text-muted-foreground">Leads novos</span><strong className="block text-3xl font-semibold">24</strong><small className="text-sm text-muted-foreground">+ 6 desde ontem</small></article>
            <article className={directorLiteEnabled ? undefined : "rounded-xl border bg-card p-5 shadow-sm"}><span className="block text-sm text-muted-foreground">Em atendimento</span><strong className="block text-3xl font-semibold">18</strong><small className="text-sm text-muted-foreground">12 responderam</small></article>
            <article className={directorLiteEnabled ? undefined : "rounded-xl border bg-card p-5 shadow-sm"}><span className="block text-sm text-muted-foreground">Plantões ativos</span><strong className="block text-3xl font-semibold">3</strong><small className="text-sm text-muted-foreground">11 corretores confirmados</small></article>
          </section>
          <section className={directorLiteEnabled ? "director-f2-preview-activity" : "rounded-xl border bg-card p-5 shadow-sm"} aria-label="Atividade recente">
            <div className="mb-3 flex items-center justify-between"><h2 className="text-lg font-semibold">Atividade recente</h2><span className="text-sm text-muted-foreground">Hoje</span></div>
            <p className={directorLiteEnabled ? undefined : "flex items-center gap-3 border-b py-3 text-sm last:border-0"}><i aria-hidden="true" className={directorLiteEnabled ? undefined : "size-2 rounded-full bg-primary"} />Novo lead distribuído <strong className={directorLiteEnabled ? undefined : "ml-auto text-muted-foreground"}>há 4 min</strong></p>
            <p className={directorLiteEnabled ? undefined : "flex items-center gap-3 border-b py-3 text-sm last:border-0"}><i aria-hidden="true" className={directorLiteEnabled ? undefined : "size-2 rounded-full bg-primary"} />Plantão presencial iniciado <strong className={directorLiteEnabled ? undefined : "ml-auto text-muted-foreground"}>às 9:00</strong></p>
            <p className={directorLiteEnabled ? undefined : "flex items-center gap-3 border-b py-3 text-sm last:border-0"}><i aria-hidden="true" className={directorLiteEnabled ? undefined : "size-2 rounded-full bg-primary"} />12 clientes responderam no WhatsApp <strong className={directorLiteEnabled ? undefined : "ml-auto text-muted-foreground"}>agora</strong></p>
          </section>
        </main>
      </div>
    </AppShell>
  );
}
