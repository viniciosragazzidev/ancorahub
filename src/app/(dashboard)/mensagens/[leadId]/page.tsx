import { notFound, redirect } from "next/navigation";

import { getLiteAudience } from "@/features/broker-workspace/lite-audience";
import { getTeamConversation } from "@/features/team-conversations/queries";
import { TeamConversationView } from "@/features/team-conversations/team-conversation-view";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";

export const dynamic = "force-dynamic";

/** One broker conversation, read only. Outside the viewer's unit or team it does not exist (404). */
export default async function TeamMessagePage({ params }: { params: Promise<{ leadId: string }> }) {
  const { leadId } = await params;
  const context = await getRequiredTenantContext();
  const audience = await getLiteAudience(context);
  if (audience !== "manager" && audience !== "supervisor") redirect("/conversas");
  const conversation = await getTeamConversation(context, leadId);
  if (!conversation) notFound();
  return <TeamConversationView conversation={conversation} />;
}
