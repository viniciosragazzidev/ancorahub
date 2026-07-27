import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";

import { updateSession } from "@/utils/supabase/middleware";
import { getDatabase, schema } from "@/shared/db";

const protectedPathPrefixes = ["/welcome", "/dashboard", "/equipe", "/leads", "/roadmap", "/documentos", "/clientes", "/metas", "/relatorios", "/catalogo", "/minha-fila", "/minha-meta", "/notificacoes", "/filiais", "/financeiro", "/configuracoes", "/diretor", "/gestor", "/corretor", "/super-admin", "/checklist", "/materiais-divulgacao", "/marketing"] as const;
const publicPaths = ["/compartilhado", "/api/public"] as const;
const authPaths = ["/login", "/verify", "/admin/login"] as const;

type SessionLookup = { userId: string; role: string | null; onboardingStatus: string | null } | null;
const sessionCache = new Map<string, { expiresAt: number; value: SessionLookup }>();
const SESSION_CACHE_TTL_MS = 5_000;

async function lookupSession(token: string): Promise<SessionLookup> {
  const cached = sessionCache.get(token);
  if (cached && cached.expiresAt > Date.now()) return cached.value;
  if (cached) sessionCache.delete(token);
  const [dbSession] = await getDatabase()
    .select({
      userId: schema.session.userId,
      role: schema.tenantMemberships.role,
      onboardingStatus: schema.userOnboarding.status,
    })
    .from(schema.session)
    .leftJoin(schema.tenantMemberships, eq(schema.tenantMemberships.userId, schema.session.userId))
    .leftJoin(schema.userOnboarding, eq(schema.userOnboarding.userId, schema.session.userId))
    .where(eq(schema.session.token, token))
    .limit(1);
  const value = dbSession ?? null;
  sessionCache.set(token, { expiresAt: Date.now() + SESSION_CACHE_TTL_MS, value });
  if (sessionCache.size > 500) {
    const first = sessionCache.keys().next().value;
    if (first) sessionCache.delete(first);
  }
  return value;
}

function copyCookies(source: NextResponse, target: NextResponse) {
  source.cookies.getAll().forEach((cookie) => target.cookies.set(cookie));
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const requestId = request.headers.get("x-request-id") ?? randomUUID();
  request.headers.set("x-request-id", requestId);
  request.headers.set("x-pathname", pathname);
  const supabaseResponse = await updateSession(request);
  const session = request.cookies.get("better-auth.session_token")
    ?? request.cookies.get("__Secure-better-auth.session_token")
    ?? request.cookies.get("better-auth.session_token.value");

  let userId: string | null = null;
  let onboardingDone = true;

  if (session?.value) {
    try {
      const dbSession = await lookupSession(session.value);

      if (dbSession) {
        userId = dbSession.userId;
        if (dbSession.role === "broker") {
          onboardingDone = dbSession.onboardingStatus === "COMPLETED";
        }
      }
    } catch (e) {
      console.error("Error fetching session from DB in proxy.ts:", e);
    }
  }

  if (userId) {
    if (!onboardingDone && !pathname.startsWith("/onboarding") && !pathname.startsWith("/primeiro-acesso") && !pathname.startsWith("/login") && !pathname.startsWith("/api/auth")) {
      const response = NextResponse.redirect(new URL("/onboarding", request.url));
      copyCookies(supabaseResponse, response);
      response.headers.set("x-request-id", requestId);
      return response;
    }
    if (onboardingDone && (pathname.startsWith("/primeiro-acesso") || pathname.startsWith("/onboarding"))) {
      const response = NextResponse.redirect(new URL("/dashboard", request.url));
      copyCookies(supabaseResponse, response);
      response.headers.set("x-request-id", requestId);
      return response;
    }
  }

  if (authPaths.some((p) => pathname.startsWith(p))) {
    if (session) {
      const response = NextResponse.redirect(new URL(pathname.startsWith("/admin") ? "/super-admin" : "/dashboard", request.url));
      copyCookies(supabaseResponse, response);
      response.headers.set("x-request-id", requestId);
      return response;
    }
    const response = supabaseResponse;
    response.headers.set("x-request-id", requestId);
    return response;
  }

  // Public paths bypass auth entirely
  if (publicPaths.some((p) => pathname.startsWith(p))) {
    const response = supabaseResponse;
    response.headers.set("x-request-id", requestId);
    return response;
  }

  if (!protectedPathPrefixes.some((prefix) => pathname.startsWith(prefix))) {
    const response = supabaseResponse;
    response.headers.set("x-request-id", requestId);
    return response;
  }

  if (!session) {
    const response = NextResponse.redirect(new URL(pathname.startsWith("/super-admin") ? "/admin/login" : "/login", request.url));
    copyCookies(supabaseResponse, response);
    response.headers.set("x-request-id", requestId);
    return response;
  }

  const response = supabaseResponse;
  response.headers.set("x-request-id", requestId);
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
