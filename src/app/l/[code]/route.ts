import { type NextRequest, NextResponse } from "next/server";

import { buildRedirectTarget, PUBLIC_FORM_PATH } from "@/features/tracking-links/core";
import { findActiveLinkByCode, recordTrackingLinkClick } from "@/features/tracking-links/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BOT = /bot|crawler|spider|preview|facebookexternalhit|whatsapp|slurp|curl|wget/i;

/**
 * Link rastreável público (/l/<codigo>), sem login: soma um clique no dia e redireciona para o WhatsApp da empresa ou
 * para o formulário, preservando as UTMs. Não expõe nada da empresa: código desconhecido, pausado ou excluído vai para
 * o formulário público, sem origem, igual para todos. Robôs de prévia (o próprio WhatsApp ao colar o link) não contam como clique.
 * A contagem nunca segura o redirecionamento: se o banco falhar, a pessoa segue mesmo assim.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  // Atrás do proxy do Coolify a origem da requisição pode ser a interna; vale o endereço público do app.
  const origin = (process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin).replace(/\/+$/, "");
  const headers = { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" };
  let link: Awaited<ReturnType<typeof findActiveLinkByCode>> = null;
  try {
    link = await findActiveLinkByCode(code);
  } catch (error) {
    console.error("[tracking-links] lookup_failed", { error: error instanceof Error ? error.message.slice(0, 200) : "unknown" });
  }
  if (!link) return NextResponse.redirect(new URL(PUBLIC_FORM_PATH, origin), { status: 302, headers });

  const userAgent = request.headers.get("User-Agent") ?? "";
  const prefetch = request.headers.get("Purpose") === "prefetch" || request.headers.get("Sec-Purpose")?.includes("prefetch");
  if (!BOT.test(userAgent) && !prefetch) {
    await recordTrackingLinkClick(link.id).catch((error) => {
      console.warn("[tracking-links] click_failed", { error: error instanceof Error ? error.message.slice(0, 200) : "unknown" });
    });
  }
  return NextResponse.redirect(buildRedirectTarget(link, request.nextUrl.searchParams, origin), { status: 302, headers });
}
