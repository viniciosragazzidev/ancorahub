import { NextResponse } from "next/server";

import { startMetaMarketingConnection } from "@/features/meta-ads/meta-marketing-connection-service";
import { AuthenticationError, AuthorizationError } from "@/shared/auth/errors";

export const dynamic = "force-dynamic";

function failure(error: unknown) {
  if (error instanceof AuthenticationError) {
    return { status: 401, code: error.code, message: "Sua sessão expirou. Entre novamente para conectar a Meta." };
  }
  if (error instanceof AuthorizationError || (error instanceof Error && error.message.startsWith("Apenas Diretores"))) {
    return { status: 403, code: "ACCESS_DENIED", message: "Somente o Diretor pode conectar o Marketing da Meta." };
  }
  return { status: 500, code: "META_CONNECTION_START_FAILED", message: "Não foi possível preparar a conexão com a Meta. Tente novamente." };
}

export async function POST() {
  try {
    const attempt = await startMetaMarketingConnection();
    console.info("[meta-marketing-connect] attempt_created", { attemptId: attempt.id });
    return NextResponse.json({ state: attempt.state }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const result = failure(error);
    console.error("[meta-marketing-connect] attempt_failed", {
      code: result.code,
      cause: error instanceof Error ? error.message : "unknown",
    });
    return NextResponse.json({ code: result.code, message: result.message }, {
      status: result.status,
      headers: { "Cache-Control": "no-store" },
    });
  }
}
