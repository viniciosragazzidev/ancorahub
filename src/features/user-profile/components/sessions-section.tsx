"use client";

import { useState } from "react";
import { toast } from "@/components/ui/sonner";
import { CheckCircle, Trash, Globe } from "@/components/huge-icons";

import { authClient } from "@/shared/auth/client";
import { recordProfileAuditAction } from "../actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/features/quotes/utils";
import type { PerfilData } from "./perfil-tabs";

type SessionInfo = {
  id: string;
  token: string;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
  expiresAt: string;
  isCurrent?: boolean;
};

export function SessionsSection({ data }: { data: PerfilData }) {
  const [sessions, setSessions] = useState<SessionInfo[]>(data.sessions);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [now] = useState(() => Date.now());

  function parseUserAgent(raw: string | null) {
    if (!raw) return "Dispositivo desconhecido";
    const isMobile = /Mobile|Android|iPhone|iPad/i.test(raw);
    const isMac = /Macintosh|Mac OS X/i.test(raw);
    const isWindows = /Windows/i.test(raw);
    const isLinux = /Linux/i.test(raw) && !isMobile;
    const os = isMobile ? "Celular" : isMac ? "macOS" : isWindows ? "Windows" : isLinux ? "Linux" : "Desconhecido";
    if (/Firefox/i.test(raw)) return `${os} · Firefox`;
    if (/Edg/i.test(raw)) return `${os} · Edge`;
    if (/Safari/i.test(raw) && !/Chrome|CriOS/i.test(raw)) return `${os} · Safari`;
    if (/Chrome|CriOS/i.test(raw)) return `${os} · Chrome`;
    return os;
  }

  function isExpired(expiresAt: string) {
    return new Date(expiresAt).getTime() < now;
  }

  async function revoke(sessionId: string) {
    const session = sessions.find((s) => s.id === sessionId);
    if (!session) return;
    setPendingId(sessionId);
    try {
      const result = await authClient.revokeSession({ token: session.token });
      if (result.error) throw new Error(result.error.message ?? "Não foi possível encerrar a sessão.");
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
      await recordProfileAuditAction("encerrou_sessao");
      toast.success("Sessão encerrada com sucesso.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível encerrar a sessão.");
    } finally {
      setPendingId(null);
    }
  }

  async function revokeAll() {
    setPendingId("all");
    try {
      const result = await authClient.revokeSessions();
      if (result.error) throw new Error(result.error.message ?? "Não foi possível encerrar as sessões.");
      const live = await authClient.listSessions();
      setSessions((live.data ?? []).map((s) => ({ id: s.id, token: s.token, ipAddress: s.ipAddress ?? null, userAgent: s.userAgent ?? null, createdAt: s.createdAt.toISOString(), expiresAt: s.expiresAt.toISOString() })));
      await recordProfileAuditAction("encerrou_todas_sessoes");
      toast.success("Todas as outras sessões foram encerradas.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível encerrar as sessões.");
    } finally {
      setPendingId(null);
    }
  }

  return (
    <Card className="border-border bg-card shadow-none">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">Sessões ativas</CardTitle>
            <CardDescription className="mt-1">Dispositivos em que você está conectado agora. Encerre qualquer sessão que não reconheça.</CardDescription>
          </div>
          {sessions.length > 1 ? (
            <Button type="button" size="sm" variant="outline" onClick={revokeAll} disabled={pendingId !== null}>
              {pendingId === "all" ? "Encerrando..." : "Encerrar outras sessões"}
            </Button>
          ) : null}
        </div>
      </CardHeader>
      <CardContent>
        {sessions.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma sessão ativa encontrada.</p>
        ) : (
          <ul className="grid gap-3">
            {sessions.map((session) => {
              const expired = isExpired(session.expiresAt);
              return (
                <li key={session.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-muted/20 p-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                      <Globe size={18} />
                    </span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-medium">{parseUserAgent(session.userAgent)}</p>
                        {session.isCurrent ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-600">
                            <CheckCircle size={12} weight="fill" /> Sessão atual
                          </span>
                        ) : null}
                        {expired ? <span className="text-xs text-muted-foreground">(expirada)</span> : null}
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {session.ipAddress ? `IP ${session.ipAddress} · ` : ""}Entrou em {formatDate(session.createdAt, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                        {expired ? ` · expirou em ${formatDate(session.expiresAt, { day: "2-digit", month: "short" })}` : ""}
                      </p>
                    </div>
                  </div>
                  {!session.isCurrent ? (
                    <Button type="button" size="sm" variant="ghost" onClick={() => revoke(session.id)} disabled={pendingId !== null} className="text-muted-foreground hover:text-destructive">
                      <Trash size={15} /> Encerrar
                    </Button>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
