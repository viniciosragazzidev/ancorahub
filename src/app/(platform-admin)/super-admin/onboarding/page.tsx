import { searchPlatformOnboardingUsers } from "@/features/onboarding/route-onboarding-service";
import { resetUserRouteOnboardingAction } from "../actions";
import { PlatformAdminHeader } from "@/components/platform-admin-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default async function SuperAdminOnboardingPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = "" } = await searchParams;
  const users = q.trim() ? await searchPlatformOnboardingUsers(q) : [];

  return (
    <>
      <PlatformAdminHeader breadcrumb="CorreTop / Admin" title="Onboarding guiado" />
      <main className="flex flex-1 flex-col gap-6 p-4 lg:p-6">
        <section>
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">Governança de experiência</p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight">Reiniciar apresentações por usuário</h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">Pesquise por nome, e-mail ou ID. O reset reativa todas as apresentações de todas as rotas daquele usuário na corretora selecionada, sem apagar o histórico da operação.</p>
        </section>

        <Card className="border-border bg-card shadow-none">
          <CardHeader><CardTitle>Encontrar usuário</CardTitle><CardDescription>A busca é executada no servidor e mostra somente vínculos administrativos necessários para escolher o escopo.</CardDescription></CardHeader>
          <CardContent>
            <form className="flex flex-col gap-2 sm:flex-row" method="get">
              <Input aria-label="Nome, e-mail ou ID" defaultValue={q} name="q" placeholder="Nome, e-mail ou ID do usuário" />
              <Button type="submit">Pesquisar</Button>
            </form>
          </CardContent>
        </Card>

        {q && (
          <Card className="border-border bg-card shadow-none">
            <CardHeader><CardTitle>Resultados</CardTitle><CardDescription>{users.length} vínculo(s) encontrado(s) para “{q}”.</CardDescription></CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader><TableRow><TableHead className="pl-5">Usuário</TableHead><TableHead>Corretora</TableHead><TableHead>Perfil</TableHead><TableHead>Unidade</TableHead><TableHead className="pr-5 text-right">Ação</TableHead></TableRow></TableHeader>
                <TableBody>
                  {users.map((member) => (
                    <TableRow key={`${member.userId}-${member.tenantId}`}>
                      <TableCell className="pl-5"><p className="font-medium">{member.name}</p><p className="text-xs text-muted-foreground">{member.email}</p><p className="font-mono text-[10px] text-muted-foreground">{member.userId}</p></TableCell>
                      <TableCell className="text-sm">{member.tenantName}</TableCell>
                      <TableCell><Badge variant="outline">{member.role}</Badge></TableCell>
                      <TableCell className="text-sm text-muted-foreground">{member.branchName ?? "Sem unidade"}</TableCell>
                      <TableCell className="pr-5 text-right"><form action={resetUserRouteOnboardingAction}><input name="userId" type="hidden" value={member.userId} /><input name="tenantId" type="hidden" value={member.tenantId} /><Button size="sm" type="submit">Ativar e reiniciar</Button></form></TableCell>
                    </TableRow>
                  ))}
                  {users.length === 0 && <TableRow><TableCell className="p-8 text-center text-sm text-muted-foreground" colSpan={5}>Nenhum vínculo encontrado. Tente o nome completo, e-mail ou ID.</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </main>
    </>
  );
}
