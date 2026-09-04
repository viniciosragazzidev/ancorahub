import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";

import { updateSession } from "@/utils/supabase/middleware";
import { getDatabase, schema } from "@/shared/db";
import { isNavigationPrefetch } from "@/shared/http/navigation-prefetch";
import { startMiddlewareTiming, endMiddlewareTiming, logMiddlewareSpan } from "@/shared/observability/middleware-timing";

const protectedPathPrefixes = [
  "/welcome", "/dashboard", "/equipe", "/leads", "/roadmap", "/documentos",
  "/clientes", "/metas", "/relatorios", "/catalogo", "/minha-fila", "/minha-meta",
  "/notificacoes", "/filiais", "/financeiro", "/configuracoes", "/diretor", "/gestor",
  "/corretor", "/super-admin", "/checklist", "/materiais-divulgacao", "/marketing",
  "/conversas", "/qualificacao", "/automacoes", "/inteligencia", "/integrations",
  "/vendas", "/cotacao", "/empresas", "/tarefas", "/agentes-ia", "/assistente",
  "/noc", "/guia", "/propostas", "/ferramentas-vendas"
] as const;
const publicPaths = ["/compartilhado", "/api/public", "/health"] as const;
const authPaths = ["/login", "/verify", "/admin/login"] as const;

type SessionLookup = { userId: string; role: string | null; onboardingStatus: string | null } | null;
const sessionCache = new Map<string, { expiresAt: number; value: SessionLookup }>();
const SESSION_CACHE_TTL_MS = 60_000;

async function lookupSession(token: string): Promise<SessionLookup> {
  const cached = sessionCache.get(token);
  if (cached && cached.expiresAt > Date.now()) return cached.value;
  if (cached) sessionCache.delete(token);
  // Timeout after 3s to avoid blocking ALL requests when the connection pool
  // is exhausted by heavy pages (e.g. /super-admin/settings).
  // The page component will verify auth independently if the middleware
  // cannot reach the database in time.
  const TIMEOUT_MS = 3_000;
  let timerId: ReturnType<typeof setTimeout> | undefined;
  try {
    const [dbSession] = await Promise.race([
      getDatabase()
        .select({
          userId: schema.session.userId,
          role: schema.tenantMemberships.role,
          onboardingStatus: schema.userOnboarding.status,
        })
        .from(schema.session)
        .leftJoin(schema.tenantMemberships, eq(schema.tenantMemberships.userId, schema.session.userId))
        .leftJoin(schema.userOnboarding, eq(schema.userOnboarding.userId, schema.session.userId))
        .where(eq(schema.session.token, token))
        .limit(1),
      new Promise<never>((_, reject) => {
        timerId = setTimeout(() => reject(new Error("Session lookup timed out")), TIMEOUT_MS);
      }),
    ]);
    const value = dbSession ?? null;
    sessionCache.set(token, { expiresAt: Date.now() + SESSION_CACHE_TTL_MS, value });
    if (sessionCache.size > 500) {
      const first = sessionCache.keys().next().value;
      if (first) sessionCache.delete(first);
    }
    return value;
  } catch {
    return null;
  } finally {
    if (timerId) clearTimeout(timerId);
  }
}

function copyCookies(source: NextResponse, target: NextResponse) {
  source.cookies.getAll().forEach((cookie) => target.cookies.set(cookie));
}

function hasSupabaseSessionCookie(request: NextRequest) {
  return request.cookies
    .getAll()
    .some((cookie) => cookie.name.startsWith("sb-") && cookie.name.includes("auth-token"));
}

async function getSafeSupabaseResponse(request: NextRequest) {
  const fallback = NextResponse.next({ request: { headers: request.headers } });

  // Better Auth is the CRM access authority. Do not make every App Router
  // navigation wait for Supabase when the browser has no Supabase session.
  // This prevents an external token refresh from leaving the entire product on
  // its loading boundary.
  if (!hasSupabaseSessionCookie(request)) return fallback;

  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      updateSession(request),
      new Promise<NextResponse>((resolve) => {
        timer = setTimeout(() => resolve(fallback), 500);
      }),
    ]);
  } catch {
    return fallback;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const requestId = request.headers.get("x-request-id") ?? randomUUID();
  request.headers.set("x-request-id", requestId);
  request.headers.set("x-pathname", pathname);
  const timing = startMiddlewareTiming(pathname, requestId);

  if (isNavigationPrefetch(request.headers)) {
    const response = NextResponse.next({ request: { headers: request.headers } });
    response.headers.set("x-request-id", requestId);
    response.headers.set("x-prefetch", "bypassed-proxy-session");
    return response;
  }

  const supabaseStartMs = performance.now();
  const supabaseResponse = await getSafeSupabaseResponse(request);
  logMiddlewareSpan(timing, "middleware.supabase_session", supabaseStartMs);
  const session = request.cookies.get("better-auth.session_token")
    ?? request.cookies.get("__Secure-better-auth.session_token")
    ?? request.cookies.get("better-auth.session_token.value");

  let userId: string | null = null;
  let onboardingDone = true;

  if (session?.value) {
    try {
      const sessionLookupStartMs = performance.now();
      const dbSession = await lookupSession(session.value);
      logMiddlewareSpan(timing, "middleware.session_lookup", sessionLookupStartMs);

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

  let response: NextResponse;

  if (authPaths.some((p) => pathname.startsWith(p))) {
    if (session) {
      response = NextResponse.redirect(new URL(pathname.startsWith("/admin") ? "/super-admin" : "/dashboard", request.url));
      copyCookies(supabaseResponse, response);
    } else {
      response = supabaseResponse;
    }
    response.headers.set("x-request-id", requestId);
    endMiddlewareTiming(timing, response.status);
    return response;
  }

  // Public paths bypass auth entirely
  if (publicPaths.some((p) => pathname.startsWith(p))) {
    response = supabaseResponse;
    response.headers.set("x-request-id", requestId);
    endMiddlewareTiming(timing, response.status);
    return response;
  }

  if (!protectedPathPrefixes.some((prefix) => pathname.startsWith(prefix))) {
    response = supabaseResponse;
    response.headers.set("x-request-id", requestId);
    endMiddlewareTiming(timing, response.status);
    return response;
  }

  if (!session) {
    response = NextResponse.redirect(new URL(pathname.startsWith("/super-admin") ? "/admin/login" : "/login", request.url));
    copyCookies(supabaseResponse, response);
    response.headers.set("x-request-id", requestId);
    endMiddlewareTiming(timing, response.status);
    return response;
  }

  response = supabaseResponse;
  response.headers.set("x-request-id", requestId);
  endMiddlewareTiming(timing, response.status);
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
