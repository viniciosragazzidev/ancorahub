import { DashboardHeader } from "@/components/dashboard-header";
import { ensureTeamQuickRepliesSeeded, getMessageLibrary } from "@/features/message-library/service";
import { AuthorizationError } from "@/shared/auth/errors";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { MessagesWorkspace } from "./_components/messages-workspace";
import litePage from "@/components/lite/page/lite-page.module.css";
import { isDirectorLitePageOnServer } from "@/features/director-lite/style-flag";
import { isDutyShiftReminderEnabled } from "@/features/lead-distribution/duty-shift-reminder-flag";
import { MessagesWorkspaceLite } from "./_components/messages-workspace-lite";

const count = (value: number, one: string, many: string) => `${value.toLocaleString("pt-BR")} ${value === 1 ? one : many}`;

export const dynamic = "force-dynamic";

export const metadata = { title: "Mensagens - Atendimento" };

/**
 * Every message the system can send to customers and to the team: Meta
 * templates, free texts and the AI's answers, with where each is valid, where
 * it is used and through which channel.
 */
export default async function AtendimentoMensagensPage() {
  const context = await getRequiredTenantContext();
  if (context.role !== "director" && context.role !== "manager") {
    throw new AuthorizationError("Apenas Diretores e Gestores podem gerenciar as mensagens do atendimento.");
  }
  // As 4 respostas rápidas da equipe viram texto editável na primeira visita.
  await ensureTeamQuickRepliesSeeded(context.tenantId, context.userId).catch((error) => {
    console.warn("[mensagens] team_quick_replies_seed_failed", { errorType: error instanceof Error ? error.name : "unknown" });
  });
  const [messages, dutyReminderEnabled] = await Promise.all([
    getMessageLibrary(context.tenantId),
    isDutyShiftReminderEnabled(context.tenantId),
  ]);
  // Resumo do topo (anatomia de página), só com o que a página já carrega.
  const inUse = messages.filter((message) => message.usages.length > 0).length;
  const summary = [count(messages.length, "mensagem", "mensagens"), inUse > 0 ? `${inUse.toLocaleString("pt-BR")} em uso` : null].filter(Boolean).join(" · ");

  // Chave do visual Lite: a mesma biblioteca e as mesmas ações, com a lista Lite.
  if (await isDirectorLitePageOnServer(context, "/atendimento/mensagens")) {
    return (
      <>
        <DashboardHeader breadcrumb="Atendimento" title="Mensagens" summary={summary} />
        <main className={litePage.stack}>
          <MessagesWorkspaceLite messages={messages} dutyReminderEnabled={dutyReminderEnabled} />
        </main>
      </>
    );
  }

  return (
    <>
      <DashboardHeader breadcrumb="Atendimento" title="Mensagens" summary={summary} />
      <main className="flex flex-1 flex-col gap-5 p-(--mobile-page-padding) sm:gap-6 lg:p-6">
        <MessagesWorkspace messages={messages} dutyReminderEnabled={dutyReminderEnabled} />
      </main>
    </>
  );
}
