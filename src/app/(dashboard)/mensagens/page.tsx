import { redirect } from "next/navigation";

import { getLiteAudience } from "@/features/broker-workspace/lite-audience";
import { listTeamConversations } from "@/features/team-conversations/queries";
import { TeamConversationsList } from "@/features/team-conversations/team-conversations-list";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";

export const dynamic = "force-dynamic";

/** Mensagens da unidade (gestor) ou da equipe (supervisor), in Lite. Everyone else keeps /conversas. */
export default async function TeamMessagesPage() {
  const context = await getRequiredTenantContext();
  const audience = await getLiteAudience(context);
  if (audience !== "manager" && audience !== "supervisor") redirect("/conversas");
  const conversations = await listTeamConversations(context);
  return <TeamConversationsList conversations={conversations} scopeLabel={audience === "manager" ? "unidade" : "equipe"} />;
}
