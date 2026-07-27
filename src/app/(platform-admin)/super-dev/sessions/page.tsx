import { getActiveSessions } from "@/features/platform-admin/service";
import { terminateSessionAction } from "../actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PlatformAdminHeader } from "@/components/platform-admin-header";
import { ShieldWarning } from "@/components/huge-icons";

export default async function SuperDevSessionsPage() {
  const sessions = await getActiveSessions();

  return (
    <>
      <PlatformAdminHeader breadcrumb="CorreTop / Admin" title="Sessões & Logins Ativos" />

      <main className="flex flex-1 flex-col gap-6 p-4 lg:p-6">
        <section className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Sessões do Sistema</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Monitore os logins ativos na plataforma com informação de IP e agente do navegador (dispositivo).
            </p>
          </div>
        </section>

        <Card className="border-border bg-card shadow-none">
          <CardHeader>
            <CardTitle>Conexões ativas</CardTitle>
            <CardDescription>{sessions.length} dispositivo(s) autenticado(s).</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-5">Usuário</TableHead>
                  <TableHead>E-mail</TableHead>
                  <TableHead>Endereço IP</TableHead>
                  <TableHead>Navegador / Dispositivo</TableHead>
                  <TableHead>Expira em</TableHead>
                  <TableHead className="pr-5">Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sessions.map((session) => (
                  <TableRow key={session.id}>
                    <TableCell className="pl-5 font-semibold text-xs">{session.userName}</TableCell>
                    <TableCell className="text-xs">{session.userEmail}</TableCell>
                    <TableCell className="font-mono text-xs">{session.ipAddress || "—"}</TableCell>
                    <TableCell className="text-xs max-w-xs truncate" title={session.userAgent || undefined}>
                      {session.userAgent || "—"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(session.expiresAt))}
                    </TableCell>
                    <TableCell className="pr-5">
                      <form action={terminateSessionAction}>
                        <input type="hidden" name="sessionId" value={session.id} />
                        <Button size="xs" variant="destructive" type="submit">
                          Encerrar
                        </Button>
                      </form>
                    </TableCell>
                  </TableRow>
                ))}
                {sessions.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      Nenhuma conexão ativa encontrada.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </main>
    </>
  );
}
