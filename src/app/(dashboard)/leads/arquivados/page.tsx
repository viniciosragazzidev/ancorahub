import { and, asc, count, eq, ilike, isNotNull, isNull, or } from "drizzle-orm";
import Link from "next/link";
import { connection } from "next/server";
import { redirect } from "next/navigation";

import { Archive, ArrowLeft, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DashboardHeader } from "@/components/dashboard-header";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getDatabase, schema } from "@/shared/db";

const PAGE_SIZE = 50;

export const dynamic = "force-dynamic";

function formatDate(value: Date | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(value);
}

export default async function ArchivedLeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; search?: string }>;
}) {
  await connection();
  const context = await getRequiredTenantContext();
  if (context.role !== "director") redirect("/access-denied");

  const params = await searchParams;
  const search = params.search?.trim() ?? "";
  const parsedPage = Number.parseInt(params.page ?? "1", 10);
  const page = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1;
  const searchFilter = search
    ? or(
        ilike(schema.leads.nome, `%${search}%`),
        ilike(schema.leads.telefone, `%${search}%`),
        ilike(schema.leads.email, `%${search}%`),
      )
    : undefined;
  const where = and(
    eq(schema.leads.tenantId, context.tenantId),
    isNotNull(schema.leads.archivedAt),
    isNull(schema.leads.deletedAt),
    searchFilter,
  );
  const db = getDatabase();
  const [rows, totalRows] = await Promise.all([
    db
      .select({
        id: schema.leads.id,
        name: schema.leads.nome,
        phone: schema.leads.telefone,
        email: schema.leads.email,
        status: schema.leads.status,
        qualificationStatus: schema.leads.qualificationStatus,
        createdAt: schema.leads.createdAt,
        archivedAt: schema.leads.archivedAt,
        archivedBy: schema.user.name,
      })
      .from(schema.leads)
      .leftJoin(schema.user, eq(schema.leads.archivedBy, schema.user.id))
      .where(where)
      .orderBy(asc(schema.leads.archivedAt))
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
    db.select({ total: count(schema.leads.id) }).from(schema.leads).where(where),
  ]);
  const total = Number(totalRows[0]?.total ?? 0);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <>
      <DashboardHeader breadcrumb="Operação comercial" title="Leads arquivados" />
      <main className="mx-auto flex w-full max-w-[1400px] flex-1 flex-col gap-5 bg-background p-4 pb-28 sm:p-6 lg:gap-6 lg:p-8 lg:pb-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-muted-foreground">
              Leads retirados da distribuição sem apagar o histórico. Apenas o Diretor pode consultar esta lista.
            </p>
          </div>
          <Button variant="outline" render={<Link href="/leads" />}>
            <ArrowLeft className="size-4" /> Voltar para leads
          </Button>
        </div>

        <Card variant="overview">
          <CardHeader className="border-b border-border px-5 pb-4 pt-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Archive className="size-4 text-amber-600 dark:text-amber-400" />
                  Arquivados
                  <Badge variant="secondary">{total}</Badge>
                </CardTitle>
                <CardDescription className="mt-1">
                  O arquivamento é reversível administrativamente e não exclui os dados do lead.
                </CardDescription>
              </div>
              <form className="flex w-full gap-2 sm:w-auto" method="get">
                <div className="relative w-full sm:w-72">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input name="search" defaultValue={search} placeholder="Buscar nome, telefone ou e-mail" className="pl-9" />
                </div>
                <Button type="submit" variant="outline">Buscar</Button>
              </form>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {!rows.length ? (
              <div className="flex flex-col items-center gap-2 px-5 py-14 text-center">
                <Archive className="size-6 text-muted-foreground" />
                <p className="text-sm font-medium">Nenhum lead arquivado encontrado</p>
                <p className="text-xs text-muted-foreground">
                  {search ? "Tente outro termo de busca." : "Os leads arquivados aparecerão aqui."}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="pl-5">Lead</TableHead>
                      <TableHead>Etapa</TableHead>
                      <TableHead>Qualificação</TableHead>
                      <TableHead>Arquivado por</TableHead>
                      <TableHead className="pr-5 text-right">Arquivado em</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((lead) => (
                      <TableRow key={lead.id}>
                        <TableCell className="pl-5">
                          <p className="font-medium">{lead.name}</p>
                          <p className="text-xs text-muted-foreground">{lead.phone}{lead.email ? ` · ${lead.email}` : ""}</p>
                        </TableCell>
                        <TableCell><Badge variant="outline">{lead.status ?? "—"}</Badge></TableCell>
                        <TableCell className="text-sm text-muted-foreground">{lead.qualificationStatus ?? "—"}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{lead.archivedBy ?? "Administrador"}</TableCell>
                        <TableCell className="pr-5 text-right text-xs text-muted-foreground">{formatDate(lead.archivedAt)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
            {totalPages > 1 ? (
              <div className="flex items-center justify-between border-t border-border px-5 py-3 text-xs text-muted-foreground">
                <span>Página {page} de {totalPages}</span>
                <div className="flex gap-2">
                  <Button size="xs" variant="outline" disabled={page <= 1} render={<Link href={`/leads/arquivados?page=${page - 1}${search ? `&search=${encodeURIComponent(search)}` : ""}`} />}>Anterior</Button>
                  <Button size="xs" variant="outline" disabled={page >= totalPages} render={<Link href={`/leads/arquivados?page=${page + 1}${search ? `&search=${encodeURIComponent(search)}` : ""}`} />}>Próxima</Button>
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </main>
    </>
  );
}
