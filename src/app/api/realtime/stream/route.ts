import { NextResponse } from "next/server";

import { subscribeRealtimeTopic } from "@/features/notifications/realtime-bus";
import { getRealtimeSyncTopic, isRealtimeSyncEnabled, REALTIME_SYNC_EVENT } from "@/features/notifications/realtime-sync";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Comentário a cada 25 s: mantém a conexão viva no proxy e revela aba fechada. */
const HEARTBEAT_MS = 25_000;

/**
 * Avisos em tempo real da pessoa logada (Server-Sent Events). O tópico é calculado aqui, a partir
 * da sessão: o navegador não escolhe o que escuta. Um GET, para seguir funcionando no "Ver como".
 */
export async function GET(request: Request) {
  const context = await getRequiredTenantContext().catch(() => null);
  if (!context) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!(await isRealtimeSyncEnabled())) return new NextResponse(null, { status: 204 });
  const topic = getRealtimeSyncTopic({ tenantId: context.tenantId, userId: context.userId });
  if (!topic) return new NextResponse(null, { status: 204 });

  const encoder = new TextEncoder();
  let cleanup = () => {};
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      const send = (chunk: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          cleanup();
        }
      };
      let unsubscribe: (() => void) | null = null;
      const heartbeat = setInterval(() => send(": ping\n\n"), HEARTBEAT_MS);
      cleanup = () => {
        if (closed) return;
        closed = true;
        clearInterval(heartbeat);
        unsubscribe?.();
        try {
          controller.close();
        } catch {
          // já fechado
        }
      };
      request.signal.addEventListener("abort", () => cleanup());
      // O navegador reconecta sozinho depois de 3 s se a conexão cair.
      send("retry: 3000\n\n");
      try {
        unsubscribe = await subscribeRealtimeTopic(
          topic,
          (signal) => send(`event: ${REALTIME_SYNC_EVENT}\ndata: ${JSON.stringify(signal)}\n\n`),
          (live) => { if (!live) cleanup(); },
        );
        if (closed) unsubscribe();
        else send("event: ready\ndata: {}\n\n");
      } catch {
        // Sem a conexão de escuta: fecha; a aba volta a conferir de tempos em tempos.
        cleanup();
      }
    },
    cancel() {
      cleanup();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      // no-transform: sem compressão, que seguraria os avisos no buffer.
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
