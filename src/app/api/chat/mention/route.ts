import { NextResponse } from "next/server";
import { z } from "zod";

import { getCachedBrokerWorkspaceData } from "@/features/broker-workspace/chat/chat-rail-data";
import { buildLeadCard, buildMentionMenu, buildShortcutBlock } from "@/features/broker-workspace/chat/mention-blocks";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";

export const dynamic = "force-dynamic";

const handle = z.union([
  z.enum(["block:precisa", "block:responderam", "block:retornos", "block:meu-dia"]),
  z.string().regex(/^lead:[A-Za-z0-9_-]{1,80}$/),
]);

/**
 * The "@" of the broker chat (a GET, so it also works while a super admin views
 * as the broker): ?menu=1 returns the menu with live counts, ?h=<handle>
 * returns the blocks to show in the conversation.
 */
export async function GET(request: Request) {
  const context = await getRequiredTenantContext().catch(() => null);
  if (!context) return NextResponse.json({ error: "Sem sessão." }, { status: 401 });
  if (context.role !== "broker") return NextResponse.json({ menu: [], blocks: [] });
  const url = new URL(request.url);
  try {
    if (url.searchParams.get("menu") === "1") {
      const data = await getCachedBrokerWorkspaceData();
      return NextResponse.json({ menu: buildMentionMenu(data) }, { headers: { "Cache-Control": "no-store" } });
    }
    const parsed = handle.safeParse(url.searchParams.get("h") ?? "");
    if (!parsed.success) return NextResponse.json({ error: "Comando desconhecido." }, { status: 400 });
    const blocks = parsed.data.startsWith("lead:")
      ? await buildLeadCard(context, parsed.data.slice(5))
      : buildShortcutBlock(parsed.data, await getCachedBrokerWorkspaceData());
    return NextResponse.json({ blocks }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[chat-mention] failed", error);
    return NextResponse.json({ error: "Não consegui buscar agora." }, { status: 500 });
  }
}
